-- Replace polymorphic target_type/target_id with concrete nullable FKs.
ALTER TABLE "sailing_rating_rules" ADD COLUMN "boat_id" TEXT;
ALTER TABLE "sailing_rating_rules" ADD COLUMN "class_id" TEXT;
ALTER TABLE "sailing_rating_rules" ADD COLUMN "rating_id" TEXT;

UPDATE "sailing_rating_rules"
SET
  "boat_id" = CASE WHEN "target_type" = 'boat' THEN "target_id" ELSE NULL END,
  "class_id" = CASE WHEN "target_type" = 'class' THEN "target_id" ELSE NULL END,
  "rating_id" = CASE WHEN "target_type" = 'rating' THEN "target_id" ELSE NULL END;

DROP INDEX "sailing_rating_rules_composite_uq";
DROP INDEX "sailing_rating_rules_target_type_target_id_rule_type_idx";

ALTER TABLE "sailing_rating_rules" DROP COLUMN "target_type";
ALTER TABLE "sailing_rating_rules" DROP COLUMN "target_id";

DROP TYPE "sailing_rating_rule_target_type";

CREATE UNIQUE INDEX "sailing_rating_rules_boat_uq" ON "sailing_rating_rules"("boat_id", "rule_type", "group_key", "sailing_rating_id");
CREATE UNIQUE INDEX "sailing_rating_rules_class_uq" ON "sailing_rating_rules"("class_id", "rule_type", "group_key", "sailing_rating_id");
CREATE UNIQUE INDEX "sailing_rating_rules_rating_uq" ON "sailing_rating_rules"("rating_id", "rule_type", "group_key", "sailing_rating_id");
CREATE INDEX "sailing_rating_rules_boat_id_rule_type_idx" ON "sailing_rating_rules"("boat_id", "rule_type");
CREATE INDEX "sailing_rating_rules_class_id_rule_type_idx" ON "sailing_rating_rules"("class_id", "rule_type");
CREATE INDEX "sailing_rating_rules_rating_id_rule_type_idx" ON "sailing_rating_rules"("rating_id", "rule_type");

ALTER TABLE "sailing_rating_rules" ADD CONSTRAINT "sailing_rating_rules_exactly_one_target_chk" CHECK (
  (("boat_id" IS NOT NULL)::int + ("class_id" IS NOT NULL)::int + ("rating_id" IS NOT NULL)::int) = 1
);

ALTER TABLE "sailing_rating_rules" ADD CONSTRAINT "sailing_rating_rules_boat_id_fkey" FOREIGN KEY ("boat_id") REFERENCES "fleet_boats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sailing_rating_rules" ADD CONSTRAINT "sailing_rating_rules_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "sailing_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sailing_rating_rules" ADD CONSTRAINT "sailing_rating_rules_rating_id_fkey" FOREIGN KEY ("rating_id") REFERENCES "sailing_ratings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
