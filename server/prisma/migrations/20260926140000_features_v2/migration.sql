-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'staff';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "amount_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "delivery_address" TEXT,
ADD COLUMN     "delivery_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "delivery_type" TEXT NOT NULL DEFAULT 'agency',
ADD COLUMN     "deposit" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "extras" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "extras_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "payment_status" TEXT NOT NULL DEFAULT 'unpaid',
ADD COLUMN     "pickup_time" TEXT NOT NULL DEFAULT '10:00',
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "return_time" TEXT NOT NULL DEFAULT '10:00',
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'online',
ADD COLUMN     "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill: existing bookings get a reference code and keep their old total as the subtotal
UPDATE "bookings"
SET "reference" = 'RC-' || upper(substr(md5(random()::text || "id"::text), 1, 6)),
    "subtotal" = "total";
ALTER TABLE "bookings" ALTER COLUMN "reference" SET NOT NULL;

-- Existing admin accounts keep full access
UPDATE "admin_users" SET "role" = 'owner';

-- AlterTable
ALTER TABLE "cars" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "business_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_customers" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER,
    "username" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" INTEGER,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blocked_customers_phone_key" ON "blocked_customers"("phone");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_reference_key" ON "bookings"("reference");

-- CreateIndex
CREATE INDEX "bookings_phone_idx" ON "bookings"("phone");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

