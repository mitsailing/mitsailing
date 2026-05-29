# Membership payment admin status design

Last updated: 2026-05-29

## Goal

Give members and staff one clear source of truth for paid racing and team-racing payment/access status in V1, including Stripe payments, legacy payments from the old system, and explicit staff payment-bypass decisions.

## Non-goals

- Do not build a generic user notes system.
- Do not build a generic admin search framework.
- Do not build an adapter framework, repository layer, or clever polymorphic abstraction.
- Do not represent legacy payments as Stripe charges, invoices, receipt URLs, Checkout sessions, or portal-managed subscriptions.
- Do not auto-issue Sailing Card numbers from onboarding or payment completion.
- Do not add new permissions for the V1 paid-card-without-payment override.

## Design

Use one payment table for all staff-visible money movement in V1:

- broaden the existing event payment storage into one `Payment` model/table;
- add a simple `purpose` value such as `event` or `membership`;
- keep event-specific fields nullable and required by database checks only for `purpose = event`;
- keep membership-specific fields nullable and required by database checks only for `purpose = membership`;
- keep one status enum and one Stripe id/receipt column set.

This is intentionally not an abstraction layer. It is one table with plain columns, simple check constraints, and code paths that branch on `purpose`. Junior developers should be able to open the model and understand that event rows use the event fields, membership rows use the membership fields, and all rows appear in the same admin payment history.

Membership rows include a source discriminator such as `stripe`, `legacy`, or `admin_override`. Stripe-specific fields stay nullable and empty for legacy/admin rows. Legacy payments count as paid for the covered card year or season when confidently matched to a user.

Stripe sync stays centralized. The existing Stripe webhook route records Stripe webhook idempotency once and updates the same `Payment` table. Stripe metadata includes `purpose` and `paymentId`; the webhook code uses a plain switch for event-only receipt notification behavior versus membership subscription behavior.

Legacy-paid members see a normal paid state labeled "paid through legacy system" on their dashboard/status. They do not get a Stripe receipt link. They may see a non-blocking prompt to add payment information and set up Stripe auto-renew for the next July 15 renewal. That prompt must not charge them for the current covered season and must not block current-season card issuance.

Unmatched or ambiguous legacy payments go to an admin review list or report. They do not grant access until staff resolves the match.

## Admin User Page

`/admin/users/[id]` gets one current-status/blockers area near the top. It covers current card-issuance blockers such as payment issues, MIT Recreation verification, intro-class prerequisites, and payment-bypass state. The top area is informational and navigational only: it links or focuses the owning section, but does not contain remediation controls.

Payment issue handled notes stay on the specific membership payment issue record. The user page surfaces the latest/current relevant issue summary so staff can see why paid access is blocked or why it was cleared.

The user page also gets a simple payment history section for staff. It shows successful and unsuccessful payments for that user across payment purposes, including existing event payments/deposits and membership payments. This reads from the shared `Payment` table, includes the purpose label, and links back to the owning record when possible.

## Pending Queue

`/admin/cards` continues to show all pending Sailing Card/onboarding requests. Add client-side JavaScript filtering over the loaded pending rows by name, email, and MIT ID so staff can find a person at the pavilion without a full page reload.

Preserve the card-number rule: blank/auto assignment starts at 60, but staff with card assignment permission can manually assign any positive card number that is not already assigned for that card year.

## Payment Bypass

V1 includes a narrow "issue paid card without payment" path in the existing card issuance flow. It uses the existing `CARDS_ASSIGN_NUMBER` permission, requires an internal reason note, and records who, when, why, card type, card year, and issued card number on the Sailing Card request approval/issuance path.

This is not a generic waiver system. It is the simplest staff override for real pavilion exceptions.

## Testing

Cover:

- legacy payment shows as paid with no Stripe receipt link;
- legacy-paid member gets an optional future auto-renew setup prompt without losing current access;
- unmatched legacy payments do not grant access;
- admin user page shows current blockers/status with links or focus targets only;
- pending queue filters by name, email, and MIT ID without a page reload;
- manual card number `110` can be assigned when unused for the year;
- duplicate card number for the same year is rejected;
- paid-card-without-payment override requires a reason note and records admin/time details.

## Approval

Approved in chat on 2026-05-29 as the simplest V1 design.
