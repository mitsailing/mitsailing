-- Map negotiated catalog rows to flat; unset amounts stay null on persona prices.
UPDATE pavilion_reservable_items
SET pricing_type = 'flat'
WHERE pricing_type = 'tbd';

CREATE TYPE pavilion_pricing_type_new AS ENUM ('hourly', 'flat');

ALTER TABLE pavilion_reservable_items
  ALTER COLUMN pricing_type TYPE pavilion_pricing_type_new
  USING (pricing_type::text::pavilion_pricing_type_new);

DROP TYPE pavilion_pricing_type;

ALTER TYPE pavilion_pricing_type_new RENAME TO pavilion_pricing_type;
