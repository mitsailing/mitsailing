# Pavilion reservation incomplete draft + abandon email

Date: 2026-08-28  
Status: draft (awaiting review)  
Worktree: pavilion-spaces-admin

## Problem

Browser `localStorage` saves progress on one device only. Staff cannot see incomplete requests. Guests who leave mid-wizard get no resume path.

## Goals

1. Persist in-progress pavilion wizard state in **Postgres** on the **existing** `PavilionReservationRequest` table once a valid requester email exists (staff can follow up).
2. Email one **resume link** if the guest does not submit within **1 hour of last save**.
3. Use a new request **status** (`draft`) so incomplete work is visible beside real requests — without treating drafts as actionable `pending` work.

## Non-goals

- A separate `PavilionReservationDraft` table
- Multi-nudge drip, SMS, marketing automation
- Email-based public resume (resume only via opaque `resumeToken`)
- Approving/declining drafts as if they were submitted
- Inngest / Vercel cron / GitHub Actions for this delay

## Decision summary

| Topic | Choice |
|--------|--------|
| Storage | **Same table:** `PavilionReservationRequest` (+ slots/services as today) |
| Status | Add enum value **`draft`** (not `pending`) |
| Upsert gate | Valid `requesterEmail` |
| Client → server | Debounced server action (~3s) after meaningful changes |
| Abandon delay | **1 hour after last `updatedAt`** (sliding BullMQ job) |
| Resume URL | `/reserve?resume=<token>` |
| Token | Opaque `resumeToken` column on the request (unique) |
| Client token storage | **`sessionStorage`** for same-tab refresh only; cross-device via email link |
| Public resume auth | **`resumeToken` only** — no email lookup on public routes |
| On submit | Same row: `draft` → `pending`, promote by `resumeToken`, enqueue existing submitted email |

## Why not a separate table (per product)

One place for staff to follow up: incomplete and submitted live in pavilion reservations. Status distinguishes lifecycle.

## Status semantics

| Status | Meaning |
|--------|---------|
| `draft` | In-progress wizard; may be incomplete; abandon email eligible |
| `pending` | Guest submitted; staff must act |
| `needs_info` / `approved` / … | Unchanged post-submit pipeline |

**Hard rules**

- Default admin list / schedule conflict logic that today treats `pending` as “real” must **not** treat `draft` the same way (no holding inventory like approved).
- Status emails / approve actions must refuse `draft`.
- Only `draft` → `pending` transition comes from public submit (not admin “approve”).

## Schema changes (same table)

On `PavilionReservationRequest`:

- `status` enum adds `draft`
- `resumeToken String? @unique` — set while `draft`; cleared on submit
- `abandonEmailSentAt DateTime?`

**Incomplete required columns:** existing model requires `firstName`, `lastName`, `phone`, `eventName`, `description`, etc. For drafts:

- Upsert with **empty-string / false defaults** for unset contact fields (same as empty wizard state).
- Slots/services: replace child rows on each upsert from JSON payload (delete+create in transaction for that request id), or allow zero slots.

`referenceCode`: still unique. For drafts assign a provisional code such as `DRAFT-XXXXXX` (or keep `PAV-` but only treat as official after submit). Prefer **`DRAFT-…` while draft**, rewrite to `PAV-…` on submit so public confirmation codes stay meaningful — **or** allocate `PAV-…` immediately and keep it through submit (simpler). **v1 choice: allocate `PAV-…` on first draft upsert and keep it** so resume and staff share one code; UI copy for drafts says “incomplete request” not “confirmed.”

## Upsert flow

1. Wizard localStorage write when email valid (unchanged).
2. Debounced `upsertPavilionReservationDraftAction` with payload + optional `requestId`.
3. Server: if `requestId` exists and `status === draft` and email matches → update fields/slots; else create `status: draft` request.
4. Ensure `resumeToken` present (generate on create).
5. Enqueue/replace BullMQ job `pavilion-reservation-abandon-email` with `jobId: pavilion-reservation-abandon-email-${requestId}`, `delay: 3_600_000`.

## Abandon email job

1. Load request by id.
2. Skip unless `status === draft`, not expired, `abandonEmailSentAt` null.
3. Send resume link `${APP_URL}/reserve?resume=${resumeToken}` via `sendTransactional` + React Email.
4. Set `abandonEmailSentAt`.
5. v1: at most one abandon email even if they edit again later.

## Resume flow

1. `/reserve?resume=<token>` loads request where `resumeToken` matches and `status === draft`.
2. Map request + slots + services → wizard initial state (server seed wins over localStorage).
3. `replaceState` to drop token from the URL after hydrate.

## Submit interaction

`submitPavilionReservationRequestAction` when `requestId` / resume context is a draft:

- Validate full payload as today.
- Update same row: contact, slots, services, `status: pending`, clear `resumeToken`, set estimates.
- Enqueue existing submitted-email job (unchanged).
- Abandon job no-ops (`status !== draft`).

If no draft id: create `pending` as today (guest never got a server draft).

## Staff follow-up

- Admin pavilion list: filter **Incomplete (`draft`)**.
- Show email, updated time, slot count, whether abandon email sent, reference code.
- No approve/decline on drafts; optional “open” read-only detail.

## Testing

- Upsert creates/updates `draft` only
- Admin default queries exclude `draft`
- Job skips non-draft / already-sent / submitted
- Resume hydrates wizard
- Submit promotes `draft` → `pending` and sends confirmation email once

## Resolved

- Delay: **1 hour after last save**
- Storage: **same table + `draft` status** (no separate draft table) — user direction 2026-08-28
