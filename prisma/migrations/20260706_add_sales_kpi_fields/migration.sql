-- CreateEnum
CREATE TYPE "JobCategory" AS ENUM ('GENERAL', 'SALES');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('GENERAL', 'SALES_REVENUE');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN "jobCategory" "JobCategory" NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "personal_kpis" ADD COLUMN "goalType" "GoalType" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "personal_kpis" ADD COLUMN "targetAmount" BIGINT;
