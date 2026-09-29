-- Deprecated sailing ratings are no longer a product concept.
-- Existing user_sailing_ratings grants stay attached to their ratings.
ALTER TABLE "sailing_ratings" DROP COLUMN "is_deprecated";
