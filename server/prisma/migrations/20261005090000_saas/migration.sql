-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "billing_cycle" TEXT NOT NULL DEFAULT 'monthly',
ADD COLUMN     "city" TEXT,
ADD COLUMN     "current_period_end" TIMESTAMP(3),
ADD COLUMN     "domain_token" TEXT,
ADD COLUMN     "domain_verified_at" TIMESTAMP(3),
ADD COLUMN     "listed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "owner_email" TEXT,
ADD COLUMN     "past_due_since" TIMESTAMP(3),
ADD COLUMN     "pending_domain" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "agency_id" INTEGER NOT NULL DEFAULT (current_setting('app.agency_id'))::integer,
    "number" TEXT,
    "plan" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL,
    "provider_ref" TEXT,
    "pay_url" TEXT,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_events" (
    "id" SERIAL NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "agency_id" INTEGER,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_provider_ref_key" ON "invoices"("provider_ref");

-- CreateIndex
CREATE INDEX "invoices_agency_id_idx" ON "invoices"("agency_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- CreateIndex
CREATE INDEX "platform_events_agency_id_idx" ON "platform_events"("agency_id");

-- CreateIndex
CREATE INDEX "platform_events_created_at_idx" ON "platform_events"("created_at");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

