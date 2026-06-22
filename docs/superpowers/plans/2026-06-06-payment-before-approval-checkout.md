# Payment Before Approval Checkout Implementation Plan

## Goal

Paid event registrations must collect payment as soon as the registration is submitted, even when the event requires approval and the registration starts as pending. Paid Racing and Team Racing onboarding must also be able to collect payment while the sailing-card request is pending, but payment must not issue or clear the sailing card by itself.

## Product Semantics

- Event registration payment can be made before approval.
- Paid Racing and Team Racing users can pay during onboarding.
- A paid Racing or Team Racing payment does not automatically give the user a sailing card.
- After payment, the user still needs to go to the Pavilion with ID so staff can approve, assign, and print the sailing card.
- Existing hosted Stripe Checkout is the payment surface; this branch does not add an inline card form.

## Implementation Tasks

1. Create event payment snapshots for paid registrations whenever a payable fee exists, regardless of whether the registration is `pending` or `approved`.
2. Let the event checkout page find the latest pending or approved registration payment for the signed-in user.
3. Let existing pending paid Racing and Team Racing sailing-card requests start or resume Checkout from onboarding without treating payment as card approval or issuance.
4. Keep the existing admin issuing/payment-blocker behavior intact.
5. Update admin event copy so payment collection is described as registration-level, not approved-registration-only.
6. Add focused regression tests for:
   - pending paid event registration creates a payment and redirects to checkout,
   - checkout lookup includes pending registrations,
   - pending paid Racing/Team Racing requests can start Checkout when unpaid,
   - already-paid Racing/Team Racing requests do not create a second Checkout.
7. Run focused tests, static checks, and CodeRabbit CLI review before commit/push.

## Stripe References

- Stripe Checkout docs: use Checkout Sessions for one-time payments, hosted or embedded Checkout UI, local identifiers in metadata, and `session_id={CHECKOUT_SESSION_ID}` return URLs.
- Stripe fulfillment docs: webhook status remains the durable source of payment state; return pages may check the Checkout Session for immediate user feedback.
- Stripe-owned GitHub samples checked: `stripe-samples/checkout-one-time-payments` and `stripe-samples/accept-a-payment`. Both keep card collection in Stripe Checkout and create sessions server-side.

## Verification

- Focused Vitest files for event registration, event checkout query, and sailing-card onboarding action.
- `npm run lint`
- `npm run check:types`
- `npm run check:i18n`
- `git diff --check`
- `coderabbit review --agent -t uncommitted -c AGENTS.md`

## Infrastructure

Using existing local `AdminPagination`, `AdminDataRows`, and `paymentDisplay` because admin lists are app-specific and already established in this codebase; no third-party table engine was added for this slice.
