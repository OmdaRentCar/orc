-- CreateTable
CREATE TABLE "online_contracts" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_by" TEXT NOT NULL,
    "otp_hash" TEXT,
    "otp_expires_at" TIMESTAMP(3),
    "otp_attempts" INTEGER NOT NULL DEFAULT 0,
    "otp_sent_count" INTEGER NOT NULL DEFAULT 0,
    "otp_last_sent_at" TIMESTAMP(3),
    "viewed_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3),
    "signer_name" TEXT,
    "signer_ip" TEXT,
    "signer_user_agent" TEXT,
    "signature" TEXT,
    "pdf_url" TEXT,
    "document_hash" TEXT,
    "verification_code" TEXT,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "online_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "online_contracts_booking_id_key" ON "online_contracts"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "online_contracts_token_hash_key" ON "online_contracts"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "online_contracts_verification_code_key" ON "online_contracts"("verification_code");

-- AddForeignKey
ALTER TABLE "online_contracts" ADD CONSTRAINT "online_contracts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

