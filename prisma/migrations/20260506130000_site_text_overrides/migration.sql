CREATE TABLE "site_text_overrides" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_text_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "site_text_overrides_locale_namespace_key_key" ON "site_text_overrides"("locale", "namespace", "key");
CREATE INDEX "site_text_overrides_locale_idx" ON "site_text_overrides"("locale");
CREATE INDEX "site_text_overrides_updated_by_user_id_idx" ON "site_text_overrides"("updated_by_user_id");

ALTER TABLE "site_text_overrides" ADD CONSTRAINT "site_text_overrides_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
