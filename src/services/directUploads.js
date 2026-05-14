import { api } from './api';

function uploadToSignedUrl({ signedUrl, file, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('cacheControl', '3600');
    formData.append('', file);

    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      let message = xhr.responseText || xhr.statusText || 'File upload failed';
      try {
        const payload = JSON.parse(xhr.responseText);
        message = payload.message || payload.error || message;
      } catch {
        message = message.slice(0, 300);
      }
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error('Network error while uploading file'));
    xhr.send(formData);
  });
}

export async function uploadFilesDirectly({
  uploads,
  signPath,
  folderKey,
  ownerId,
  ownerKey = 'caseId',
  fileNameFor,
  onProgress,
}) {
  const items = Array.isArray(uploads) ? uploads : [];
  if (!items.length) return [];

  const uploadedFiles = [];
  const total = items.length;

  for (let index = 0; index < total; index += 1) {
    const item = items[index];
    const fileName = fileNameFor ? fileNameFor(item) : item.file?.name;
    const signBody = {
      fileName,
      mimeType: item.file?.type || 'application/octet-stream',
      fileSize: item.file?.size || 0,
      folderKey,
    };
    if (ownerId) signBody[ownerKey] = ownerId;

    const target = await api.post(signPath, signBody);
    const signed = target.data;
    await uploadToSignedUrl({
      signedUrl: signed.signedUrl,
      file: item.file,
      onProgress: (fileProgress) => {
        const aggregate = Math.round(((index + (fileProgress / 100)) / total) * 100);
        onProgress?.(aggregate, item);
      },
    });

    uploadedFiles.push({
      storagePath: signed.storagePath,
      fileName: signed.fileName || fileName,
      mimeType: item.file?.type || signed.mimeType || 'application/octet-stream',
      fileSize: item.file?.size || signed.fileSize || 0,
      uploadCategory: item.category || 'photos_documents',
    });
  }

  return uploadedFiles;
}
