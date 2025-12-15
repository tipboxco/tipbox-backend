-- AlterEnum
ALTER TYPE "dm_request_status" ADD VALUE 'REPORTED';

-- AlterTable
-- Add cosmetic_badge_id column if it doesn't exist (it may have been added in previous migration)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'cosmetic_badge_id'
    ) THEN
        ALTER TABLE "profiles" ADD COLUMN "cosmetic_badge_id" UUID;
    END IF;
END $$;

-- CreateTable
CREATE TABLE "boost_options" (
    "id" UUID NOT NULL,
    "image" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "is_popular" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boost_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_durations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experience_durations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_locations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experience_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_purposes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experience_purposes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "experience_durations_name_key" ON "experience_durations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "experience_locations_name_key" ON "experience_locations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "experience_purposes_name_key" ON "experience_purposes"("name");

-- AddForeignKey
-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_cosmetic_badge_id_fkey'
    ) THEN
        ALTER TABLE "profiles" ADD CONSTRAINT "profiles_cosmetic_badge_id_fkey" FOREIGN KEY ("cosmetic_badge_id") REFERENCES "badges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
