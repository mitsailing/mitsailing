-- Persist the event entry fee selected for a registration. Existing rows stay
-- null because historical fee choice is unknown.
ALTER TABLE "event_registrations"
ADD COLUMN "event_entry_fee_id" TEXT;

CREATE INDEX "event_registrations_event_entry_fee_id_idx"
ON "event_registrations"("event_entry_fee_id");

ALTER TABLE "event_registrations"
ADD CONSTRAINT "event_registrations_event_entry_fee_id_fkey"
FOREIGN KEY ("event_entry_fee_id") REFERENCES "event_entry_fees"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
