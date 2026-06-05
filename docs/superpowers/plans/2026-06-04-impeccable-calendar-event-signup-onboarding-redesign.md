# Impeccable Calendar, Event, Signup, And Onboarding Redesign Plan

> **Status:** Research and audit plan. Do not treat this as a backend implementation plan.
> The Learn-to-Sail domain source of truth remains
> `docs/superpowers/specs/2026-06-03-learn-to-sail-waitlist-feature-start.md`.
> This plan controls the UX/design review and phased redesign of the user-facing
> flow around calendar discovery, event detail, event registration, signup,
> email verification, annual onboarding, and profile contact recovery.

## Goal

Make the full path from "I want to sail at MIT" to "I requested or registered for the right event" feel like a custom 2026 product from a professional web design firm: clear, fast, mobile-first, MIT-specific, and hard to break with real data.

The product must support three primary users without making them understand internal event or registration models:

- A new sailor who wants the soonest Learn-to-Sail class.
- A busy student who needs a class that fits a narrow schedule.
- An experienced sailor who already knows how to sail and needs the MIT-specific orientation path, not the beginner waitlist.

## Current 100/100 Blockers

These block a true 100/100 claim even if individual components pass visual checks:

1. **Annual beginner waitlist state is not fully implemented.** This branch can mark Learn-to-Sail events, explain the shared waitlist rule, and collect class requests through approval-required registrations, but launch still needs the real annual waitlist entry, waitlist number, and server-side "must be on beginner waitlist before requesting beginner classes" enforcement.
2. **The acquisition path is long.** A first-time user may go event detail -> login/signup -> email verification -> annual Sailing Card onboarding -> success callback -> event register. That path is product-correct today, but high-friction on mobile.
3. **Phone/SMS is split across surfaces.** Signup, onboarding, profile contact, event request reminders, and SMS consent need one coherent recovery model.
4. **No persisted Impeccable critique baseline exists yet.** Future passes need stored scores so agents do not restart from taste alone.

## Evidence Used

- Impeccable repo context: `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`.
- Impeccable skill docs used: `init`, `product`, `critique`, `audit`, `harden`, `clarify`, `onboard`, `adapt`, `animate`, `delight`, `polish`.
- Current Impeccable GitHub issues:
  - [#149](https://github.com/pbakaus/impeccable/issues/149): mechanical scans must run before visual judgment, but a clean scan does not replace a full design pass.
  - [#202](https://github.com/pbakaus/impeccable/issues/202): design context must be scoped so public event work does not inherit admin/dashboard assumptions.
  - [#85](https://github.com/pbakaus/impeccable/issues/85): defensive CSS needs to be part of build-time thinking, not a late QA patch.
  - [#193](https://github.com/pbakaus/impeccable/issues/193): classify screen-reader-only audit findings before treating them as real overflow bugs.
  - [#150](https://github.com/pbakaus/impeccable/issues/150) and [#183](https://github.com/pbakaus/impeccable/issues/183): live iteration can lose state or reload repeatedly; avoid live-mode edits on long forms unless state preservation is proven.
  - [#128](https://github.com/pbakaus/impeccable/issues/128): critique history should persist across sessions so scores are comparable.
  - [#201](https://github.com/pbakaus/impeccable/issues/201): light/dark contrast must be tested, not assumed.
- External UX standards:
  - [NN/g usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): system status, real-world language, consistency, error prevention, recognition over recall, and recovery.
  - [W3C forms tutorial](https://www.w3.org/WAI/tutorials/forms/): visible labels, grouped fields, instructions, validation, and feedback.
  - [WCAG 2.2 target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): mobile controls need touch-safe targets.
  - [USWDS form guidance](https://designsystem.digital.gov/components/form/): conventional, labeled, recoverable forms.
  - [MIT brand do/don't](https://brand.mit.edu/applying-brand/do-dont): do not redraw MIT marks, do not create new MIT lockups, use plain text for MIT references, and preserve MIT core color discipline.

## Current Audit Snapshot

### Mechanical Checks

Ran scoped detector on:

- `src/components/mit-sailing/events/EventDetailView.tsx`
- `src/components/mit-sailing/events/EventRegistrationCta.tsx`
- `src/components/mit-sailing/events/EventRegistrationFormClient.tsx`
- `src/components/mit-sailing/events/EventCalendarOccurrenceRow.tsx`
- `src/components/mit-sailing/events/EventsListView.tsx`
- `src/app/[locale]/(marketing)/(site)/events/[slug]/register/page.tsx`
- `src/app/[locale]/(auth)/(center)/signup/SignUpForm.tsx`
- `src/app/[locale]/(auth)/(center)/verify-email/VerifyEmailForm.tsx`
- `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.tsx`
- `src/components/mit-sailing/onboarding/SailingCardOnboardingFormSections.tsx`
- `src/app/[locale]/(auth)/profile/ProfileContactSection.tsx`

Result: `[]`.

Mechanical follow-up scans found:

- No hard-coded hex colors in the scoped flow files.
- No arbitrary font-size or line-height utilities in the scoped flow files.
- Existing defensive layout support is strongest in event/register files after recent changes: `min-w-0`, overflow wrapping, status roles, reduced-motion handling, and mobile-height controls.
- Onboarding and profile contact still need the same action-state hardening applied to event/register: mobile button targets, pending labels, reduced-motion error focus, stronger success/error presentation, and browser proof.

### Event/Register Slice Score

Current event detail/register mobile slice: **95/100 technical UI slice**, with evidence:

- Detector clean on scoped files.
- Focused tests passed for submit button, switch, event CTA, event register form, event detail, and calendar row.
- `npm run lint`, `npm run check:types`, `npm run check:i18n`, and `npm run build-local` passed.
- Browser/mobile DOM proof confirmed:
  - Separate multi-day schedule rows.
  - Registration panel before description on mobile.
  - "Annual waitlist", "Not first-come", request counts, spot count, waitlist rule, and experienced-sailor alternative.
  - Register page copy says "Request this class" and "Waitlist-ranked request".

This is not a full product score because the annual waitlist backend and signup/onboarding flow remain incomplete.

## Product Model

### Beginner Learn-to-Sail

One shared beginner waitlist ranks requests for both:

- Mid-Week 1-2-3
- Sunday All-in-One

Users request individual classes when class request windows open. If requests exceed spots, waitlist number decides acceptance. Requesting at midnight does not improve order once the request window is open.

### Experienced Sailors

Experienced sailors do not join the beginner waitlist. Their path is:

- Intro for Experienced Sailors for MIT-specific orientation and Tech Dinghy access.
- Additional class/rating paths for Lynx Catboat, windsurfing, Mashnee, and other fleet access.

### Generic Events

The same event page must also support normal event registration, approval-required registration, external registration, no registration, closed/full/opening-later states, payments, success, errors, and pending/approved states.

## Design Principles For This Flow

1. **State and next action before explanation.** Users should first see what they can do now.
2. **Structured facts over paragraphs.** Dates, windows, spots, waitlist number, request count, and selection notes are product objects.
3. **One visual vocabulary.** Shared buttons, inputs, chips, alerts, and status panels across event, signup, onboarding, and profile.
4. **Mobile as the first proof surface.** Calendar, event CTA, register form, signup, onboarding, and profile contact must pass at 390px width before desktop polish.
5. **No false per-class waitlists.** Mid-Week and Sunday are separate class options that use one beginner waitlist.
6. **No midnight-race implication.** Urgency applies to joining the annual waitlist, not clicking a class request first.
7. **No brand drift.** MIT wordmark/lockups are not redrawn; "MIT" remains plain text unless an official asset is used; MIT red is the primary brand/action color.
8. **Real recovery states.** Every form needs success, error, pending, disabled, validation, and callback recovery evidence.
9. **Defensive CSS by default.** Long names, long event titles, empty event lists, many requests, 1000+ waitlist members, 150 class requests, and 18 accepted spots must not break layout.
10. **Browser proof beats intent.** A form that looks good but cannot submit is a failed design.

## Impeccable Workflow Gates

Run these gates per surface, not across the whole repo at once:

1. **Scope gate**
   - Identify actor, route, component file, and primary action.
   - Confirm whether the surface is public marketing, product task UI, admin, or email.
   - Load the nearest applicable context; do not let admin assumptions leak into public signup/event work.

2. **Mechanical gate**
   - Run `detect.mjs --json` on source files.
   - Run regex scans for arbitrary type, hard-coded color, fixed pixel sizing, missing defensive text handling, missing action-state semantics, and missing reduced-motion support.
   - Classify `.sr-only` and intentionally hidden text findings before acting.

3. **Critique gate**
   - Use independent design review plus detector/browser evidence.
   - Score Nielsen heuristics out of 40.
   - Persist a snapshot under `.impeccable/critique/`.

4. **Clarify/copy gate**
   - Each label must answer what happens next.
   - Button labels use verb plus object.
   - Error messages say what failed and how to recover.
   - Success messages say what happened and what comes next.

5. **Onboard gate**
   - The "aha" moment is not completing onboarding. It is knowing the right path and reaching a real event request/registration.
   - Do not add tutorial UI. Use the real flow, progressive disclosure, and useful empty states.

6. **Adapt gate**
   - Test desktop and mobile separately.
   - Mobile must prove touch targets, focus order, schedule comprehension, CTA reachability, errors, success, and pending states.

7. **Animate/delight gate**
   - Motion only for state feedback, disclosure, validation, success, and helpful transitions.
   - Use reduced-motion alternatives.
   - Delight comes from MIT Sailing-specific details, real schedules, confident copy, and a polished interaction response, not decorative effects.

8. **Harden/polish gate**
   - Test long data, empty data, closed/full/opening-later states, signed-out, signed-in-not-onboarded, onboarded, pending, approved, error, and retry.
   - Run focused tests first, then `lint`, `check:types`, `check:i18n`, and `build-local`.

## Phased Redesign Plan

### Phase 1: Lock The Event/Register Pattern

Status: mostly implemented in this branch.

Finish criteria:

- Event detail shows schedule, status, action, waitlist rule, and experienced-sailor escape path without requiring users to read the whole page.
- Register page says "Request this class" for waitlist-managed beginner events.
- Mid-Week schedule displays separate day/time rows.
- Opening-later, closed, pending, approved, error, and success states are visually distinct and accessible.
- Mobile proof at 390px and desktop proof at a normal laptop viewport.

### Phase 2: Calendar Discovery

Design objective:

- Users should discover the right event from `/events`, class pages, and calendar rows without first understanding categories.

Required changes:

- Calendar rows show registration state, event type, and next action consistently.
- Month view remains useful for scanning but mobile defaults to readable upcoming groups.
- Learn-to-Sail events should show "Request opens..." or "Request open" and indicate waitlist-ranked acceptance.
- Experienced intro should show "No beginner waitlist".
- Empty/no-upcoming state should point to class pages and notification/signup path.

Tests:

- Calendar grouping and event row tests.
- Mobile E2E for finding a Learn-to-Sail event from `/classes` or `/events`.

### Phase 3: Signup And Email Verification

Design objective:

- Signing up from an event should feel like continuing the event request path, not entering a separate account product.

Required changes:

- Preserve callback language: signup should show the user what they are returning to.
- Keep email/password minimal.
- Add the same mobile action-state treatment as event/register: min-height buttons, clear pending label, success role/status, error role/alert, reduced-motion recovery.
- Verify-email should clearly show progress and the return destination.

Tests:

- Signup callback preservation.
- Verify-email return-to-event callback.
- Mobile browser proof for errors, pending, and success.

### Phase 4: Annual Sailing Card Onboarding

Design objective:

- Onboarding should collect required safety/eligibility facts quickly, then return the user to the event request.

Required changes:

- Preserve the event callback through page load, submit, success, and payment if applicable.
- Make the current step and remaining blockers visible without turning the page into a tutorial.
- Use profile-prefilled phone/emergency contact where available.
- Use event/register alert/action semantics for server errors and field errors.
- Add reduced-motion scroll/focus behavior for invalid fields.
- Ensure onboarding does not ask users to re-enter facts that signup or MIT email identity can safely supply.

Tests:

- Onboarding submit error preservation.
- Callback return to event register.
- Mobile invalid-field focus/scroll.
- Long names, long emergency contact values, and missing profile facts.

### Phase 5: Profile Contact Recovery

Design objective:

- Users who need to add/change phone for SMS or safety should have one obvious place to do it.

Required changes:

- Profile contact form uses the same button, error, success, and pending vocabulary.
- Event/register pages link to profile contact when phone is missing or stale.
- Copy should say "Update phone" or "Add phone", not internal profile language.

Tests:

- Profile contact save success/error.
- Event register missing-phone recovery link.
- Mobile profile contact proof.

### Phase 6: Backend Waitlist Enforcement

Design objective:

- The UI's waitlist promise must be backed by domain state.

Required changes:

- Implement annual Learn-to-Sail waitlist entries, sequence, active season, and status.
- Enforce beginner waitlist membership before class requests.
- Store waitlist number snapshot on class request.
- Show user's waitlist number where relevant.
- Keep Mid-Week and Sunday tied to the same waitlist.

Tests:

- Domain helper tests for season and sequence.
- Server action tests for join waitlist and request class.
- Event registration action tests proving non-waitlisted users cannot request beginner classes.
- E2E: signup before Apr 1 alert, join waitlist after Apr 1, request class, pending/accepted state.

## Production Readiness Plan

This PR should ship only after code review and CI pass. It should not by itself be treated as "the Learn-to-Sail waitlist is live for real students" until the release checklist below is executed and signed off.

### Current Launch Posture

- **Safe to review now:** Event pages, registration pages, calendar rows, admin event settings, signup/login/onboarding/profile interaction improvements, and the explanatory Learn-to-Sail request UI.
- **Safe to enable for selected test events:** Marking real or seed Learn-to-Sail events as waitlist-managed for staff preview, as long as staff understand class requests are still ordinary approval-required event registrations.
- **Not safe to announce as the annual waitlist:** Public Apr 1 waitlist launch, waitlist number display, SMS launch alerts, and automatic selection by waitlist number still require the production launch work below.

### Required Before Public Launch

1. **Domain enforcement**
   - Add annual waitlist entries with season year, sequence, status, joined timestamp, and closure reason.
   - Enforce one active beginner waitlist entry per user per season.
   - Enforce beginner waitlist membership before requesting Mid-Week or Sunday beginner classes.
   - Snapshot waitlist number on each class request so admin review has an auditable basis.
   - Keep Mid-Week and Sunday on the same beginner waitlist.

2. **Admin operations**
   - Show waitlist number, request timestamp, current request status, and user contact facts in class rosters.
   - Add an admin review view sorted by waitlist number first, then operational exceptions.
   - Preserve manual flexibility: admins can still approve fewer or more than the nominal 18 spots when real capacity changes.
   - Record enough audit data to explain why a request was accepted, left pending, or canceled.

3. **SMS and email**
   - Add Twilio configuration through `Env.ts`; do not read provider credentials directly from `process.env`.
   - Collect explicit SMS consent during signup/profile update before sending class or waitlist texts.
   - Send welcome email after signup.
   - Send Apr 1 waitlist-live notification to pre-signup users.
   - Send "registration opens tonight at midnight" email/SMS for relevant classes.
   - Send midnight live link using the normal calendar event page URL, not a generated custom URL.
   - Send accepted and not-yet-accepted outcomes when admins make selections.
   - Handle STOP/unsubscribe, delivery failure, retries, and duplicate-send idempotency.

4. **Data and content setup**
   - Identify the canonical 2026 Learn-to-Sail class events and mark only those events with the correct managed class kind.
   - Confirm Mid-Week schedules display each required day/time separately.
   - Confirm Sunday and Intro for Experienced Sailors show the correct non-waitlist or waitlist treatment.
   - Confirm selection note copy is filled in by admins where needed, for example "Selections are usually announced Monday afternoon."
   - Remove or clearly mark any fake event used as a historical waitlist stand-in.

5. **Release controls**
   - Add or document the feature flag / admin-only preview control used before public launch.
   - Prove rollback: disabling managed class kind returns events to normal approval-required registration behavior without data loss.
   - Run production-like seed and migration checks before deploying.
   - Verify background jobs are disabled until Twilio/email configuration and templates are ready.

6. **Proof before announcement**
   - Desktop and mobile smoke test: signed-out signup, email verification, onboarding callback, join waitlist, request class, pending state, accepted state.
   - Desktop and mobile smoke test: experienced sailor path reaches Intro for Experienced Sailors without beginner waitlist.
   - Desktop and mobile smoke test: missing phone recovery uses profile update and returns to the event path.
   - Accessibility smoke test on public event, register, signup, profile, and admin roster pages.
   - Production content review by a human who understands the Sailing Pavilion operations.

### Launch Sequence

1. Merge and deploy the event/register/profile UI foundation.
2. Merge and deploy annual waitlist domain enforcement behind preview controls.
3. Configure Twilio, verified sender information, templates, unsubscribe handling, and job idempotency.
4. Mark real 2026 beginner Learn-to-Sail events as waitlist-managed in admin.
5. Run staff-only preview with test users and real-looking data: 1000+ waitlist entries, 150 class requests, 18 accepted spots.
6. Fix any failed journey before public announcement.
7. Enable public waitlist join on April 1 or the chosen launch date.
8. Send notifications only after the live event pages and rollback path are verified.

### Rollback Plan

- Disable managed class kind on affected events to return them to normal approval-required registrations.
- Pause SMS/email jobs before changing data.
- Keep existing registrations and waitlist entries; do not delete launch data during rollback.
- Publish a short admin note explaining whether pending class requests remain valid.
- Re-run browser smoke tests after rollback to prove the generic event flow still works.

## Required Browser Journeys

Each journey needs desktop and mobile evidence:

1. Signed-out beginner finds a Learn-to-Sail event, signs up, verifies email, completes onboarding, requests class, sees pending state.
2. Logged-in but not onboarded user starts from an event and returns after onboarding.
3. Logged-in, onboarded beginner on waitlist sees waitlist number and requests an open class.
4. Logged-in, onboarded beginner sees class not open yet and understands when requests open.
5. Pending beginner sees class request saved and knows review happens later.
6. Accepted beginner sees they are on the class list.
7. Experienced sailor sees Intro for Experienced Sailors and no beginner waitlist.
8. Generic public event registers normally without Learn-to-Sail copy.
9. Event with payment shows payment due and recovery.
10. Missing or stale phone routes to profile contact recovery.

## Scores To Track

Use these as gates, not vanity numbers:

- Event/register technical mobile slice: current target **95+**.
- Calendar discovery mobile: target **95+** after Phase 2.
- Signup/verify mobile: target **95+** after Phase 3.
- Onboarding mobile: target **95+** after Phase 4.
- Profile contact recovery mobile: target **95+** after Phase 5.
- Full Learn-to-Sail product workflow: cannot exceed **90** until annual waitlist backend enforcement exists; target **98-100** after Phase 6 plus human approval of UX, evidence, and release risk.

## Next Implementation Slice

Do Phase 3 and Phase 4 hardening before broad visual redesign:

1. Apply event/register action-state patterns to `SignUpForm`, `VerifyEmailForm`, `SailingCardOnboardingForm`, `SailingCardOnboardingFormSections`, and `ProfileContactSection`.
2. Add/update unit tests for success/error/pending/reduced-motion behavior.
3. Run scoped detector and mechanical scans again.
4. Browser-test mobile signup -> verify -> onboarding -> callback to event register.
5. Persist an Impeccable critique snapshot for the acquisition flow.

This is the highest-leverage next slice because it reduces the chance that the redesigned event page sends users into a weaker signup/onboarding path.
