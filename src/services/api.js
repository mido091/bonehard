/**
 * api.js
 * ─────────────────────────────────────────────────────
 * Lightweight HTTP client for communicating with the BoneHard Express API.
 *
 * All requests include credentials (cookies) for session-based auth.
 * The server always returns a consistent JSON envelope:
 *   { data: any, meta: any, message: string }
 *
 * Non-2xx responses throw an ApiError, which includes the HTTP status
 * and any additional error metadata from the server.
 */

/** Base URL for all API requests. Production defaults to same-origin for Vercel rewrites. */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:5000');

const CSRF_HEADER_NAME = 'x-csrf-token';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
let csrfTokenPromise = null;

async function getCsrfToken(forceRefresh = false) {
  if (!forceRefresh && csrfTokenPromise) return csrfTokenPromise;

  csrfTokenPromise = fetch(`${API_BASE_URL}/api/auth/csrf-token`, {
    credentials: 'include',
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.data?.csrfToken) {
        throw new ApiError(payload?.message || 'Unable to initialize security token', response.status || 0, payload?.meta);
      }
      return payload.data.csrfToken;
    })
    .catch((error) => {
      csrfTokenPromise = null;
      throw error;
    });

  return csrfTokenPromise;
}

async function withCsrfHeaders(options = {}, forceRefresh = false) {
  const method = (options.method || 'GET').toUpperCase();
  if (!UNSAFE_METHODS.has(method)) return options.headers || {};

  const token = await getCsrfToken(forceRefresh);
  return {
    ...(options.headers || {}),
    [CSRF_HEADER_NAME]: token,
  };
}

/**
 * Custom error class for API failures.
 * Extends Error to preserve the stack trace while adding
 * HTTP-specific metadata (status code, server error details).
 */
export class ApiError extends Error {
  /**
   * @param {string} message - Human-readable error description
   * @param {number} status  - HTTP status code
   * @param {any}    details - Optional extra metadata from the server
   */
  constructor(message, status, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Core fetch wrapper used by all API methods.
 * Automatically attaches credentials and Content-Type headers.
 * Parses the JSON response and throws ApiError on non-2xx status codes.
 *
 * @param {string} path    - API endpoint path (e.g. '/api/auth/me')
 * @param {object} options - Additional fetch options (method, body, headers)
 * @returns {Promise<object>} Parsed JSON response payload
 */
export async function apiRequest(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const requestOptions = {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(await withCsrfHeaders(options)),
    },
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include', // Required for cookie-based session auth
    ...requestOptions,
  });

  // Gracefully handle non-JSON or empty responses, including Vercel 413 text pages.
  const responseText = await response.text();
  let payload = { data: null, meta: null, message: responseText || 'Unexpected server response' };
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload.message = responseText.slice(0, 300);
    }
  }

  if (!response.ok && response.status === 403 && UNSAFE_METHODS.has((options.method || 'GET').toUpperCase())) {
    csrfTokenPromise = null;
    const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(await withCsrfHeaders(options, true)),
      },
    });
    const retryPayload = await retryResponse.json().catch(() => ({
      data: null,
      meta: null,
      message: 'Unexpected server response',
    }));
    if (!retryResponse.ok) {
      throw new ApiError(retryPayload.message || 'Request failed', retryResponse.status, retryPayload.meta);
    }
    return retryPayload;
  }

  if (!response.ok) {
    throw new ApiError(payload.message || 'Request failed', response.status, payload.meta);
  }

  return payload;
}

export async function apiDownload(path, fallbackFileName = 'download.zip') {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: 'Download failed', meta: null }));
    throw new ApiError(payload.message || 'Download failed', response.status, payload.meta);
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  const fileName = encodedMatch
    ? decodeURIComponent(encodedMatch[1])
    : plainMatch?.[1] || fallbackFileName;

  return {
    blob: await response.blob(),
    fileName,
  };
}

/**
 * Convenience API methods that wrap apiRequest with the correct HTTP verbs.
 * All methods return the full parsed JSON payload from the server.
 */
export const api = {
  /** GET request */
  get: (path) => apiRequest(path),
  /** Binary download request, used for generated ZIP/PDF exports */
  download: apiDownload,
  /** POST request — body is serialized to JSON automatically */
  post: (path, body) => apiRequest(path, { method: 'POST', body: JSON.stringify(body || {}) }),
  /** POST multipart request so file uploads keep the browser-managed boundary */
  upload: (path, formData, options = {}) => {
    if (typeof XMLHttpRequest === 'undefined' || !options.onProgress) {
      return apiRequest(path, { method: options.method || 'POST', body: formData, headers: {} });
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const sendUpload = async (forceRefresh = false) => {
        xhr.open(options.method || 'POST', `${API_BASE_URL}${path}`);
        xhr.withCredentials = true;

        try {
          const token = await getCsrfToken(forceRefresh);
          xhr.setRequestHeader(CSRF_HEADER_NAME, token);
        } catch (error) {
          reject(error);
          return;
        }

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          options.onProgress(Math.round((event.loaded / event.total) * 100));
        };

        xhr.onload = () => {
          let payload = { data: null, meta: null, message: xhr.responseText || xhr.statusText || 'Request failed' };
          try {
            payload = JSON.parse(xhr.responseText || '{"data":null,"meta":null,"message":""}');
          } catch {
            payload.message = (xhr.responseText || xhr.statusText || 'Request failed').slice(0, 300);
          }
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new ApiError(payload.message || 'Request failed', xhr.status, payload.meta));
            return;
          }
          resolve(payload);
        };

        xhr.onerror = () => reject(new ApiError('Network error while uploading files', 0));
        xhr.send(formData);
      };

      sendUpload();
    });
  },
  /** PATCH request — for partial resource updates */
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body: JSON.stringify(body || {}) }),
  /** PUT request - for full resource updates */
  put: (path, body) => apiRequest(path, { method: 'PUT', body: JSON.stringify(body || {}) }),
  /** DELETE request */
  delete: (path) => apiRequest(path, { method: 'DELETE' }),
  /** POST with raw FormData (for file uploads, no Content-Type header so browser sets boundary) */
  postForm: (path, formData) => apiRequest(path, { method: 'POST', body: formData, headers: {} }),
};
