# Pricing Page Tailwind Plus Source

The pricing page keeps MIT Sailing's original comparison-chart information architecture and uses Tailwind Plus pricing-card structure for the mobile plan cards.

## Source Blocks

- Mobile card layout: `/Users/andrewkelley/Downloads/marketing-v4/react/sections/pricing/11-four-tiers-with-toggle.jsx`
- Desktop comparison reference: `/Users/andrewkelley/Downloads/marketing-v4/react/sections/pricing/12-with-comparison-table.jsx`
- Alternate local export: `/Users/andrewkelley/GitHub/marketing-v4 3/react/sections/pricing/`
- Tailwind Plus docs: `https://tailwindcss.com/plus/ui-blocks/documentation/llms.txt`

The docs URL may require Tailwind Plus access. If command-line fetches return 403, use the local `marketing-v4` folder as the source of truth.

## Local Files

- `src/components/mit-sailing/pricing/PricingPageView.tsx`: MIT Sailing pricing content, Tailwind Plus-style mobile cards, desktop comparison chart, and MIT Recreation modal.
- `src/locales/en.json`: `PricingPage` strings.
- `src/components/mit-sailing/pricing/PricingPageView.test.tsx`: pricing behavior and copy coverage.
- `src/components/mit-sailing/pricing/PricingPageView.stories.tsx`: browser/story coverage.

## Update Process

1. Pull or replace the local `marketing-v4` folder with the current Tailwind Plus export.
2. Compare the source block against `PricingPageView.tsx`.
3. Preserve the four MIT Sailing choices, paid categories, CTAs, and desktop class/checkoff comparison.
4. Keep MIT Sailing tokens, shared `Button`, `Link`, i18n keys, and accessibility labels.
5. Do not copy demo business copy, raw Tailwind colors, or Heroicons imports unless the repo adds that package.
6. Verify `/pricing` on desktop, mobile, and dark mode after changing the block.
7. Run `npm run test -- src/components/mit-sailing/pricing/PricingPageView.test.tsx`, `npm run check:i18n`, `npm run check:types`, and `npm run lint`.
