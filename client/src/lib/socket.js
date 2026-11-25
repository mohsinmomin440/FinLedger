import { io } from 'socket.io-client';

let socket = null;

export function connectWorkspaceSocket({ accessToken, workspaceId }) {
  if (!accessToken) return null;

  if (socket) {
    socket.auth = { token: accessToken, workspaceId };
    if (!socket.connected) {
      socket.connect();
    } else if (workspaceId) {
      socket.emit('workspace:join', workspaceId);
    }
    return socket;
  }

  const configuredSocketUrl = (import.meta.env.VITE_SOCKET_URL || '').trim().replace(/\/+$/, '');
  const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();
  let baseUrl = configuredSocketUrl;
  if (!baseUrl && /^https?:\/\//i.test(configuredApiUrl)) {
    baseUrl = new URL(configuredApiUrl).origin;
  }
  if (!baseUrl) {
    baseUrl = window.location.origin;
  }
  socket = io(baseUrl, {
    auth: { token: accessToken, workspaceId },
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });

  return socket;
}

export function disconnectWorkspaceSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getWorkspaceSocket() {
  return socket;
}
