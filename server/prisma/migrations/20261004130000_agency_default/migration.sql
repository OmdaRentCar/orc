-- AlterTable
ALTER TABLE "admin_users" ALTER COLUMN "agency_id" SET DEFAULT (current_setting('app.agency_id'))::integer;

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "agency_id" SET DEFAULT (current_setting('app.agency_id'))::integer;

-- AlterTable
ALTER TABLE "blocked_customers" ALTER COLUMN "agency_id" SET DEFAULT (current_setting('app.agency_id'))::integer;

-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "agency_id" SET DEFAULT (current_setting('app.agency_id'))::integer;

-- AlterTable
ALTER TABLE "cars" ALTER COLUMN "agency_id" SET DEFAULT (current_setting('app.agency_id'))::integer;

-- AlterTable
ALTER TABLE "expenses" ALTER COLUMN "agency_id" SET DEFAULT (current_setting('app.agency_id'))::integer;

-- AlterTable
ALTER TABLE "fines" ALTER COLUMN "agency_id" SET DEFAULT (current_setting('app.agency_id'))::integer;

-- AlterTable
ALTER TABLE "inspections" ALTER COLUMN "agency_id" SET DEFAULT (current_setting('app.agency_id'))::integer;

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "agency_id" SET DEFAULT (current_setting('app.agency_id'))::integer;

-- AlterTable
ALTER TABLE "online_contracts" ALTER COLUMN "agency_id" SET DEFAULT (current_setting('app.agency_id'))::integer;

