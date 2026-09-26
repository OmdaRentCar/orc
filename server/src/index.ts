import 'dotenv/config';
import './instrument';
import http from 'http';
import { createApp } from './app';
import { initSocket } from './socket';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET env var is required');
  process.exit(1);
}

const server = http.createServer(createApp());
initSocket(server);

const PORT = parseInt(process.env.PORT || '4000', 10);
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
