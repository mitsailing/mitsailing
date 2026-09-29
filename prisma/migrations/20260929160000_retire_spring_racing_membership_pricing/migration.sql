-- Stop selling spring membership prices. Existing rows stay for payment history.
UPDATE "sailing_card_membership_prices"
SET active = false
WHERE "price_kind" = 'spring'
  AND active = true;

-- Drop the Spring racing card from the seeded homepage pricing block when present.
UPDATE "cms_page_blocks"
SET body = (
  jsonb_set(
    body::jsonb,
    '{plans}',
    (
      SELECT COALESCE(jsonb_agg(plan ORDER BY ordinality), '[]'::jsonb)
      FROM jsonb_array_elements(body::jsonb->'plans')
        WITH ORDINALITY AS plans(plan, ordinality)
      WHERE plan->>'title' IS DISTINCT FROM 'Spring racing card'
    )
  )
)::text
WHERE id = 'cms-block-home-membership-pricing'
  AND body IS NOT NULL
  AND body::jsonb ? 'plans';
