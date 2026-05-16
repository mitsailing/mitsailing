UPDATE "cms_page_blocks"
SET "cta_url" = '/reserve'
WHERE "id" = 'cms-block-home-rental'
  AND "cta_url" = '/reserve-pavilion';

UPDATE "cms_menu_items"
SET "url" = '/reserve'
WHERE "id" = 'cms-menu-mobile-reserve'
  AND "url" = '/reserve-pavilion';
