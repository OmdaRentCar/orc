-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "birth_date" TEXT,
ADD COLUMN     "customer_address" TEXT,
ADD COLUMN     "extra_charges" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "extra_charges_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "id_number" TEXT,
ADD COLUMN     "late_notified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "license_expiry" TEXT,
ADD COLUMN     "license_issue_date" TEXT,
ADD COLUMN     "license_number" TEXT,
ADD COLUMN     "pickup_reminder_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "return_reminder_sent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "cars" ADD COLUMN     "inspection_expiry" TEXT,
ADD COLUMN     "insurance_expiry" TEXT,
ADD COLUMN     "mileage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "next_service_km" INTEGER,
ADD COLUMN     "plate_number" TEXT,
ADD COLUMN     "vignette_expiry" TEXT;

-- CreateTable
CREATE TABLE "inspections" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "mileage" INTEGER NOT NULL,
    "fuel_level" INTEGER NOT NULL,
    "damages" JSONB NOT NULL DEFAULT '[]',
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "signature" TEXT,
    "signer_name" TEXT NOT NULL,
    "notes" TEXT,
    "staff_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fines" (
    "id" SERIAL NOT NULL,
    "car_id" INTEGER NOT NULL,
    "booking_id" INTEGER,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" SERIAL NOT NULL,
    "car_id" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_logs" (
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_logs_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "inspections_booking_id_type_key" ON "inspections"("booking_id", "type");

-- CreateIndex
CREATE INDEX "fines_car_id_date_idx" ON "fines"("car_id", "date");

-- CreateIndex
CREATE INDEX "expenses_car_id_date_idx" ON "expenses"("car_id", "date");

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fines" ADD CONSTRAINT "fines_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "cars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fines" ADD CONSTRAINT "fines_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "cars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

