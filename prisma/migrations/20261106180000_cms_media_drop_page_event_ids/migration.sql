-- DropForeignKey
ALTER TABLE "cms_media_assets" DROP CONSTRAINT IF EXISTS "cms_media_assets_page_id_fkey";

-- DropForeignKey
ALTER TABLE "cms_media_assets" DROP CONSTRAINT IF EXISTS "cms_media_assets_event_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "cms_media_assets_page_id_created_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "cms_media_assets_event_id_created_at_idx";

-- AlterTable
ALTER TABLE "cms_media_assets" DROP COLUMN IF EXISTS "page_id";

-- AlterTable
ALTER TABLE "cms_media_assets" DROP COLUMN IF EXISTS "event_id";
