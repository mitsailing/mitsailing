# Pricing Page Redesign Design

## Problem

The current `/pricing` page explains membership policy instead of helping a visitor decide what to do. It overloads users with all pricing dimensions at once: MIT status, MIT Recreation status, student status, age, July 15 timing, card type, and access differences. That creates the exact confusion this project is meant to remove.

The pricing page must behave like a modern business pricing page: segment the user first, show the relevant plans, then put detailed comparison and edge cases below the decision UI.

## Goal

Help a first-time visitor answer this in under 10 seconds:

> Which sailing card should I get, and what will it cost me?

## Non-Goals

- Do not explain Mashnee on `/pricing`.
- Do not teach the full MIT Sailing membership model.
- Do not show every audience and every price in one giant chart.
- Do not use age as top-level navigation.
- Do not send guests directly to `/onboarding`.
- Do not add payment integration or MIT Recreation signup automation.

## Success Criteria

- Top-level pricing navigation has no more than 3 tabs.
- Paid-card pricing uses the labels `Non-MIT student`, `Non-student under 30`, and `Non-student 30+`.
- `MIT student` does not appear as a paid-card pricing category.
- A guest primary CTA is `Create account` and links to `/signup?callbackUrl=/onboarding`.
- A signed-in primary CTA is `Start sailing card` and links to `/onboarding`.
- Mashnee does not appear anywhere on `/pricing`.
- Paid-card prices are visible without reading paragraph copy.
- The page uses plan cards for choices and a compact table only for exact paid-card prices.
- Mobile presents the same decision structure without horizontal scrolling for the primary plan cards.

## Information Architecture

### Hero

Use a short heading and one sentence. No policy paragraph.

```text
Sailing card pricing
Choose your status. Prices update below.
```

Primary CTA in the hero:

- Guest: `Create account`
- Signed in: `Start sailing card`

Secondary CTA:

- `MIT Recreation rates`

### Status Tabs

Use 3 tabs:

```text
MIT student
MIT Recreation member
No MIT Recreation
```

These tabs are about the user's current status, not age or pricing category. Age appears only inside the paid-card price table.

### Tab: MIT student

Show one recommended plan card.

```text
Normal
Included

For current MIT students.
Includes Pavilion sailing, classes, ratings, and Charles River racing.

[Create account] or [Start sailing card]
```

Below it, show two muted cards or rows:

```text
Pavilion racing
Covered by Normal

Thursday team racing
Covered by Normal
```

Do not show paid prices in this tab.

### Tab: MIT Recreation member

Show one recommended plan card.

```text
Normal
Included

For active MIT Recreation members.
Includes Pavilion sailing, classes, ratings, and Charles River racing.

[Create account] or [Start sailing card]
```

Below it, show:

```text
Pavilion racing
Covered by Normal

Thursday team racing
Covered by Normal
```

Do not show paid prices in this tab.

### Tab: No MIT Recreation

Show two paid plan cards first.

```text
Pavilion racing
$25-$175
Charles River racing and race-related classes.

Thursday team racing
$25-$100
Thursday night team racing only. Not MIT Sailing Team.
```

Then show a compact exact-price table.

```text
Paid-card prices

                         Non-MIT student   Non-student under 30   Non-student 30+
Pavilion before July 15  $25               $70                    $100
Pavilion July 15+        $40               $125                   $175
Thursday team racing     $25               $70                    $100
```

Then show the Normal path as a secondary option.

```text
Want Normal?
Join MIT Recreation first.

[MIT Recreation rates]
```

Do not show a Normal paid price. The value is `Requires MIT Recreation`.

## Copy Rules

- Use `Normal`, `Pavilion racing`, and `Thursday team racing`.
- Use `Non-MIT student`, not `MIT student`, in paid-card charts.
- Use `30+`, not `over 30`.
- Use `under 30`, not `29 or younger`, unless a legal/product source requires the latter.
- Use `Included`, `Covered by Normal`, and `Requires MIT Recreation` as status labels.
- Keep body copy to one short sentence per card.
- Put details below the decision UI, not in the hero.

## Component Structure

Keep implementation small and testable:

- `PricingPageView.tsx`: page composition and auth-aware CTA props.
- `PricingStatusTabs.tsx`: client component for the tabs and selected status.
- `PricingPlanCard.tsx`: reusable plan card.
- `PricingPaidTable.tsx`: paid-card exact price table.
- `PricingPageView.test.tsx`: tests copy, CTA hrefs, and absence of Mashnee.

If adding files creates too much churn, keep helper components in `PricingPageView.tsx` for the first pass, but still preserve these boundaries as functions.

## CTA Behavior

`PricingPageView` receives an `isSignedIn` boolean from the server page.

Guest:

```text
Create account -> /signup?callbackUrl=/onboarding
```

Signed in:

```text
Start sailing card -> /onboarding
```

MIT Recreation rates:

```text
MIT Recreation rates -> https://www.mitrecsports.com/join/memberships/
```

## Test Plan

Add or update component tests to verify:

- The page renders the 3 status tabs.
- The `MIT student` tab shows `Normal` as `Included`.
- The `MIT Recreation member` tab shows `Normal` as `Included`.
- The `No MIT Recreation` tab shows paid cards and the exact price table.
- The paid table headers are `Non-MIT student`, `Non-student under 30`, and `Non-student 30+`.
- The paid table does not show `MIT student`.
- The page does not render `Mashnee`.
- Guest CTA links to `/signup?callbackUrl=%2Fonboarding`.
- Signed-in CTA links to `/onboarding`.

## Impeccable Review Targets

The finished page must be reviewed against:

- `clarify`: no ambiguous labels, no jargon-first copy.
- `layout`: plan cards first, exact-price table second.
- `onboard`: user picks status before comparing details.
- `polish`: no dense text blocks, clean hierarchy, consistent tokens.
- `adapt`: usable mobile layout without primary horizontal scrolling.
- `harden`: auth-aware CTAs and no hidden eligibility traps.
