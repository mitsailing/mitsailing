# Pavilion reservation draft status + abandon email

> **For agentic workers:** Implement task-by-task from the approved spec `docs/superpowers/specs/2026-08-28-pavilion-reservation-draft-abandon-email-design.md`.

**Goal:** Persist incomplete `/reserve` progress on `PavilionReservationRequest` with `status=draft`, email a resume link 1 hour after last save, promote to `pending` on submit.

**Architecture:** Same table + existing `status` enum (`draft` added). BullMQ delayed job slides on upsert. Resume via `/reserve?resume=<token>`.

**Tech Stack:** Prisma, Next.js Server Actions, BullMQ, sendTransactional, React Email, next-intl.

---

### Task 1: Schema
- Add `draft` to `PavilionReservationStatus`
- Add `resumeToken`, `abandonEmailSentAt` (no `draftExpiresAt`)
- Migration + zenstack sync if required

### Task 2: Upsert + submit promote
- `upsertPavilionReservationDraftAction`
- Submit path: draft → pending when `requestId` present

### Task 3: Abandon email job
- Mirror submitted email job; delay 1h; jobId per request

### Task 4: Wizard + resume page
- Debounced upsert; seed from resume token

### Task 5: Admin
- Exclude `draft` from default list; Incomplete filter

### Task 6: Tests
- Unit/worker/action coverage; Codacy on edits
