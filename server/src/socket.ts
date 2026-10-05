import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from './lib/prisma';
import { currentAgency, runAsAgency, AGENCY_SELECT } from './lib/tenant';
import { userFromToken } from './middleware/auth';
import { allowedOrigin } from './lib/origins';

let io: SocketServer;

export function initSocket(server: HttpServer): void {
  io = new SocketServer(server, {
    cors: {
      origin: (origin, cb) => { allowedOrigin(origin).then((ok) => cb(null, ok), () => cb(null, false)); },
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  // Only logged-in admins may connect: booking events carry customer names
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    let agencyId: number | undefined;
    try { agencyId = (jwt.verify(token, process.env.JWT_SECRET!) as { agencyId?: number }).agencyId; } catch { /* rejected below */ }
    const agency = agencyId ? await prisma.agency.findUnique({ where: { id: agencyId }, select: AGENCY_SELECT }) : null;
    const user = agency ? await runAsAgency(agency, () => userFromToken(token)) : null;
    if (!user || !agency) return next(new Error('Unauthorized'));
    socket.data.user = user;
    socket.data.agencyId = agency.id;
    next();
  });

  io.on('connection', (socket) => {
    socket.on('join-admin', () => {
      socket.join(`admin-room:${socket.data.agencyId}`);
    });
  });
}

export function emitBookingUpdate(payload: {
  type: string;
  message: string;
  bookingId: number;
}): void {
  const agency = currentAgency();
  if (io && agency) io.to(`admin-room:${agency.id}`).emit('booking-update', payload);
}
