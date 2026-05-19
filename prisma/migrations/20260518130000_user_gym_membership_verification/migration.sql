-- Add user-level manual gym verification timestamp.
ALTER TABLE "user"
ADD COLUMN "gym_membership_verified_at" TIMESTAMP(3);
