import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';

let io: SocketServer;

export function initSocket(server: HttpServer): void {
  io = new SocketServer(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('join-admin', () => {
      socket.join('admin-room');
    });
  });
}

export function emitBookingUpdate(payload: {
  type: string;
  message: string;
  bookingId: number;
}): void {
  if (io) io.to('admin-room').emit('booking-update', payload);
}
