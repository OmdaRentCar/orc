import { Server } from 'socket.io';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
  });

  io.on('connection', (socket) => {
    console.log('[SOCKET] Client connected');

    socket.on('join-admin', () => {
      socket.join('admin-room');
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] Client disconnected');
    });
  });

  return io;
}

export function notifyBookingUpdate(data) {
  if (io) {
    io.to('admin-room').emit('booking-update', data);
  }
}
