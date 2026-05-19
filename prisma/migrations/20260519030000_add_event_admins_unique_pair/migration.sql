WITH ranked_event_admins AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "event_id", "admin_user_id"
      ORDER BY "id" ASC
    ) AS duplicate_rank
  FROM "event_admins"
)
DELETE FROM "event_admins" AS event_admin
USING ranked_event_admins
WHERE event_admin."id" = ranked_event_admins."id"
  AND ranked_event_admins.duplicate_rank > 1;

-- CreateIndex
CREATE UNIQUE INDEX "event_admins_event_id_admin_user_id_key" ON "event_admins"("event_id", "admin_user_id");
