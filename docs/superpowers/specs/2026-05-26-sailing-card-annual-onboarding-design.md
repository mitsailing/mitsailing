# Sailing Card Annual Onboarding Design

## Goal

Design sailing-card onboarding as a fast annual eligibility workflow. A user creates and verifies an account, then completes current-year sailing-card onboarding before member/card-dependent flows. Onboarding also repeats each sailing-card year for users who were issued a card and users who submitted a request but were never issued one.

## Decisions

- Signup remains a separate auth flow. It collects email/password and verifies email.
- After signup verification, new users go to `/onboarding`.
- `/onboarding` is not a profile editor. If current-year onboarding is complete, it sends the user to `/onboarding/success`.
- Profile editing, including affiliation editing after onboarding, remains deferred to issue #111.
- Event registration legal-ledger adoption remains deferred to issue #112, except shared model compatibility.
- Usernames are not part of the new flow. Better Auth owns login identity.
- Swim initials are not collected. The user accepts the swim agreement with a required checkbox backed by append-only legal evidence.

## Annual Model

Keep reusable profile facts on `User`: name, phone, emergency contact, affiliation, MIT ID, and MIT Data Warehouse verification fields.

Add a year-scoped sailing-card onboarding/request record for V1:

- one row per user per sailing-card year;
- resubmitting in the same year updates that row;
- the row stores the current request status and links to the exact `LegalAgreementAcceptance` row created during the latest submit;
- card issuance approves or references that current-year request.

This separates durable profile facts from annual confirmation. A user who submitted last year but never received a card must submit again after the annual cutoff. The next form is prefilled from the latest profile fields but requires active review and submission.

## Completion Rules

Current-year onboarding is complete when the user has a current-year annual request row with required profile fields and linked current agreement evidence.

A pending current-year request counts as onboarding complete for general authenticated/member flows. Card-required actions still require an issued current sailing card. Admin routes are permission-gated and are not blocked by the admin user's own onboarding state.

## Form Fields

The V1 onboarding form contains:

1. Affiliation
2. MIT ID when applicable
3. First and last name
4. MIT class/year when applicable
5. Type of sailing card requested
6. Date of birth
7. Your phone number
8. Emergency contact name
9. Emergency contact phone
10. Emergency contact email, optional
11. Swim agreement disclosure and required checkbox

Do not include username. Do not include password or email; signup already owns them. Do not include virtual card type.

## Affiliation And Identity

Affiliation is the first field and uses the legacy visible option order:

1. MIT student
2. MIT faculty
3. MIT staff
4. MIT alum
5. MIT family
6. MIT affiliate
7. Wellesley
8. Brandeis
9. Northeastern
10. Winsor
11. Brooks
12. NROTC
13. Other student
14. Other non-student

When MIT ID is required or provided, validate it against MIT Data Warehouse. Verified Data Warehouse names are displayed as locked fields and namecased through the local wrapper. Manual name fields are editable only when the user is not using a verified Data Warehouse identity.

Do not add extra text explaining optional MIT ID behavior for MIT affiliate-style options. The UI makes requirements clear by showing, hiding, requiring, and locking fields.

## Card Type

V1 card request options are:

- Normal
- Racing
- Team racing

Normal is the default. Virtual is intentionally excluded.

## Legal Evidence

On every successful onboarding submit:

- write an append-only `LegalAgreementAcceptance` row with source `SAILING_CARD_ONBOARDING`;
- store agreement label, version, hash, acceptance timestamp, user id, IP address, and user agent;
- link the annual onboarding/request row to the exact acceptance row.

Agreement text and version live in code for V1.

## UX Direction

Use an Impeccable product-register approach: design serves task completion. The physical scene is someone completing the form on a phone or laptop before visiting the Pavilion, while staff need clean review data later.

The form is a single-page review flow, not a wizard. It is modern, quick, and easy:

- one column on mobile;
- restrained MIT product styling using existing tokens;
- section rhythm with subtle dividers, not nested cards;
- native controls for dropdowns, dates, phone, and checkbox;
- compact helper text only where it prevents a mistake;
- explicit label `Your phone number`;
- group date of birth and phone under `Contact details`;
- emergency contact fields grouped last;
- legal text in a native disclosure before the required checkbox;
- clear field-level errors without resetting entered values.

Use `react-hook-form` for form state, field registration, conditional rendering, client-side required checks, submit state, and preserving values after server validation errors. Server validation remains authoritative for phone normalization, affiliation rules, MIT Data Warehouse identity, annual request writes, and legal evidence.

## Admin Review

Staff review queues show only the latest current-year annual request per user. Old annual rows remain historical data but are not active queue items. Issuing a card references or approves the current-year request and must fail if the current-year request lacks linked legal agreement evidence.

## Testing Requirements

Add or update tests for:

- signup verification routes new users to onboarding;
- `/onboarding` preloads existing profile fields for annual renewal;
- current-year pending request satisfies onboarding route guards;
- stale prior-year pending request requires onboarding again;
- onboarding submit writes legal acceptance and upserts the annual request;
- annual request links to the exact legal acceptance row;
- card issuance checks current-year request evidence;
- RHF preserves entered values after server validation errors;
- affiliation options match legacy visible order;
- MIT Data Warehouse names render locked while manual names remain editable when no verified identity is used;
- e2e covers manual `/onboarding` page load and the form's required flow.

## Out Of Scope

- Profile affiliation editor and post-onboarding profile updates.
- Event-registration adoption of `LegalAgreementAcceptance`.
- Virtual card type.
- Username migration.
- Broad terms acceptance unrelated to the swim agreement.
