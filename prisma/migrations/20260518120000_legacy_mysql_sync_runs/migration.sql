CREATE TYPE "legacy_mysql_sync_status" AS ENUM ('running', 'succeeded', 'failed', 'skipped');

CREATE TABLE "legacy_mysql_sync_runs" (
  "id" TEXT NOT NULL,
  "status" "legacy_mysql_sync_status" NOT NULL,
  "source_host" TEXT NOT NULL,
  "source_database" TEXT NOT NULL,
  "table_count" INTEGER NOT NULL DEFAULT 0,
  "row_count" BIGINT NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),

  CONSTRAINT "legacy_mysql_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "legacy_mysql_sync_runs_status_started_at_idx"
  ON "legacy_mysql_sync_runs" ("status", "started_at");
