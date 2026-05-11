CREATE TYPE "cms_block_kind" AS ENUM ('hero', 'text_section', 'callout');

CREATE TYPE "cms_menu_location" AS ENUM (
  'header',
  'mobile_utility',
  'footer',
  'legal',
  'social'
);

CREATE TABLE "cms_pages" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "meta_title" TEXT,
  "meta_description" TEXT,
  "is_published" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cms_page_blocks" (
  "id" TEXT NOT NULL,
  "page_id" TEXT NOT NULL,
  "kind" "cms_block_kind" NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "body" TEXT,
  "cta_label" TEXT,
  "cta_url" TEXT,
  "image_src" TEXT,
  "image_alt" TEXT,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "is_visible" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cms_page_blocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cms_menus" (
  "id" TEXT NOT NULL,
  "location" "cms_menu_location" NOT NULL,
  "title" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cms_menus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cms_menu_items" (
  "id" TEXT NOT NULL,
  "menu_id" TEXT NOT NULL,
  "parent_id" TEXT,
  "linked_page_id" TEXT,
  "label" TEXT NOT NULL,
  "url" TEXT,
  "is_external" BOOLEAN NOT NULL DEFAULT false,
  "is_visible" BOOLEAN NOT NULL DEFAULT true,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "system_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cms_menu_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cms_pages_slug_key" ON "cms_pages"("slug");
CREATE UNIQUE INDEX "cms_pages_path_key" ON "cms_pages"("path");
CREATE INDEX "cms_pages_is_published_path_idx" ON "cms_pages"("is_published", "path");

CREATE INDEX "cms_page_blocks_page_id_display_order_idx" ON "cms_page_blocks"("page_id", "display_order");

CREATE UNIQUE INDEX "cms_menus_location_key" ON "cms_menus"("location");

CREATE INDEX "cms_menu_items_menu_id_parent_id_display_order_idx" ON "cms_menu_items"("menu_id", "parent_id", "display_order");
CREATE INDEX "cms_menu_items_linked_page_id_idx" ON "cms_menu_items"("linked_page_id");

ALTER TABLE "cms_page_blocks"
  ADD CONSTRAINT "cms_page_blocks_page_id_fkey"
  FOREIGN KEY ("page_id") REFERENCES "cms_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cms_menu_items"
  ADD CONSTRAINT "cms_menu_items_menu_id_fkey"
  FOREIGN KEY ("menu_id") REFERENCES "cms_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cms_menu_items"
  ADD CONSTRAINT "cms_menu_items_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "cms_menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cms_menu_items"
  ADD CONSTRAINT "cms_menu_items_linked_page_id_fkey"
  FOREIGN KEY ("linked_page_id") REFERENCES "cms_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
