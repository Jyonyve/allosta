-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADVISOR', 'OPERATOR');

-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('RESERVED', 'DOCUMENTING', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConsultationRecordStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateEnum
CREATE TYPE "DelegationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ConsentMethod" AS ENUM ('SELF_SERVICE', 'EXTERNAL_VERIFIED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "examinees" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "name" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "examinees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_categories" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "test_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_types" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "test_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_results" (
    "id" UUID NOT NULL,
    "examinee_id" UUID NOT NULL,
    "test_type_id" UUID NOT NULL,
    "tested_at" TIMESTAMPTZ(3) NOT NULL,
    "summary" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "introduction" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "advisor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_test_types" (
    "advisor_id" UUID NOT NULL,
    "test_type_id" UUID NOT NULL,

    CONSTRAINT "advisor_test_types_pkey" PRIMARY KEY ("advisor_id","test_type_id")
);

-- CreateTable
CREATE TABLE "advisor_availabilities" (
    "id" UUID NOT NULL,
    "advisor_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "advisor_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_policies" (
    "id" UUID NOT NULL,
    "consultation_duration_minutes" INTEGER NOT NULL,
    "slot_interval_minutes" INTEGER NOT NULL,
    "minimum_booking_lead_time_minutes" INTEGER NOT NULL,
    "cancellation_cutoff_minutes" INTEGER NOT NULL,
    "booking_window_days" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "scheduling_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_delegations" (
    "id" UUID NOT NULL,
    "test_result_id" UUID NOT NULL,
    "delegate_user_id" UUID NOT NULL,
    "status" "DelegationStatus" NOT NULL DEFAULT 'PENDING',
    "consent_method" "ConsentMethod",
    "consented_by_user_id" UUID,
    "verified_by_operator_user_id" UUID,
    "consented_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consultation_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" UUID NOT NULL,
    "requester_user_id" UUID NOT NULL,
    "test_result_id" UUID NOT NULL,
    "advisor_id" UUID NOT NULL,
    "delegation_id" UUID,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'RESERVED',
    "scheduled_start_at" TIMESTAMPTZ(3) NOT NULL,
    "scheduled_end_at" TIMESTAMPTZ(3) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_by_user_id" UUID,
    "cancellation_reason" TEXT,
    "completed_at" TIMESTAMPTZ(3),
    "no_show_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_records" (
    "id" UUID NOT NULL,
    "consultation_id" UUID NOT NULL,
    "status" "ConsultationRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "main_question" TEXT,
    "memo" TEXT,
    "follow_up_required" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_note" TEXT,
    "finalized_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consultation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_interested_products" (
    "consultation_record_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,

    CONSTRAINT "consultation_interested_products_pkey" PRIMARY KEY ("consultation_record_id","product_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "examinees_user_id_key" ON "examinees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_categories_code_key" ON "test_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "test_types_code_key" ON "test_types"("code");

-- CreateIndex
CREATE INDEX "test_types_category_id_idx" ON "test_types"("category_id");

-- CreateIndex
CREATE INDEX "test_results_examinee_id_tested_at_idx" ON "test_results"("examinee_id", "tested_at");

-- CreateIndex
CREATE INDEX "test_results_test_type_id_idx" ON "test_results"("test_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "advisor_profiles_user_id_key" ON "advisor_profiles"("user_id");

-- CreateIndex
CREATE INDEX "advisor_profiles_active_idx" ON "advisor_profiles"("active");

-- CreateIndex
CREATE INDEX "advisor_test_types_test_type_id_idx" ON "advisor_test_types"("test_type_id");

-- CreateIndex
CREATE INDEX "advisor_availabilities_advisor_id_starts_at_idx" ON "advisor_availabilities"("advisor_id", "starts_at");

-- CreateIndex
CREATE INDEX "scheduling_policies_active_idx" ON "scheduling_policies"("active");

-- CreateIndex
CREATE INDEX "consultation_delegations_delegate_user_id_status_idx" ON "consultation_delegations"("delegate_user_id", "status");

-- CreateIndex
CREATE INDEX "consultation_delegations_test_result_id_status_idx" ON "consultation_delegations"("test_result_id", "status");

-- CreateIndex
CREATE INDEX "consultations_advisor_id_scheduled_start_at_idx" ON "consultations"("advisor_id", "scheduled_start_at");

-- CreateIndex
CREATE INDEX "consultations_requester_user_id_scheduled_start_at_idx" ON "consultations"("requester_user_id", "scheduled_start_at");

-- CreateIndex
CREATE INDEX "consultations_test_result_id_status_idx" ON "consultations"("test_result_id", "status");

-- CreateIndex
CREATE INDEX "consultations_status_scheduled_start_at_idx" ON "consultations"("status", "scheduled_start_at");

-- CreateIndex
CREATE INDEX "consultations_delegation_id_idx" ON "consultations"("delegation_id");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_records_consultation_id_key" ON "consultation_records"("consultation_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX "products_active_idx" ON "products"("active");

-- CreateIndex
CREATE INDEX "consultation_interested_products_product_id_idx" ON "consultation_interested_products"("product_id");

-- AddForeignKey
ALTER TABLE "examinees" ADD CONSTRAINT "examinees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_types" ADD CONSTRAINT "test_types_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "test_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_examinee_id_fkey" FOREIGN KEY ("examinee_id") REFERENCES "examinees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_test_type_id_fkey" FOREIGN KEY ("test_type_id") REFERENCES "test_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_profiles" ADD CONSTRAINT "advisor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_test_types" ADD CONSTRAINT "advisor_test_types_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "advisor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_test_types" ADD CONSTRAINT "advisor_test_types_test_type_id_fkey" FOREIGN KEY ("test_type_id") REFERENCES "test_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_availabilities" ADD CONSTRAINT "advisor_availabilities_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "advisor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_delegations" ADD CONSTRAINT "consultation_delegations_test_result_id_fkey" FOREIGN KEY ("test_result_id") REFERENCES "test_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_delegations" ADD CONSTRAINT "consultation_delegations_delegate_user_id_fkey" FOREIGN KEY ("delegate_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_delegations" ADD CONSTRAINT "consultation_delegations_consented_by_user_id_fkey" FOREIGN KEY ("consented_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_delegations" ADD CONSTRAINT "consultation_delegations_verified_by_operator_user_id_fkey" FOREIGN KEY ("verified_by_operator_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_test_result_id_fkey" FOREIGN KEY ("test_result_id") REFERENCES "test_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "advisor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_delegation_id_fkey" FOREIGN KEY ("delegation_id") REFERENCES "consultation_delegations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_records" ADD CONSTRAINT "consultation_records_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_interested_products" ADD CONSTRAINT "consultation_interested_products_consultation_record_id_fkey" FOREIGN KEY ("consultation_record_id") REFERENCES "consultation_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_interested_products" ADD CONSTRAINT "consultation_interested_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- =====================================================
-- Custom domain constraints
-- =====================================================

-- -----------------------------------------------------
-- Advisor Availability
-- -----------------------------------------------------

ALTER TABLE "advisor_availabilities"
ADD CONSTRAINT "advisor_availability_valid_range"
CHECK ("starts_at" < "ends_at");

-- 같은 상담사의 Availability 시간대 중복 방지
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "advisor_availabilities"
ADD CONSTRAINT "advisor_availability_no_overlap"
EXCLUDE USING GIST (
  "advisor_id" WITH =,
  tstzrange("starts_at", "ends_at", '[)') WITH &&
);

-- -----------------------------------------------------
-- Consultation
-- -----------------------------------------------------

ALTER TABLE "consultations"
ADD CONSTRAINT "consultation_valid_schedule"
CHECK ("scheduled_start_at" < "scheduled_end_at");

-- 상담사 한 명은 같은 시각에 하나의 활성 상담만 가능
CREATE UNIQUE INDEX "uq_active_advisor_consultation"
ON "consultations" ("advisor_id", "scheduled_start_at")
WHERE "status" IN ('RESERVED', 'DOCUMENTING');

-- 요청자 역시 같은 시각에 하나의 활성 상담만 가능
CREATE UNIQUE INDEX "uq_active_requester_consultation"
ON "consultations" ("requester_user_id", "scheduled_start_at")
WHERE "status" IN ('RESERVED', 'DOCUMENTING');

-- 하나의 검사 결과는 동시에 하나의 활성 상담만 가능
CREATE UNIQUE INDEX "uq_active_test_result_consultation"
ON "consultations" ("test_result_id")
WHERE "status" IN ('RESERVED', 'DOCUMENTING');

-- -----------------------------------------------------
-- Scheduling Policy
-- -----------------------------------------------------

ALTER TABLE "scheduling_policies"
ADD CONSTRAINT "scheduling_policy_positive_duration"
CHECK ("consultation_duration_minutes" > 0);

ALTER TABLE "scheduling_policies"
ADD CONSTRAINT "scheduling_policy_positive_interval"
CHECK ("slot_interval_minutes" > 0);

ALTER TABLE "scheduling_policies"
ADD CONSTRAINT "scheduling_policy_non_negative_booking_lead_time"
CHECK ("minimum_booking_lead_time_minutes" >= 0);

ALTER TABLE "scheduling_policies"
ADD CONSTRAINT "scheduling_policy_valid_cancellation_cutoff"
CHECK (
  "cancellation_cutoff_minutes"
  >= "minimum_booking_lead_time_minutes"
);

ALTER TABLE "scheduling_policies"
ADD CONSTRAINT "scheduling_policy_positive_booking_window"
CHECK ("booking_window_days" > 0);

-- 전사 활성 SchedulingPolicy는 최대 하나
CREATE UNIQUE INDEX "uq_single_active_scheduling_policy"
ON "scheduling_policies" ("active")
WHERE "active" = true;

-- -----------------------------------------------------
-- Consultation Record
-- -----------------------------------------------------

ALTER TABLE "consultation_records"
ADD CONSTRAINT "consultation_record_finalization_consistency"
CHECK (
  (
    "status" = 'DRAFT'
    AND "finalized_at" IS NULL
  )
  OR
  (
    "status" = 'FINAL'
    AND "finalized_at" IS NOT NULL
  )
);