import { PrismaNeon } from '@prisma/adapter-neon';
import { Prisma, PrismaClient } from '@prisma/client';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { currentAgency, isUnscoped } from './tenant';

// Neon's serverless driver only talks to Neon; a local PostgreSQL uses Prisma's built-in driver
function createBaseClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('neon.tech')) return new PrismaClient();

  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: url });
  return new PrismaClient({ adapter: new PrismaNeon(pool) });
}

// Every table that belongs to an agency. Queries on them are scoped to the current agency automatically.
export const AGENCY_MODELS = new Set<string>([
  'AdminUser', 'Car', 'Booking', 'Notification', 'BusinessSettings', 'BlockedCustomer',
  'AuditLog', 'Inspection', 'Fine', 'Expense', 'OnlineContract', 'Invoice',
]);

const READ_WRITE_WHERE = new Set([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany',
  'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany',
]);

type Args = Record<string, unknown> & { where?: object; data?: unknown; create?: object };

// Adds "belongs to this agency" to the query. Fails closed: with no agency and no explicit
// platform-level scope, the query is refused instead of returning every agency's data.
function scope(model: string, operation: string, args: Args): Args {
  const agency = currentAgency();
  if (!agency) {
    if (isUnscoped()) return args;
    throw new Error(`Refused ${model}.${operation}: no agency for this request`);
  }
  const agencyId = agency.id;
  const next: Args = { ...args };
  if (READ_WRITE_WHERE.has(operation)) {
    next.where = { ...(args.where ?? {}), agencyId };
  } else if (operation === 'create') {
    next.data = { ...(args.data as object), agencyId };
  } else if (operation === 'createMany' || operation === 'createManyAndReturn') {
    const data = args.data as object | object[];
    next.data = Array.isArray(data) ? data.map((d) => ({ ...d, agencyId })) : { ...data, agencyId };
  } else if (operation === 'upsert') {
    next.where = { ...(args.where ?? {}), agencyId };
    next.create = { ...(args.create ?? {}), agencyId };
  }
  return next;
}

export function createPrismaClient() {
  return createBaseClient().$extends({
    name: 'agency-scope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!AGENCY_MODELS.has(model)) return query(args);
          return query(scope(model, operation, args as Args) as typeof args);
        },
      },
    },
  });
}

const prisma = createPrismaClient();

export type Db = typeof prisma;
export type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0];
export { Prisma };
export default prisma;
