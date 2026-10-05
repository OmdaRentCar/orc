import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';

// Neon's serverless driver only talks to Neon; a local PostgreSQL uses Prisma's built-in driver
export function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('neon.tech')) return new PrismaClient();

  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: url });
  return new PrismaClient({ adapter: new PrismaNeon(pool) });
}

const prisma = createPrismaClient();

export default prisma;
