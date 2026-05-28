# Finish Sailing Card Onboarding Implementation Plan

> **For agentic workers:** Use narrow subagents with disjoint write ownership. Follow `AGENTS.md`, `@tdd`, and this plan task-by-task. Do not implement the profile affiliation editor or general/event legal ledger adoption in this plan.

**Goal:** Finish sailing-card onboarding by matching the legacy MIT affiliation dropdown, collecting required yearly contact details, replacing the legacy swim-initials flow with a required agreement checkbox plus readable disclosure text, and storing production V1 legal evidence in an append-only onboarding ledger.

**Resolved decisions to enforce:**

- Use TypeScript/Prisma enum values for affiliation, not a lookup table.
- Render affiliation as one required native `<select>` with a blank placeholder.
- Visible affiliation options must exactly match legacy order: MIT Student, MIT Faculty, MIT Staff, MIT Alum, MIT Family, MIT Affiliate, Wellesley, Brandeis, Northeastern, Winsor, Brooks, NROTC, Other Student, Other Non-Student.
- Show identity fields conditionally after affiliation selection.
- Phone and emergency contact fields are always visible.
- Use a required checkbox for swim agreement acceptance.
- Show readable swim agreement/liability release text in a native disclosure.
- Do not add broad Terms acceptance to onboarding.
- Add append-only `LegalAgreementAcceptance` evidence for sailing-card onboarding only.
- Agreement text/version lives in code for V1.
- Use `@foundernest/namecase` behind one local wrapper for verified MIT Data Warehouse names only.
- Reuse existing `libphonenumber-js`; do not add form, UI, or legal packages.
- Keep issue #111, profile affiliation editor, out of scope.
- Keep issue #112, event/all-other legal ledger adoption, out of scope except for shared model compatibility.

**Source findings:**

- Live legacy affiliation order comes from `https://sailing.mit.edu/new_account.php`.
- Complete affiliation data exists in `/Users/andrewkelley/GitHub/sailing-wp-main/wp-content/plugins/mit-sailing-features/migration/seeds.json`, `affil_type`.
- Legacy dropdown renderer is `/Users/andrewkelley/GitHub/sailing-wp-main/wp-content/plugins/mit-sailing-features/includes/legacy/user.php`, `affilPulldown`.
- Useful compact form styling comes from `/Users/andrewkelley/GitHub/mitsailing/sailing-wp/wp-content/plugins/mit-sailing-features/includes/account-template.php`.

## Critical Scope Corrections

- Remove all onboarding form fields, validators, tests, admin display, and card-validity requirements that depend on a typed initials value.
- Keep any legacy database columns already introduced for initials only if removing them would create unnecessary migration churn; new onboarding behavior must not read them as completion/legal evidence.
- The new legal ledger is limited to sailing-card onboarding source rows. Event registration remains on its current `EventRegistration.swimAgreementAcceptedAt` field in this plan.
- Profile affiliation editing remains deferred to issue #111. Shared affiliation domain helpers may be written so #111 can reuse them later, but no profile UI/action route is part of this plan.
- Do not create or modify unrelated tool config. Do not add packages other than `@foundernest/namecase`.

## Task 0: Package And Name Wrapper

**Ownership:** `package.json`, `package-lock.json`, `src/libs/mit-sailing/personName.ts`, `src/libs/mit-sailing/personName.test.ts`.

- [ ] Add a failing unit test proving verified MIT Data Warehouse names are trim/collapse-normalized and name-cased, while manual names are only trim/collapse-normalized.
- [ ] Run `npm run test -- src/libs/mit-sailing/personName.test.ts` and verify the expected failure.
- [ ] Add `@foundernest/namecase` with npm so `package-lock.json` is updated.
- [ ] Implement a local wrapper around `@foundernest/namecase`. The wrapper is the only application import of the package.
- [ ] Update MIT Data Warehouse onboarding name use to call the wrapper only for verified warehouse identities.
- [ ] Run `npm run test -- src/libs/mit-sailing/personName.test.ts src/libs/mit-sailing/sailingCardOnboarding.test.ts`.

## Task 1: Expand The Affiliation Model

**Ownership:** `zenstack/schema.zmodel`, `prisma/schema.prisma`, `prisma/migrations/20260521000000_add_sailing_card_onboarding/migration.sql`, generated ZenStack/Prisma files, `src/libs/mit-sailing/sailingAffiliations.test.ts`.

- [ ] Add failing enum coverage for the full legacy affiliation enum plus internal `NON_MIT`.
- [ ] Run `npm run test -- src/libs/mit-sailing/sailingAffiliations.test.ts` and verify missing enum failures.
- [ ] Expand `SailingAffiliation` in ZenStack, Prisma schema, and the onboarding migration to include `MIT_STUDENT`, `MIT_FACULTY`, `MIT_STAFF`, `MIT_ALUM`, `MIT_FAMILY`, `MIT_AFFILIATE`, `WELLESLEY`, `BRANDEIS`, `NORTHEASTERN`, `WINSOR`, `BROOKS`, `NROTC`, `OTHER_STUDENT`, `OTHER_NON_STUDENT`, and internal `NON_MIT`.
- [ ] Regenerate generated schema/client files through the repo workflow used by `npm run build-local`.
- [ ] Run `npm run test -- src/libs/mit-sailing/sailingAffiliations.test.ts`.

## Task 2: Encode Legacy Affiliation Rules

**Ownership:** `src/libs/mit-sailing/sailingAffiliations.ts`, `src/libs/mit-sailing/sailingAffiliations.test.ts`.

- [ ] Add failing tests for exact visible dropdown order and rule groups.
- [ ] Run `npm run test -- src/libs/mit-sailing/sailingAffiliations.test.ts` and verify the expected failure.
- [ ] Encode visible options in legacy order, excluding internal `NON_MIT`.
- [ ] Encode rules:
  - MIT Student, MIT Faculty, MIT Staff: MIT ID required, manual name not allowed.
  - MIT Alum, MIT Family, MIT Affiliate: MIT ID optional, manual name allowed when no MIT ID is supplied.
  - Wellesley, Brandeis, Northeastern, Winsor, Brooks, NROTC, Other Student, Other Non-Student: no MIT ID field, manual name required.
  - `NON_MIT`: internal fallback only; never rendered.
- [ ] Run `npm run test -- src/libs/mit-sailing/sailingAffiliations.test.ts`.

## Task 3: Add Onboarding Legal Agreement Ledger

**Ownership:** `zenstack/schema.zmodel`, `prisma/schema.prisma`, onboarding migration, generated files, `src/libs/mit-sailing/sailingCardAgreement.ts`, `src/libs/mit-sailing/sailingCardAgreement.test.ts`.

- [ ] Add failing schema/contract tests proving a `LegalAgreementAcceptance` model can store onboarding acceptance evidence without coupling to event registration.
- [ ] Add failing helper tests for code-owned agreement label, version, text, and deterministic hash.
- [ ] Run the focused tests and verify expected failures.
- [ ] Add `LegalAgreementAcceptance` as an append-only model with at least: `id`, `userId`, `source`, `agreementLabel`, `agreementVersion`, `agreementHash`, `acceptedAt`, `ipAddress`, `userAgent`, and a relation to `User`.
- [ ] Add a TypeScript/Prisma enum for `LegalAgreementAcceptanceSource` with `SAILING_CARD_ONBOARDING`. Keep the enum broad enough for future #112 compatibility, but do not adopt it outside onboarding in this plan.
- [ ] Add schema/migration/generated files for the new model and enum.
- [ ] Implement code-owned V1 swim agreement/liability release content with exported `label`, `version`, `text`, and hash helper.
- [ ] Run helper/schema tests plus `npm run build-local` far enough to regenerate/check generated Prisma and ZenStack output.

## Task 4: Validate Expanded Onboarding Inputs

**Ownership:** `src/libs/mit-sailing/sailingCardOnboarding.ts`, `src/libs/mit-sailing/sailingCardOnboarding.test.ts`, `src/libs/mit-sailing/sailingCardOnboardingActions.ts`, `src/libs/mit-sailing/sailingCardOnboardingActions.test.ts`.

- [ ] Add failing tests for:
  - Missing or invalid affiliation returns `{ affiliation: 'required' }`.
  - Non-MIT school affiliations ignore submitted MIT identity and require manual name.
  - Other non-student requires manual name.
  - Missing agreement checkbox returns `{ swimAgreementAccepted: 'required' }`.
  - Checked agreement parses as accepted.
- [ ] Run `npm run test -- src/libs/mit-sailing/sailingCardOnboarding.test.ts src/libs/mit-sailing/sailingCardOnboardingActions.test.ts` and verify expected failures.
- [ ] Change onboarding input to use `affiliation: SailingAffiliation | null` and `swimAgreementAccepted: boolean`.
- [ ] Remove initials normalization/validation from onboarding input handling.
- [ ] Parse affiliation as `null` for blank/invalid values; never silently default to `NON_MIT`.
- [ ] Parse the required checkbox from form data and validate it server-side.
- [ ] Keep phone and emergency contact validation always active.
- [ ] Use the person-name wrapper for verified MIT Data Warehouse names only.
- [ ] Make the Server Action write the user profile/card request update and append one `LegalAgreementAcceptance` row in a transaction, including user id, source `SAILING_CARD_ONBOARDING`, label, version, hash, acceptedAt, IP, and user agent.
- [ ] Preserve current-card fields when onboarding refreshes an already-current card, but append a new legal acceptance row for the new yearly agreement.
- [ ] Run the focused onboarding tests.

## Task 5: Replace Radio Cards With Dropdown, Checkbox, And Disclosure

**Ownership:** `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.tsx`, `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx`, `src/locales/en.json`.

- [ ] Add failing component tests for:
  - Required native affiliation combobox starts on blank placeholder.
  - Visible options exactly match legacy order.
  - MIT Student shows required MIT ID and hides manual name.
  - Wellesley hides MIT ID and shows required manual name.
  - MIT Alum shows optional MIT ID and manual name behavior.
  - Phone and emergency contact fields are visible before affiliation selection.
  - Required swim agreement checkbox is rendered.
  - Native disclosure exposes readable agreement/liability text.
- [ ] Run `npm run test -- src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx` and verify expected failures.
- [ ] Replace radio-card state/rendering with a required `<select>` and blank placeholder.
- [ ] Keep conditional identity fields driven by affiliation rules.
- [ ] Keep phone and emergency contact fields outside conditional affiliation rendering.
- [ ] Replace legal input with a required checkbox named `swimAgreementAccepted`.
- [ ] Render the V1 agreement text from the code-owned helper in a native disclosure.
- [ ] Apply compact account-form styling without nested cards or new visual patterns.
- [ ] Add/update `OnboardingPage` translations for affiliation labels, placeholder/help text, agreement checkbox, disclosure summary, and validation errors.
- [ ] Run `npm run test -- src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx` and `npm run check:i18n`.

## Task 6: Use Agreement Acceptance For Card Validity And Admin Display

**Ownership:** `src/libs/mit-sailing/sailingCardValidity.ts`, `src/libs/mit-sailing/sailingCardValidity.test.ts`, `src/libs/admin/cards/*`, `src/components/mit-sailing/admin/cards/*`, relevant admin tests, `src/locales/en.json`.

- [ ] Add failing tests proving current-card validity requires an onboarding `LegalAgreementAcceptance` row for the current agreement version/hash, not a legacy typed value.
- [ ] Add failing admin query/component/action tests proving the card queue displays agreement accepted timestamp/version and does not require/display a typed value.
- [ ] Run focused validity/admin tests and verify expected failures.
- [ ] Update card validity helpers and call sites to accept agreement acceptance evidence.
- [ ] Update admin card queue queries to select the latest onboarding legal acceptance for each user.
- [ ] Update admin card UI labels/columns/errors to show accepted timestamp/version.
- [ ] Update card issue action to reject missing onboarding agreement acceptance instead of missing legacy typed value.
- [ ] Run focused validity/admin tests.

## Task 7: Regression Coverage For Signup, Onboarding, And Server Actions

**Ownership:** `tests/e2e/Auth.e2e.ts`, `tests/e2e/Onboarding.e2e.ts`, `src/libs/next/serverActionsBoundary.test.ts`.

- [ ] Update direct signup e2e expectations so a newly verified user without a card lands on `/onboarding`.
- [ ] Add onboarding e2e smoke coverage that the page loads and the dropdown has exactly the placeholder plus 14 visible options.
- [ ] Add a fast Server Action boundary test for file-level `'use server'` modules exporting only async functions.
- [ ] Run `npm run test -- src/libs/next/serverActionsBoundary.test.ts`.
- [ ] Run `npm run test:e2e -- tests/e2e/Auth.e2e.ts tests/e2e/Onboarding.e2e.ts`.

## Task 8: Final Verification And Review

- [ ] Run focused tests:

```bash
npm run test -- src/libs/mit-sailing/personName.test.ts src/libs/mit-sailing/sailingAffiliations.test.ts src/libs/mit-sailing/sailingCardAgreement.test.ts src/libs/mit-sailing/sailingCardOnboarding.test.ts src/libs/mit-sailing/sailingCardOnboardingActions.test.ts src/libs/mit-sailing/sailingCardValidity.test.ts src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx src/libs/next/serverActionsBoundary.test.ts
```

- [ ] Run required final scripts:

```bash
npm run check:i18n
npm run check:types
npm run build-local
npm run test:e2e -- tests/e2e/Auth.e2e.ts tests/e2e/Onboarding.e2e.ts
npm run lint
```

- [ ] Ask a fresh review subagent to review only this onboarding finish diff for bugs in affiliation parity, legal ledger evidence, checkbox/disclosure accessibility, Server Action transactionality, admin issuance, signup redirect, i18n, and e2e assertions.
- [ ] Fix any confirmed findings with tests first.

## Non-Goals

- No profile affiliation editor. Track that in https://github.com/mitsailing/mitsailing/issues/111.
- No event registration or all-other legal ledger adoption. Track that in https://github.com/mitsailing/mitsailing/issues/112.
- No broad Terms acceptance.
- No lookup-table affiliation model.
- No new form/UI/legal packages.
