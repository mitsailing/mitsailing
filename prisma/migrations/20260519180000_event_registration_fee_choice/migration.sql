-- Persist the event entry fee selected for a registration. Existing rows stay
-- null because historical fee choice is unknown.
ALTER TABLE "event_registrations"
ADD COLUMN "event_entry_fee_id" TEXT;

CREATE INDEX "event_registrations_event_entry_fee_id_idx"
ON "event_registrations"("event_entry_fee_id");

ALTER TABLE "event_entry_fees"
ADD CONSTRAINT "event_entry_fees_event_id_id_key"
UNIQUE ("event_id", "id");

ALTER TABLE "event_registrations"
ADD CONSTRAINT "event_registrations_event_entry_fee_id_fkey"
FOREIGN KEY ("event_id", "event_entry_fee_id") REFERENCES "event_entry_fees"("event_id", "id")
ON DELETE SET NULL ("event_entry_fee_id") ON UPDATE CASCADE;
