-- Legacy event fields: reg_team, team_size, boat_size, reg_repeatcap.
ALTER TABLE "events"
  ADD COLUMN "uses_team_registration" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "boats_per_team" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "persons_per_boat" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "allow_repeat_team_captain" BOOLEAN NOT NULL DEFAULT false;
