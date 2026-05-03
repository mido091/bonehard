import { api } from './api';

let pusherClient = null;

export async function getPusherClient() {
  if (pusherClient && pusherClient.connection.state !== 'disconnected') {
    return pusherClient;
  }

  const Pusher = (await import('pusher-js')).default;

  // Enable Pusher logging in development to debug connection issues
  if (import.meta.env.DEV) {
    Pusher.logToConsole = true;
  }

  // The client is lazy-loaded so non-chat admin pages keep a smaller payload.
  pusherClient = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
    cluster: import.meta.env.VITE_PUSHER_CLUSTER,
    forceTLS: true,
    channelAuthorization: {
      // Custom handler: posts to our server's /api/pusher/auth endpoint
      // The server returns Pusher's auth object directly (not wrapped in our ApiResponse)
      customHandler: async ({ socketId, channelName }, callback) => {
        try {
          // Use the raw axios instance to get the full response without our API wrapper
          const response = await api.post('/api/pusher/auth', {
            socket_id: socketId,
            channel_name: channelName,
          });
          // The pusher auth endpoint returns { auth: '...', channel_data: '...' } directly
          // Our api wrapper puts the response.data here, so we pass it straight through
          callback(null, response);
        } catch (error) {
          console.error('[Pusher] Channel auth failed:', error.message);
          callback(new Error(error.message || 'Pusher auth failed'), null);
        }
      },
    },
  });

  // Log connection state changes to aid debugging
  pusherClient.connection.bind('state_change', ({ current }) => {
    console.log(`[Pusher] Connection state → ${current}`);
  });

  pusherClient.connection.bind('error', (err) => {
    console.error('[Pusher] Connection error:', err);
  });

  return pusherClient;
}

export function disconnectPusherClient() {
  if (pusherClient) {
    pusherClient.disconnect();
    pusherClient = null;
  }
}
