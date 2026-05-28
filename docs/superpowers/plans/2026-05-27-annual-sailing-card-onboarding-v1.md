# Annual Sailing Card Onboarding V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish annual sailing-card onboarding V1 with one current-year request row per user, exact legal evidence linkage, and a single-page React Hook Form review form.

**Architecture:** Keep durable reusable profile facts on `User`, move annual request state into `SailingCardRequest`, and link each request to the exact append-only `LegalAgreementAcceptance` created by the latest submit. Route guards, admin queues, and card issuance read the current-year request instead of `User.sailingCardRequestedAt`; legacy user card fields remain only for issued-card compatibility in this slice.

**Tech Stack:** Next.js App Router and Server Actions, React Hook Form 7, Prisma/ZenStack/Postgres, next-intl, Vitest, Playwright, existing MIT Sailing UI tokens, no new UI/form/legal packages.

---

## Current Red Checks

- `npm run test -- src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx src/libs/mit-sailing/sailingCardOnboardingActions.test.ts`
  - Action tests fail because server-validation state now preserves submitted `values`; tests must assert that behavior.
  - Component tests fail because the RHF conversion is incomplete (`useState` is referenced but not imported) and inputs are not registered through RHF.

## File Structure

- Modify `zenstack/schema.zmodel`, `prisma/schema.prisma`, and `prisma/migrations/20260521000000_add_sailing_card_onboarding/migration.sql`: add `SailingCardRequestStatus`, `SailingCardType`, and `SailingCardRequest` with `@@unique([userId, cardYear])`, `legalAgreementAcceptanceId`, profile snapshot fields, and current-issued-card reference fields.
- Regenerate `src/generated/prisma/*` and `zenstack/*` through existing repo workflow.
- Modify `src/libs/mit-sailing/sailingCardValidity.ts` and tests: compute current-year onboarding completion from a current-year request with linked legal evidence and required profile facts.
- Modify `src/libs/mit-sailing/sailingCardOnboarding.ts` and tests: include `cardType`, `dateOfBirth`, emergency email, profile update data, and request upsert data.
- Modify `src/libs/mit-sailing/sailingCardOnboardingActions.ts` and tests: create legal evidence and upsert the current-year request in one transaction; preserve returned form values after validation errors.
- Modify `src/app/[locale]/(marketing)/(site)/onboarding/page.tsx`: prefill from `User`, redirect complete current-year onboarding to success, and pass defaults into the form.
- Modify `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.tsx` and tests: finish RHF registration, field order, card type options, DOB/contact grouping, emergency grouping, locked verified names, and server error preservation.
- Modify `src/libs/admin/cards/*`, `src/components/mit-sailing/admin/cards/*`, and tests: queue latest current-year requests; issue card only when request has linked legal acceptance; set request status/issued fields when issuing.
- Modify `tests/e2e/Auth.e2e.ts`, `tests/e2e/Onboarding.e2e.ts`, and helpers: signup verification routes new users to `/onboarding`; manual onboarding required flow works; completed current-year request goes to success; stale prior-year pending request requires onboarding again.
- Modify `src/locales/en.json`: add missing labels/errors for card type, date of birth, emergency email, grouping headings, and success/queue copy.

## Task 1: Annual Request Schema

- [ ] Add failing schema tests in `src/libs/mit-sailing/sailingCardRequestSchema.test.ts` that assert `SailingCardRequest` exists, has `userId`, `cardYear`, `status`, `cardType`, `legalAgreementAcceptanceId`, `@@unique([userId, cardYear])`, and relations to `User` and `LegalAgreementAcceptance`.
- [ ] Run `npm run test -- src/libs/mit-sailing/sailingCardRequestSchema.test.ts`; expected: fail until schema exists.
- [ ] Add enums/models to ZenStack and Prisma, and update the existing onboarding migration because this branch has not merged yet.
- [ ] Regenerate generated Prisma/ZenStack output through `npm run build-local` if needed for types.
- [ ] Re-run the schema test.

## Task 2: Request-Based Completion

- [ ] Add failing tests in `src/libs/mit-sailing/sailingCardValidity.test.ts` for current-year pending request completing onboarding, prior-year pending request not completing onboarding after cutoff, and linked legal evidence being required.
- [ ] Run `npm run test -- src/libs/mit-sailing/sailingCardValidity.test.ts`; expected: fail on request-based cases.
- [ ] Replace completion/status helpers with request-aware helpers that use `getCurrentSailingCardYear(now)`, required profile fields, and request `legalAgreementAcceptanceId`.
- [ ] Re-run the validity tests.

## Task 3: Server Action Upsert And Legal Link

- [ ] Add failing action tests proving successful submit creates one `LegalAgreementAcceptance`, upserts the current-year `SailingCardRequest`, links the exact acceptance id, and resubmitting same year updates that request.
- [ ] Add failing action tests proving validation-error responses include the submitted `values` so RHF can preserve user input.
- [ ] Run `npm run test -- src/libs/mit-sailing/sailingCardOnboardingActions.test.ts`; expected: fail on request upsert and preservation assertions until implemented.
- [ ] Update onboarding parsing to include `cardType` and `dateOfBirth`; keep server validation authoritative.
- [ ] In one Prisma transaction, update reusable `User` facts, create append-only legal evidence, and upsert `SailingCardRequest` by `(userId, cardYear)` with `legalAgreementAcceptanceId`.
- [ ] Re-run the action tests.

## Task 4: RHF Single-Page Form

- [ ] Add/adjust component tests for exact field order, legacy affiliation order, card type options (`Normal`, `Racing`, `Team racing`), DOB and phone under `Contact details`, emergency fields last, locked verified DW names, editable manual names, required checkbox, native disclosure, and preserved values after server validation.
- [ ] Run `npm run test -- src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx`; expected: fail before RHF completion.
- [ ] Finish `useForm`/`handleSubmit`/`useWatch` wiring; register all native controls; call the existing Server Action through `useActionState`; render field errors from server state and RHF client state.
- [ ] Pass page-provided defaults into `useForm({ values })` so profile prefill and server-error preservation work without derived-state effects.
- [ ] Re-run component tests and `npm run check:i18n`.

## Task 5: Onboarding Page Prefill And Redirects

- [ ] Add/adjust page/route tests for existing profile prefill, current-year complete redirect to `/onboarding/success`, pending current-year request satisfying route guards, and prior-year-only request requiring onboarding again.
- [ ] Run focused affected tests under `npm run test`.
- [ ] Update `/onboarding` page query to load reusable `User` facts plus current-year request and legal evidence, then pass defaults/locked-name metadata into the form.
- [ ] Update auth guard logic so admin routes are not blocked by the admin user's own onboarding state, while member/profile routes use current-year request completion.
- [ ] Re-run focused route/auth tests.

## Task 6: Admin Queue And Issuance

- [ ] Add failing admin query/action/component tests proving queues show latest current-year requests only, card issuance fails without the linked legal acceptance, and issuing a card approves/references the current-year request.
- [ ] Run focused admin card tests.
- [ ] Update admin queries and UI to read `SailingCardRequest` rows rather than `User.sailingCardRequestedAt`.
- [ ] Update issue action to load the current-year pending request, verify `legalAgreementAcceptanceId`, issue the legacy current-card fields, and mark the request approved with issuer/card metadata.
- [ ] Re-run focused admin card tests.

## Task 7: E2E And Final Verification

- [ ] Update e2e helpers to seed current-year request/legal evidence for users who should be onboarding-complete.
- [ ] Update `Auth.e2e.ts` and `Onboarding.e2e.ts` for signup callback `/onboarding`, required form flow, dark nav contrast regression, and stale prior-year request behavior.
- [ ] Run focused e2e where possible, then final allowed scripts:

```bash
npm run lint
npm run check:types
npm run check:deps
npm run check:i18n
npm run test
npm run test:e2e
```

---

## Context7 Notes

- React Hook Form 7 supports `useForm({ defaultValues, values })`, `register`, `handleSubmit`, `setError`, and `useWatch`; use registered native fields and returned server `values` to preserve data after validation errors.
- Next.js Server Actions with `useActionState` accept `(previousState, formData)` and should call `revalidatePath` before `redirect`.
- Prisma supports transaction callbacks and composite unique upserts; use `(userId, cardYear)` as the annual request identity and create legal evidence in the same transaction before linking it to the upserted request.
