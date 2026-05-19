CREATE TABLE "event_registration_teams" (
    "id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "team_name" VARCHAR(80) NOT NULL,
    "allow_repeat_captain" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "event_registration_teams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_registration_boat_members" (
    "id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "boat_number" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "full_name" VARCHAR(80) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    CONSTRAINT "event_registration_boat_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_registration_teams_registration_id_key" ON "event_registration_teams"("registration_id");
CREATE INDEX "event_registration_boat_members_registration_id_idx" ON "event_registration_boat_members"("registration_id");
CREATE UNIQUE INDEX "event_registration_boat_members_registration_id_boat_number_position_key" ON "event_registration_boat_members"("registration_id", "boat_number", "position");

ALTER TABLE "event_registration_teams" ADD CONSTRAINT "event_registration_teams_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "event_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_registration_boat_members" ADD CONSTRAINT "event_registration_boat_members_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "event_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
