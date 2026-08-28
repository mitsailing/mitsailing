-- Pavilion spaces admin catalog: public groups, media gallery, one-time bootstrap.

CREATE TYPE "pavilion_reservable_item_public_group" AS ENUM (
  'venue',
  'event_options',
  'programs'
);

ALTER TABLE "pavilion_reservable_items"
  ADD COLUMN "public_group" "pavilion_reservable_item_public_group";

CREATE TABLE "pavilion_reservable_item_media" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "media_asset_id" TEXT NOT NULL,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "caption" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pavilion_reservable_item_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pavilion_reservable_item_media_item_id_media_asset_id_key"
  ON "pavilion_reservable_item_media"("item_id", "media_asset_id");

CREATE INDEX "pavilion_reservable_item_media_item_id_display_order_idx"
  ON "pavilion_reservable_item_media"("item_id", "display_order");

CREATE INDEX "pavilion_reservable_item_media_media_asset_id_idx"
  ON "pavilion_reservable_item_media"("media_asset_id");

CREATE INDEX "pavilion_reservable_items_public_group_display_order_idx"
  ON "pavilion_reservable_items"("public_group", "display_order");

ALTER TABLE "pavilion_reservable_item_media"
  ADD CONSTRAINT "pavilion_reservable_item_media_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "pavilion_reservable_items"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pavilion_reservable_item_media"
  ADD CONSTRAINT "pavilion_reservable_item_media_media_asset_id_fkey"
  FOREIGN KEY ("media_asset_id") REFERENCES "cms_media_assets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pavilion_reservable_items"
  ADD CONSTRAINT "pavilion_reservable_items_public_group_kind_check"
  CHECK (
    ("kind" = 'space' AND "public_group" IS NOT NULL)
    OR ("kind" = 'service' AND "public_group" IS NULL)
  ) NOT VALID;

-- One-time bootstrap of catalog rows (insert only if missing). Staff edits are not overwritten.
INSERT INTO "pavilion_reservable_items" (
  "id", "slug", "kind", "name", "description", "image_url", "pricing_type",
  "min_duration_hours", "public_group", "display_order", "is_visible", "created_at", "updated_at"
)
VALUES
  (
    'pavilion-item-grill', 'grill', 'space',
    'Barbecue Grill, flat fee per grill',
    'Reserve grill access for your event. Staff can adjust grill quantity during review.',
    NULL, 'flat', NULL, 'venue', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pavilion-item-casual-dock', 'casual_dock', 'space',
    'Casual party space - Shore School/Wooden Dock in front (50 People Max)',
    'Perfect for casual gatherings and events with up to 50 people.',
    '/assets/images/pavilion-reservation-placeholder.svg', 'hourly', 1, 'venue', 10, true,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pavilion-item-roof-deck', 'roof_deck', 'space',
    'Entire east roof deck area (100 People Max)',
    'Spacious roof deck area ideal for larger events with up to 100 people.',
    '/assets/images/pavilion-reservation-placeholder.svg', 'hourly', 1, 'venue', 20, true,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pavilion-item-party-boat', 'party_boat', 'space',
    'Party boat dock, 15 minutes each way',
    'Boat dock access for your event transportation needs.',
    '/assets/images/pavilion-reservation-placeholder.svg', 'flat', NULL, 'venue', 30, true,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pavilion-item-lab-access', 'lab_access', 'space',
    'Lab Access / Dock Experiment',
    'Fees arranged with Sailing Master.',
    '/assets/images/pavilion-reservation-placeholder.svg', 'flat', NULL, 'programs', 70, true,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pavilion-item-wedding-space', 'wedding_space', 'space',
    'Wedding/ Wedding Rehearsal/ Wedding Reception (in addition to hourly)',
    'Special wedding package space reservation.',
    '/assets/images/pavilion-reservation-placeholder.svg', 'flat', NULL, 'event_options', 40, true,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pavilion-item-after-10', 'after_10', 'space',
    'Use after regular close until 10:00pm (in addition to hourly rate)',
    'Request extended Pavilion use after regular closing until 10:00pm.',
    NULL, 'flat', NULL, 'event_options', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pavilion-item-after-midnight', 'after_midnight', 'space',
    'Use after regular close until Midnight (in addition to hourly rate)',
    'Request extended Pavilion use after regular closing until midnight.',
    NULL, 'flat', NULL, 'event_options', 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pavilion-item-group-sailing', 'group_sailing', 'space',
    'Group Sailing Lesson (20-40 people, Summer Only)',
    'Group sailing lessons for 20-40 people, available in summer.',
    '/assets/images/pavilion-reservation-placeholder.svg', 'flat', NULL, 'programs', 80, true,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pavilion-item-wedding-service', 'wedding_service', 'service',
    'Wedding/ Wedding Rehearsal/ Wedding Reception',
    'Special wedding package (in addition to hourly rate).',
    NULL, 'flat', NULL, NULL, 130, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO NOTHING;

-- Assign public groups for existing rows (only where still null).
UPDATE "pavilion_reservable_items"
SET "public_group" = 'venue'::"pavilion_reservable_item_public_group"
WHERE "slug" IN ('grill', 'casual_dock', 'roof_deck', 'party_boat')
  AND "kind" = 'space'
  AND "public_group" IS NULL;

UPDATE "pavilion_reservable_items"
SET "public_group" = 'event_options'::"pavilion_reservable_item_public_group"
WHERE "slug" IN ('wedding_space', 'after_10', 'after_midnight')
  AND "kind" = 'space'
  AND "public_group" IS NULL;

UPDATE "pavilion_reservable_items"
SET "public_group" = 'programs'::"pavilion_reservable_item_public_group"
WHERE "slug" IN ('lab_access', 'group_sailing')
  AND "kind" = 'space'
  AND "public_group" IS NULL;

-- Persona prices for newly inserted items only (skip if any price row already exists).
INSERT INTO "pavilion_reservable_item_prices" ("id", "item_id", "persona", "amount_cents")
SELECT prices."id", prices."item_id", prices."persona"::"pavilion_reservation_persona", prices."amount_cents"
FROM (
  VALUES
    ('pavilion-price-grill-mit_academic', 'pavilion-item-grill', 'mit_academic', 3000),
    ('pavilion-price-grill-mit_student', 'pavilion-item-grill', 'mit_student', 3000),
    ('pavilion-price-grill-mit_community', 'pavilion-item-grill', 'mit_community', 3000),
    ('pavilion-price-grill-non_mit', 'pavilion-item-grill', 'non_mit', 3000),
    ('pavilion-price-casual_dock-mit_academic', 'pavilion-item-casual-dock', 'mit_academic', 32000),
    ('pavilion-price-casual_dock-mit_student', 'pavilion-item-casual-dock', 'mit_student', 20000),
    ('pavilion-price-casual_dock-mit_community', 'pavilion-item-casual-dock', 'mit_community', 32000),
    ('pavilion-price-casual_dock-non_mit', 'pavilion-item-casual-dock', 'non_mit', 58000),
    ('pavilion-price-roof_deck-mit_academic', 'pavilion-item-roof-deck', 'mit_academic', 32000),
    ('pavilion-price-roof_deck-mit_student', 'pavilion-item-roof-deck', 'mit_student', 20000),
    ('pavilion-price-roof_deck-mit_community', 'pavilion-item-roof-deck', 'mit_community', 32000),
    ('pavilion-price-roof_deck-non_mit', 'pavilion-item-roof-deck', 'non_mit', 61000),
    ('pavilion-price-party_boat-mit_academic', 'pavilion-item-party-boat', 'mit_academic', 13000),
    ('pavilion-price-party_boat-mit_student', 'pavilion-item-party-boat', 'mit_student', 13000),
    ('pavilion-price-party_boat-mit_community', 'pavilion-item-party-boat', 'mit_community', 13000),
    ('pavilion-price-party_boat-non_mit', 'pavilion-item-party-boat', 'non_mit', 13000),
    ('pavilion-price-lab_access-mit_academic', 'pavilion-item-lab-access', 'mit_academic', NULL),
    ('pavilion-price-lab_access-mit_student', 'pavilion-item-lab-access', 'mit_student', NULL),
    ('pavilion-price-lab_access-mit_community', 'pavilion-item-lab-access', 'mit_community', NULL),
    ('pavilion-price-lab_access-non_mit', 'pavilion-item-lab-access', 'non_mit', NULL),
    ('pavilion-price-wedding_space-mit_academic', 'pavilion-item-wedding-space', 'mit_academic', NULL),
    ('pavilion-price-wedding_space-mit_student', 'pavilion-item-wedding-space', 'mit_student', 65000),
    ('pavilion-price-wedding_space-mit_community', 'pavilion-item-wedding-space', 'mit_community', 65000),
    ('pavilion-price-wedding_space-non_mit', 'pavilion-item-wedding-space', 'non_mit', 82500),
    ('pavilion-price-after_10-mit_academic', 'pavilion-item-after-10', 'mit_academic', NULL),
    ('pavilion-price-after_10-mit_student', 'pavilion-item-after-10', 'mit_student', 32500),
    ('pavilion-price-after_10-mit_community', 'pavilion-item-after-10', 'mit_community', 41000),
    ('pavilion-price-after_10-non_mit', 'pavilion-item-after-10', 'non_mit', 57500),
    ('pavilion-price-after_midnight-mit_academic', 'pavilion-item-after-midnight', 'mit_academic', NULL),
    ('pavilion-price-after_midnight-mit_student', 'pavilion-item-after-midnight', 'mit_student', 58500),
    ('pavilion-price-after_midnight-mit_community', 'pavilion-item-after-midnight', 'mit_community', 65000),
    ('pavilion-price-after_midnight-non_mit', 'pavilion-item-after-midnight', 'non_mit', 77500),
    ('pavilion-price-group_sailing-mit_academic', 'pavilion-item-group-sailing', 'mit_academic', 350000),
    ('pavilion-price-group_sailing-mit_student', 'pavilion-item-group-sailing', 'mit_student', 350000),
    ('pavilion-price-group_sailing-mit_community', 'pavilion-item-group-sailing', 'mit_community', 350000),
    ('pavilion-price-group_sailing-non_mit', 'pavilion-item-group-sailing', 'non_mit', 450000),
    ('pavilion-price-wedding_service-mit_academic', 'pavilion-item-wedding-service', 'mit_academic', NULL),
    ('pavilion-price-wedding_service-mit_student', 'pavilion-item-wedding-service', 'mit_student', 65000),
    ('pavilion-price-wedding_service-mit_community', 'pavilion-item-wedding-service', 'mit_community', 65000),
    ('pavilion-price-wedding_service-non_mit', 'pavilion-item-wedding-service', 'non_mit', 82500)
) AS prices("id", "item_id", "persona", "amount_cents")
WHERE EXISTS (
  SELECT 1 FROM "pavilion_reservable_items" i WHERE i."id" = prices."item_id"
)
AND NOT EXISTS (
  SELECT 1 FROM "pavilion_reservable_item_prices" p WHERE p."item_id" = prices."item_id"
);

-- Fallback group for any remaining visible spaces without a group (legacy/custom rows).
UPDATE "pavilion_reservable_items"
SET "public_group" = 'event_options'::"pavilion_reservable_item_public_group"
WHERE "kind" = 'space'
  AND "public_group" IS NULL;

ALTER TABLE "pavilion_reservable_items"
  VALIDATE CONSTRAINT "pavilion_reservable_items_public_group_kind_check";
