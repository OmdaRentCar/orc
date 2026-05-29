import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export const socket: Socket = io(SOCKET_URL, { autoConnect: false });

export function joinAdmin(): void {
  if (!socket.connected) socket.connect();
  socket.emit('join-admin');
}

export function disconnectSocket(): void {
  socket.disconnect();
}
