-- Multi-agency: every business row now belongs to an agency.
-- Existing data becomes agency #1 (slug "rentcar"); new agencies are added by signing up.
-- CreateTable
CREATE TABLE "agencies" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "custom_domain" TEXT,
    "logo_url" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#e72526',
    "status" TEXT NOT NULL DEFAULT 'active',
    "plan" TEXT NOT NULL DEFAULT 'business',
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

INSERT INTO "agencies" ("slug", "name", "status", "plan") VALUES ('rentcar', 'RentCar', 'active', 'business');

-- DropIndex
DROP INDEX "admin_users_email_key";

-- DropIndex
DROP INDEX "admin_users_username_key";

-- DropIndex
DROP INDEX "blocked_customers_phone_key";

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "agency_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "agency_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "blocked_customers" ADD COLUMN     "agency_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "agency_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "business_settings" DROP CONSTRAINT "business_settings_pkey",
DROP COLUMN "id",
ADD COLUMN     "agency_id" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "business_settings_pkey" PRIMARY KEY ("agency_id");

-- AlterTable
ALTER TABLE "cars" ADD COLUMN     "agency_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "agency_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "fines" ADD COLUMN     "agency_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "inspections" ADD COLUMN     "agency_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "agency_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "online_contracts" ADD COLUMN     "agency_id" INTEGER NOT NULL DEFAULT 1;


-- CreateIndex
CREATE UNIQUE INDEX "agencies_slug_key" ON "agencies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_custom_domain_key" ON "agencies"("custom_domain");

-- CreateIndex
CREATE INDEX "admin_users_agency_id_idx" ON "admin_users"("agency_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_agency_id_username_key" ON "admin_users"("agency_id", "username");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_agency_id_email_key" ON "admin_users"("agency_id", "email");

-- CreateIndex
CREATE INDEX "audit_logs_agency_id_idx" ON "audit_logs"("agency_id");

-- CreateIndex
CREATE INDEX "blocked_customers_agency_id_idx" ON "blocked_customers"("agency_id");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_customers_agency_id_phone_key" ON "blocked_customers"("agency_id", "phone");

-- CreateIndex
CREATE INDEX "bookings_agency_id_idx" ON "bookings"("agency_id");

-- CreateIndex
CREATE INDEX "cars_agency_id_idx" ON "cars"("agency_id");

-- CreateIndex
CREATE INDEX "expenses_agency_id_idx" ON "expenses"("agency_id");

-- CreateIndex
CREATE INDEX "fines_agency_id_idx" ON "fines"("agency_id");

-- CreateIndex
CREATE INDEX "inspections_agency_id_idx" ON "inspections"("agency_id");

-- CreateIndex
CREATE INDEX "notifications_agency_id_idx" ON "notifications"("agency_id");

-- CreateIndex
CREATE INDEX "online_contracts_agency_id_idx" ON "online_contracts"("agency_id");

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cars" ADD CONSTRAINT "cars_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_customers" ADD CONSTRAINT "blocked_customers_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fines" ADD CONSTRAINT "fines_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_contracts" ADD CONSTRAINT "online_contracts_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The default only served to attach existing rows to agency #1
ALTER TABLE "admin_users" ALTER COLUMN "agency_id" DROP DEFAULT;
ALTER TABLE "audit_logs" ALTER COLUMN "agency_id" DROP DEFAULT;
ALTER TABLE "blocked_customers" ALTER COLUMN "agency_id" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "agency_id" DROP DEFAULT;
ALTER TABLE "cars" ALTER COLUMN "agency_id" DROP DEFAULT;
ALTER TABLE "expenses" ALTER COLUMN "agency_id" DROP DEFAULT;
ALTER TABLE "fines" ALTER COLUMN "agency_id" DROP DEFAULT;
ALTER TABLE "inspections" ALTER COLUMN "agency_id" DROP DEFAULT;
ALTER TABLE "notifications" ALTER COLUMN "agency_id" DROP DEFAULT;
ALTER TABLE "online_contracts" ALTER COLUMN "agency_id" DROP DEFAULT;
ALTER TABLE "business_settings" ALTER COLUMN "agency_id" DROP DEFAULT;
