# Learn-to-Sail Waitlist Feature-Start Packet

## Status

Discovery packet for human review. No implementation is approved by this document.

## 100/100 Gate Position

Current phase: Gates 0-2.

- Gate 0: Intent - drafted.
- Gate 1: Evidence - drafted from user requirements, current sailing.mit.edu page, and repo source.
- Gate 2: Blockers - drafted.
- Gates 3-6 are not complete.
- This is not a 100/100-ready implementation packet.
- No worker may code until the relevant slice has completed Gates 3-6 and any UI-affecting slice has approved static HTML state designs.

100/100 definition for this feature: the agent proves the built workflow works, and a human approves product behavior, UX, evidence, and release risk.

Current blocker summary:

| 100/100 area | Status | Blocker |
| --- | --- | --- |
| Product behavior | Blocked | B1-B15 are not fully approved or explicitly deferred. |
| UX | Blocked | Static HTML states exist but are not fully approved. |
| Evidence | Partially blocked | Legacy and repo evidence are drafted, but implementation-slice source maps are not complete. Live `sailing.mit.edu` access is required before coding; use the user's Chrome browser if direct requests are blocked. |
| Runtime proof | Blocked | No implementation exists, no user-path browser proof exists, and no tests have been run for this feature. |
| Release risk | Blocked | Privacy, retention, email/SMS scope, cancellation/no-show, and public list exposure decisions are not approved. |

## Gate 0: Intent

Actor: a person who wants to take a beginner Learn-to-Sail intro class.

Starting point: public class/event flow after sign-in or account creation.

Object: annual Learn-to-Sail waitlist entry plus weekly class request.

Outcome: the user joins the annual waitlist, requests specific classes once each request window opens, and sees whether each class request is accepted.

Primary product risk: building normal event registration or first-click signup instead of a two-layer workflow:

1. Annual waitlist position.
2. Per-class request ranked among requesters.

## Confirmed Product Requirements

| Requirement | Source | Confidence |
| --- | --- | --- |
| Users sign up and join a waitlist. | User instruction. | `confirmed_by_source` |
| Waitlist resets every April 1. | User instruction. | `confirmed_by_source` |
| Before April 1, users can complete Apr 1 access setup, but cannot join the annual waitlist or receive a waitlist number until Apr 1 at 12:00 AM. Setup is saved only after account creation or sign-in completes on the next screen. The system is not generating an account-bound Apr 1 URL. | User correction plus pre-gate access case study. | `confirmed_by_source` |
| Users request specific weekly intro classes. | User instruction. | `confirmed_by_source` |
| Class registration timing must come from the class `Registration` page / event registration fields, not the earlier 1-week assumption. | User correction plus legacy register-page evidence. | `confirmed_by_source` |
| Before the class registration window opens, users can see the class but cannot submit registration. | User correction plus legacy register-page evidence. | `confirmed_by_source` |
| Class registration timing must be easy to change without code edits. | User instruction. | `confirmed_by_source` |
| Selection announcement copy should be optionally editable so the UI can say when accepted people will be announced without requiring a precise time. | User suggestion plus legacy register-page evidence. | `recommended_for_mvp` |
| Optional admin-authored registration text was considered, but is not recommended for MVP after expert review. | User suggestion plus 3-expert review. | `deferred_by_review` |
| Acceptance is based on annual waitlist order among users who requested that class. | User instruction. | `confirmed_by_source` |
| A high waitlist number can still be accepted when earlier users do not request that class. | User instruction. | `confirmed_by_source` |
| Waitlist class UI must not imply a midnight race. Users need to understand that request time inside the window does not change class acceptance order. | User correction. | `confirmed_by_source` |
| Public terminology should use `waitlist` and `waitlist number`; reserve `Priority Queue` for legacy/source references. | User request plus college registrar language review. | `confirmed_by_source` |
| UI must be obvious at a glance without explainer paragraphs. | User instruction. | `confirmed_by_source` |
| Twilio SMS is in MVP for registration-window notifications. | User instruction. | `confirmed_by_source` |
| Users opt into Learn-to-Sail SMS during waitlist signup. | User instruction. | `confirmed_by_source` |
| SMS sends 24 hours before registration opens with the class name, expected registration timing, and notice that the normal calendar event page will be texted at midnight. | User instruction plus event-link correction. | `confirmed_by_source` |
| SMS sends at midnight when registration opens with the normal calendar event page URL, not a custom or generated registration URL. The event page is where the user requests/registers. | User correction. | `confirmed_by_source` |
| SMS/email/event messaging must not imply first-come-first-served acceptance for waitlist-ranked intro classes. | User instruction plus later correction. | `confirmed_by_source` |
| Users may share Learn-to-Sail links, but sharing must not change waitlist position or class acceptance order. | User instruction. | `confirmed_by_source` |
| The not-logged-in and logged-in-not-waitlisted states should use the same waitlist signup form pattern. | User correction. | `confirmed_by_source` |
| Waitlist signup asks logged-out users for email and mobile phone. Logged-in users see account email as read-only identity and mobile phone prefilled when available. | User correction. | `confirmed_by_source` |
| Email updates are included for waitlist signup, including waitlist-live notification. | User correction. | `confirmed_by_source` |
| Terms of use and privacy policy agreement is required before joining or saving waitlist interest. | User correction. | `confirmed_by_source` |
| SMS consent is optional and must explicitly mention message/data charges and late-night texts for waitlist opening, upcoming registration windows, class go-live, and class acceptance. | User correction. | `confirmed_by_source` |
| Current website uses a fake event as the waitlist; `Pending` means still on the waitlist and `Confirmed` means the person took the class and is no longer on the waitlist. | User clarification. | `confirmed_by_source` |
| Earlier statements that requests open 1 week before class and users are selected 2-4 days before class are superseded until reconciled against register-page evidence. | User correction. | `confirmed_by_source` |
| Do not create, replace, reinterpret, or visually alter the MIT Sailing logo or flag/burgee. The MIT Sailing flag can be digitized only as a faithful reproduction of the existing design. | User correction after logo drift. | `confirmed_by_source` |

## Brand Mark Boundary

Logo and flag work is not open-ended design scope for this feature. The header, footer, homepage, and waitlist prototype may be modernized, but the MIT Sailing flag/burgee must keep its ultimate design. Acceptable work is faithful digitization: cleaner vector edges, correct proportions, scalable rendering, and appropriate asset formats based on the existing flag. Unacceptable work includes a new symbol, altered geometry, changed flag composition, modified MIT logo components, mascot-like reinterpretations, or any new logo direction.

The current repo only includes a low-resolution black-and-white burgee asset at `public/assets/images/sailing-card/burgee_bw.png`. Before producing a production SVG, use a higher-quality source image if available; otherwise mark the result as a draft trace requiring human comparison against the official/current flag.

The MIT Sailing wordmark must not make `Sailing` blue. MIT red is the primary identity color. If the wordmark needs contrast, use MIT red, black, white, or silver-gray treatments consistent with MIT brand guidance. Blue may appear only as a secondary interface/accent color for water, schedule, or informational states; it must not carry the primary brand wordmark.

## Boat Visual Source Boundary

The boat visuals are source-faithful constraints, not open-ended illustration scope.

| Boat/path | Controlling source boundary | Visual requirement |
| --- | --- | --- |
| Tech Dinghy | Use the current MIT Tech Dinghy design as the reference. The official fleet-renewal page describes the current `7th Generation Tech Dinghy Fleet` and bright red sails. The user-provided photo is reference-only and must not be embedded or copied. | Do not use retired/older Tech Dinghy imagery. A Tech Dinghy visual must read as the current MIT red-sail dinghy fleet, not a generic white-sail dinghy. |
| Lynx Catboat | Use the current MIT Lynx Catboat as the reference. MIT pages describe six Lynx Catboats, a gaff-rigged four-sided sail, and capacity up to 8 people. The user specifically noted the current MIT catboat has a black sail. | Do not use a generic catboat or an older/nonmatching sail treatment. A Lynx visual must preserve the broad recreational catboat silhouette and black-sail cue unless a newer MIT source proves otherwise. |
| Mashnee | Use MIT fleet/bluewater pages plus the user-provided Mashnee source as reference. The MIT fleet page identifies Mashnee as a Buzzards Bay 30 built by Herreshoff in 1902; the Classic Sailboats page provides the current reference profile and specifications. | Do not substitute a generic keelboat, dinghy, race boat, or modern yacht. Mashnee should read as a classic restored bluewater boat. |

Allowed image/reference sources: current MIT Sailing pages, current `wp.mitsailing.com` pages, and the user-provided Mashnee reference. The Facebook image supplied by the user is only a visual guardrail and must not be used as an asset. If a current, permission-clear image cannot be verified, the prototype should use no boat photo or a clearly draft, source-faithful treatment and mark production imagery as blocked.

## Pre-April Access Setup Case Study

Research question: if the waitlist opens April 1, why would a user sign up before April 1?

Case-study pattern: strong pre-gate flows do not pretend the final scarce action is available early. They let the user finish setup, bind access to an account, and make the gate-opening action fast when the window actually opens.

| Pattern | Source | What users get before the gate opens | MIT Sailing decision |
| --- | --- | --- | --- |
| Pre-order readiness | Apple App Store pre-orders let people order before release, then notify/download on release day. Source: https://developer.apple.com/app-store/pre-orders/ | The user completes setup before release and gets release-day follow-through. | MIT cannot issue a waitlist number before April 1, so the equivalent is saved account/contact/terms setup plus Apr 1 notification, not early waitlist entry or generated URLs. |
| Presale registration | Ticketmaster presales may require signup or a code before the sale. Source: https://help.ticketmaster.com/hc/en-us/articles/9702132309905-How-do-presales-work | The user prepares account/access before inventory opens. Codes or access do not guarantee the scarce item. | MIT should make setup useful without promising acceptance: account, phone, terms, SMS consent, and a clear return path when the waitlist opens. |
| Verified-access waiting room | Ticketmaster Verified Fan binds registration, texted instructions/codes, and sale access to the same account. Source: https://blog.ticketmaster.com/taylor-swift-the-eras-tour-2024/ | The user gets account-bound instructions and must use the same account when the sale opens. | MIT should notify the saved account when the waitlist opens; after Apr 1 the user joins the annual waitlist through the normal waitlist page. |
| Availability notification | SignUp.com lets participants request notification when spots become available. Source: https://signuphelp.zendesk.com/hc/en-us/articles/1260805110170-Can-I-get-notified-when-the-Organizer-adds-new-Spots-to-a-SignUp | The user does not get the spot early; they get notified when action becomes possible. | SMS/email before Apr 1 is useful only if paired with saved setup and a clear next action, not a passive reminder or generated link. |
| Robinhood-style waitlist | Waitlister's Robinhood case study highlights frictionless signup, visible confirmation, and clear next steps after signup. Source: https://waitlister.me/growth-hub/case-studies/robinhood | The user immediately sees that signup worked and what happens next. | Use visible readiness steps and confirmation. Do not use referrals or sharing to change MIT waitlist position. |

Impeccable decision: pre-April is `Apr 1 access setup`, not `April 1 reminder`. The UI must show the object being prepared:

1. Account identity.
2. Phone and optional SMS consent.
3. Required terms/privacy acceptance.
4. Apr 1 email/SMS notification state.

The saved state should say the user is ready for Apr 1 and can edit setup. It must not show a generated URL, waitlist number, `Open`, `Reminder saved`, a fake class date, or any class request action before Apr 1.

## Public Terminology Decision

Use `waitlist` for the public product noun, `waitlist number` for the user's rank, and `No waitlist` for first-come classes.

Do not use `priority queue`, `priority list`, `queue order`, or `priority waitlist` in public UI. Reserve `Priority Queue` only when quoting the legacy source pages.

Reason: MIT student-facing registration pages use `waitlist`, `waitlist number`, and `waitlist position`. `Priority queue` reads as internal/technical; `priority list` sounds discretionary. `Waitlist number` is familiar to college students and still explains class acceptance order.

Approved public copy patterns:

- `Join the waitlist first`
- `Class seats go by waitlist number.`
- `Request each class. Among requesters, waitlist number decides.`
- `Waitlist #184`
- `Not first-come`
- `No waitlist`

Terminology sources:

- MIT Registrar: https://registrar.mit.edu/registration-academics/academic-requirements/limited-enrollment-waitlists
- MIT Physical Education and Wellness: https://physicaleducationandwellness.mit.edu/registration-information/registration/waitlist/
- UC Davis Registrar: https://registrar.ucdavis.edu/registration/register-for-classes/wait-lists

## Current Website Evidence

Current page inspected:

`https://sailing.mit.edu/calendar/events/entries.php?id=484a231d05ee0b8331980daf4c1749fb`

Observed source evidence:

| Finding | Evidence | Confidence | Impact |
| --- | --- | --- | --- |
| Current page is named "MIT Sailing: Learn-to-Sail Priority Queue Entries". | HTML `<title>`. | `confirmed_by_source` | Legacy wording is "Priority Queue", but new product language should likely use "Waitlist". |
| Page heading is "Learn-to-Sail Classes 2026: Information/Priority Queue". | HTML `<h1>`. | `confirmed_by_source` | Existing workflow is a yearly class-info/priority-queue page; new public UI should translate this to "waitlist". |
| Current registration starts March 31, 2026 at 00:00 and ends September 30, 2026 at midnight. | HTML registration table. | `confirmed_by_source` | Conflicts with new April 1 reset and class-specific request windows. |
| Entries table shows `Reg #`, `Last Name`, `First Name`, and `Status`. | HTML table header. | `confirmed_by_source` | Current UI exposes queue position and status in one public list. |
| Status values include `Pending` and `Confirmed`. | HTML row statuses plus user clarification. | `confirmed_by_source` | These are fake-event waitlist statuses, not weekly class request acceptance statuses. `Confirmed` means took class and no longer on waitlist. |
| Current page publicly exposes names, account links, registration numbers, and statuses. | HTML entry rows. | `confirmed_by_source` | Privacy/product blocker: decide whether new app should publicly expose waitlist identity/status. |

## Legacy Class Registration Evidence

Current pages inspected:

`https://sailing.mit.edu/lts/wed.php`

`https://sailing.mit.edu/calendar/events/event.php?id=415185ea244ea2b2bedeb0449b926802`

`https://sailing.mit.edu/event_reg.php?id=415185ea244ea2b2bedeb0449b926802`

`https://sailing.mit.edu/calendar/events/event.php?id=baed9f51d412c2514ee46a0942138ad6`

`https://sailing.mit.edu/calendar/index.php?cal=month&year=2026&month=6&type=8`

Additional sampled register pages:

`https://sailing.mit.edu/event_reg.php?id=587b7b833034299fdd5f4b10e7dc9fca`

`https://sailing.mit.edu/event_reg.php?id=bdc363788b2b48c031bf406cf15aa252`

`https://sailing.mit.edu/event_reg.php?id=3d3d286a8d153a4a58156d0e02d8570c`

Observed source evidence:

| Finding | Evidence | Confidence | Impact |
| --- | --- | --- | --- |
| The mid-week Learn-to-Sail list shows scheduled classes before they are registerable. | `lts/wed.php` table lists future classes with `Date`, `Time`, `Event`, `Entries`, and `Sign Up`. | `confirmed_by_source` | New UI should allow scanning future classes without implying every class is open. |
| The June 9, 2026 class has sessions on June 9, June 10, and June 11. | Class register page event datetime table. | `confirmed_by_source` | Class request timing is relative to the first session, not the entire annual waitlist. |
| Mid-Week 1-2-3 is a three-session series on Tues/Wed/Thurs, and the source says lessons are offered on 3 consecutive days. | `/lts/wed.php`. | `confirmed_by_source` | Dashboard cards must not represent a Mid-Week cohort as a single-day class. |
| The June 9, 2026 class event fields show registration start June 8, 2026 at 00:00 and registration end June 8, 2026 at midnight. | Class event and register page registration table. | `confirmed_by_source` | The event fields encode a class-specific registration window. |
| The June 9, 2026 register-page body says registration runs midnight to 10:00 AM Monday, June 8, and confirmations go out Monday afternoon. | Register-page body copy. | `confirmed_by_source` | The body gives a narrower operational deadline than the table; exact source of truth must be approved before coding. |
| The June 9, 2026 register page shows `Registration has not yet begun` while still rendering registration/account fields. | Register-page notice. | `confirmed_by_source` | Runtime proof must verify blocked submission before the window and enabled submission during the window. |
| Sampled future register pages use the Monday before the Tuesday first class as the registration date. | June 16 class uses June 15; June 23 class uses June 22; July 7 class uses July 6. | `confirmed_by_source` | Legacy pattern appears to be Monday-only registration before Tuesday-start cohorts, not 1 week before. |
| The Mid-Week 1-2-3 schedule lists multiple 2026 cohorts: June 9, June 16, June 23, July 7, July 14, July 21, July 28, August 4, August 11, August 18, and August 25. | `/lts/wed.php`. | `confirmed_by_source` | The public dashboard should show multiple upcoming cohorts, not imply there is one Mid-Week class. |
| Sunday All-in-One event page shows a one-day class on Sunday, June 7, 2026 from 09:45 to 15:30, with waitlist-ranked confirmation. | Sunday All-in-One event page. | `confirmed_by_source` | Dashboard cards need a day/date/start/end schedule row for one-day intro classes. |
| Intro for Experienced Sailors is a one-day class for experienced sailors new to MIT Sailing and uses first-come, first-served confirmations, not the Learn-to-Sail waitlist. | Intro for Experienced Sailors event page. | `confirmed_by_source` | The no-waitlist experienced path should use this class, not Intermediate Sailing. |
| The June 2026 Learn-to-Series calendar lists Intro for Experienced Sailors on Tuesdays at 17:30-19:00 and Intermediate Sailing on Fridays/Saturdays. | Learn-to-Series calendar month. | `confirmed_by_source` | Public dashboard can show Intro for Experienced Sailors as the experienced-sailor alternative, while treating Intermediate as a next-step class. |
| Intermediate Sailing event page shows Friday, June 5, 2026 from 12:30 to 15:00 and says registration confirms entry, first come first served, Priority Queue does not apply. | Intermediate Sailing event page. | `confirmed_by_source` | Dashboard cards need a day/date/start/end schedule row and must mark the waitlist as not applicable. |
| The class register page tracks class-level `Confirmed` and `Awaiting Confirmation`. | Registration status summary. | `confirmed_by_source` | Class-level confirmation status is distinct from fake-waitlist `Confirmed`, which means completed/took class. |
| Registering for the event does not confirm entry into the class; confirmation order is based on legacy Priority Queue position and current MIT Recreation/Athletic Membership. | Class event and register-page copy. | `confirmed_by_source` | New UI needs a request/awaiting state distinct from accepted/confirmed, and should call this the user's waitlist number. |
| Intermediate Sailing registration confirms entry and is first come, first served; the Priority Queue does not apply. | Intermediate Sailing event copy. | `confirmed_by_source` | The public dashboard should distinguish intro classes that use the waitlist from experienced/next-step classes that do not. |

## Supplemental WordPress Content Evidence

The new WordPress content at `wp.mitsailing.com` is additional evidence, not a substitute for `sailing.mit.edu`. Use `sailing.mit.edu` event and registration pages as the source of truth for live event instances, exact event dates/times, registration windows, and current registration state. Use `wp.mitsailing.com` for additional informational copy, route structure, class agendas, and user-path framing unless it conflicts with live event data.

Current WordPress pages inspected:

`https://wp.mitsailing.com/learn/learn-to-sail/`

`https://wp.mitsailing.com/learn/learn-to-sail/priority-que/`

`https://wp.mitsailing.com/learn/learn-to-sail/lts-1-2-3/`

`https://wp.mitsailing.com/learn/learn-to-sail/all-in-one/`

`https://wp.mitsailing.com/intro-for-experienced-sailors/`

`https://wp.mitsailing.com/learn/learn-to-sail/intermediate-sailing/`

`https://wp.mitsailing.com/learn/learn-to-sail/provisional-rating/`

`https://wp.mitsailing.com/learn/learn-to-sail/provisional-rating/boardsailing/`

`https://wp.mitsailing.com/lynx-catboat/`

`https://wp.mitsailing.com/fleets/`

`https://wp.mitsailing.com/ratings/`

`https://wp.mitsailing.com/bluewater-crew-rating/`

`https://wp.mitsailing.com/bluewater-crew-rating-2/`

`https://wp.mitsailing.com/directions-to-waterboat-marina-2/`

`https://wp.mitsailing.com/swimming-requirement/`

`https://wp.mitsailing.com/membership/`

Observed WordPress evidence:

| Finding | Evidence | Confidence | Impact |
| --- | --- | --- | --- |
| WordPress Learn to Sail page separates beginner and experienced paths. | `/learn/learn-to-sail/` says new sailors use Midweek 1-2-3 or Sunday All-in-One; previous sailors register for Intro for Experienced Sailors to learn how the Pavilion works. | `confirmed_by_source` | End-user walkthroughs must test at least three personas: soonest beginner class, limited-schedule beginner, and experienced sailor new to MIT. |
| WordPress Priority Queue page describes the same two-layer workflow: join the queue, then register for a particular class. | `/learn/learn-to-sail/priority-que/` says users add their name to the Priority Queue, then register for the next class they can attend; selections use the lowest queue positions among class registrants. | `confirmed_by_source` | Supports the dashboard model: annual waitlist first, then per-class request; public copy should keep this understandable without implying first-come class acceptance. |
| WordPress says all beginner classes use the same Priority Queue. | Priority Queue page says all beginner classes, Midweek 1-2-3 and Sunday, use the same Priority Queue. | `confirmed_by_source` | User should not see separate waitlists per class type. |
| WordPress Midweek 1-2-3 page says the class is Tue/Wed/Thu 17:30-19:30 and users should choose a week where they can attend all three evenings. | `/learn/learn-to-sail/lts-1-2-3/`. | `confirmed_by_source` | Midweek cards need three separate schedule rows and must visually communicate all three sessions. |
| WordPress Sunday All-in-One page describes a one-day bootcamp and lists Sunday 09:00-14:00. | `/learn/learn-to-sail/all-in-one/`. | `confirmed_by_source` | Conflicts with current `sailing.mit.edu` Sunday event/list times of 09:45-15:30; use live event data for actual class instances until product resolves placeholder defaults. |
| WordPress Intro for Experienced Sailors page says it is an orientation for members who know how to sail, covers Pavilion orientation and Tech Dinghy rigging, and does not include on-water time. | `/intro-for-experienced-sailors/`. | `confirmed_by_source` | Experienced sailors should not be forced through the beginner waitlist path; the UI should route them to a first-come experienced orientation path. |
| WordPress Intro for Experienced Sailors page lists Tuesday 17:30-19:30. | `/intro-for-experienced-sailors/`. | `confirmed_by_source` | Conflicts with sampled `sailing.mit.edu` event and calendar duration of 17:30-19:00; use live event data for dated instances and treat WP as class-description/template evidence. |
| WordPress Provisional Rating page lists Learn-to-Sail class or Intro for Experienced Sailors as a prerequisite and calls Provisional the first step in sailing other Pavilion boats. | `/learn/learn-to-sail/provisional-rating/`. | `confirmed_by_source` | The experienced-sailor journey should show Intro for Experienced Sailors as the first MIT-specific step, with Provisional and other boat ratings as follow-on paths. |
| WordPress ratings and fleet pages tie ratings to boats and wind conditions. | `/ratings/` and `/fleets/`. | `confirmed_by_source` | Dashboard should not imply Learn-to-Sail waitlist controls every boat; boat/rating pages are separate next-step paths. |
| WordPress Lynx Catboat page says Provisional Rating is a prerequisite and Lynx accommodates up to 8 people. | `/lynx-catboat/`. | `confirmed_by_source` | After Intro/Learn-to-Sail and Provisional, Lynx is a distinct class/rating path, not part of the beginner waitlist. |
| WordPress Windsurfing page says prerequisite is Learn-to-Sail class or Intro for Experienced Sailor class and lists Friday 17:30-20:00, summer only. | `/learn/learn-to-sail/provisional-rating/boardsailing/`. | `confirmed_by_source` | Windsurfing is another follow-on path; it should not be merged into beginner waitlist ranking. |
| WordPress Bluewater pages say Mashnee is a learning boat and no formal class is required to start sailing Mashnee; Bluewater Crew Rating organizes developing competence. | `/bluewater-crew-rating/` and `/bluewater-crew-rating-2/`. | `confirmed_by_source` | Experienced/general sailors may need a path to Mashnee information without being trapped in the beginner waitlist. |
| WordPress membership and swimming pages state account/card/swim prerequisites for using the Pavilion. | `/membership/` and `/swimming-requirement/`. | `confirmed_by_source` | Account and eligibility copy in this waitlist feature must remain compatible with the broader Sailing Card, MITNA, MIT Recreation, and swim requirements. |

## End-User Walkthrough Audit

Archetype: public class registration dashboard.

Primary job: help a new or returning sailor choose the right first class path and act without reading policy prose.

Current score after persona-review refinement: 93/100. The static flow is strong for beginner class requests, limited-schedule comparison, experienced-sailor routing, and pre-April access setup, but release readiness still depends on approved product rules, live-source verification, implementation tests, and human UX approval.

Independent persona reviews before the latest refinement scored 82/100, 84/100, and 82/100. Their blocking findings were timeline inconsistency, speed-coded class-request labels, hidden three-session commitment, and the experienced-sailor path reading as secondary. The static HTML now treats waitlist-ranked classes as class requests, uses the next future Sunday window in the open-state mockup, adds a compact beginner/experienced path chooser, and includes the missing next-sailing-steps state.

Independent mobile persona reviews then scored 84/100, 84/100, and 80/100. Their blocking findings were a misleading active path-choice style, pre-April signup looking like a reminder with no product value, class format comparison appearing too late on mobile, speed-coded wording for class requests, and experienced sailors not seeing the Tech Dinghy outcome soon enough. The static HTML now removes selected styling from the informational path chooser, makes pre-April setup save account/contact/terms plus Apr 1 notification readiness, shows class formats before signup fields, uses `request` language, raises mobile tap targets, and names Tech Dinghy orientation on experienced-sailor cards.

Personas to test before coding:

| Persona | Goal | Expected path | Current static score | Blocking misunderstanding to prevent |
| --- | --- | --- | --- | --- |
| Soonest beginner | Take the soonest beginner intro class possible. | Set up Apr 1 access before the season, join annual waitlist once live, scan open and upcoming Mid-Week/Sunday cards, request a class when its window opens, then wait for selection by waitlist number. | 93/100 | Thinking midnight speed decides acceptance instead of waitlist number among requesters. |
| Limited-schedule beginner | Find a class that fits around classes, work, or travel. | Compare Mid-Week three-session rows against Sunday one-day rows, then request only classes they can attend. | 92/100 | Missing that Mid-Week requires all three Tue/Wed/Thu sessions. |
| Experienced sailor new to MIT | Start sailing MIT Tech Dinghies without taking the beginner class. | Choose Intro for Experienced Sailors, register first come, then use Provisional/fleet/rating pages for next boat paths. | 92/100 | Believing the Learn-to-Sail waitlist is required for experienced-sailor orientation or all MIT boats. |

Audit findings:

1. High: any class-choice dashboard state that hides Intro for Experienced Sailors sends experienced sailors into the wrong beginner waitlist path.
2. High: beginner class cards must show the user's waitlist number, the request window, and `Not first-come` together, or users will treat the class request as a race.
3. High: Mid-Week cards must show three separate date/time rows. A single Mid-Week date is misleading.
4. Medium: aggregate waitlist count is useful only beside join-waitlist social proof. After joining, the user's private waitlist number and next class action matter more.
5. Medium: no-upcoming-class states still need class-type placeholders with normal times, so users know the season will have Mid-Week, Sunday, and experienced-sailor options.
6. Medium: pre-April signup must show a saved setup object, not just copy about April 1. The object is saved account/contact/terms readiness plus Apr 1 notification state; it is not a generated URL.
7. Medium: mobile path chooser must read as information or real navigation, not as a selected segmented control unless tapping it changes the page.

Required design rules from this audit:

1. Every public dashboard state that shows class choices must show beginner waitlist classes and the no-waitlist experienced-sailor path, unless a human explicitly approves a narrower state.
2. Intro for Experienced Sailors must never require joining the annual Learn-to-Sail waitlist.
3. Beginner waitlist cards must use request-language for the visible action, paired with `Not first-come` and the user's waitlist number.
4. Experienced-sailor cards should use `No waitlist`, `First come, first served`, and a day/date/start/end row.
5. Follow-on boat/rating paths, such as Provisional, Lynx, windsurfing, Mashnee, and fleet pages, are adjacent navigation after orientation. They are not part of beginner waitlist ranking.
6. Before April 1, public UI uses access-readiness structure: setup steps, class format comparison, and Apr 1 email/SMS notification readiness after account creation/sign-in.
7. Mobile tap targets for public actions must be at least 44px high in the static design and implemented UI.

## Expert Review Decision

Three expert lenses reviewed four options for the MVP registration surface:

| Lens | Pick | Reason |
| --- | --- | --- |
| Product UX | Structured dates plus optional `selectionAnnouncementAt`. | Answers the two public questions directly: when can I request, and when will I know. Avoids stale catch-all text. |
| Admin operations | Structured dates plus optional `selectionAnnouncementAt` and optional `registrationNote`. | Gives staff flexibility for class-specific exceptions. |
| Implementation/testing risk | Structured dates plus optional `selectionAnnouncementAt`. | Keeps behavior typed, testable, and driven only by structured fields. |

Decision after user revision: use structured `registrationStart`, `registrationEnd`, and optional `selectionNote` for MVP. Do not add `selectionAnnouncementAt` or `registrationNote` in MVP.

Reason: the expert review favored a narrow announcement field over broad registration prose, and the legacy register page uses approximate wording: confirmations go out Monday afternoon. `selectionNote` preserves that flexibility while keeping request open/closed behavior driven only by structured request dates.

Guardrail: `selectionNote` is short plain text, display-only, previewed in admin, and never used for registration eligibility, waitlist ranking, class acceptance, jobs, or notification send timing.

Deferred options:

1. A precise `selectionAnnouncementAt` datetime can be reconsidered only if staff need exact countdowns or automated reminders.
2. A broad plain-text `registrationNote` can be reconsidered after static HTML review only if a real class-specific message cannot be handled by the structured states. If added later, it must be display-only, plain text, length-capped, previewed in admin, and never used for validation or eligibility.

## Repo Evidence

| Finding | Source | Confidence | Impact |
| --- | --- | --- | --- |
| Waitlist implementation appears planned, not implemented. | `rg LearnToSailWaitlist`, `rg learn_to_sail_waitlist`; hits only planning docs, not source/schema. | `confirmed_by_source` | Do not claim current app implements waitlist. |
| Existing planning docs map waitlist work to issues #135-137. | `docs/ai/linear-membership-pricing-project-plan.md`. | `confirmed_by_source` | Existing project intent exists, but latest user requirements supersede parts of older plan. |
| Existing detailed plan uses April 1 through October 15 open season. | `docs/superpowers/plans/2026-05-28-learn-to-sail-waitlist.md`. | `confirmed_by_source` | Conflicts with latest "resets every April 1" and per-class request windows; reconcile before coding. |
| Event registration status enum is `pending`, `approved`, `cancelled`. | `zenstack/schema.zmodel`. | `confirmed_by_source` | Existing lifecycle may support weekly class request acceptance, but the legacy waitlist page's `Confirmed` meaning must not be copied blindly. |
| Event supports `requiresApproval`, `registrationStart`, and `registrationEnd`. | `zenstack/schema.zmodel`. | `confirmed_by_source` | Existing event windows may be reusable or insufficient for per-class request windows. |
| Public event registration branches to `pending` when `requiresApproval` is true, otherwise `approved`. | `src/libs/mit-sailing/eventRegistrationActions.ts`. | `confirmed_by_source` | Existing approval lifecycle can likely be reused for class request acceptance. |
| Public reservation state already supports `approved`, `pending`, `opening_later`, `closed`, `full`, and `available`. | `src/libs/mit-sailing/eventRegistrationState.ts`. | `confirmed_by_source` | UI state machinery exists, but waitlist-specific states must be distinct. |
| Learn-to-Sail seed events exist and each weekday cohort is a separate event. | `src/data/mit-sailing/eventsSeed.ts`. | `confirmed_by_source` | Existing event model can represent per-class requests, but seed windows do not match latest rules. |

## Twilio SMS Evidence

Current Twilio guidance inspected:

`https://www.twilio.com/docs/messaging/compliance/a2p-10dlc`

`https://www.twilio.com/docs/messaging/features/compliance-toolkit`

Observed source evidence:

| Finding | Evidence | Confidence | Impact |
| --- | --- | --- | --- |
| US application-to-person SMS over 10DLC requires A2P registration. | Twilio A2P 10DLC docs. | `confirmed_by_source` | SMS cannot be release-ready until Twilio brand/campaign setup is approved. |
| A2P registration requires describing how users opt in, opt out, and get help. | Twilio A2P 10DLC docs. | `confirmed_by_source` | Waitlist SMS needs explicit opt-in, STOP/HELP behavior, and consent records. |
| Twilio documents TCPA quiet hours as 9:00 PM to 8:00 AM recipient local time for US recipients, with compliance tooling around quiet-hour handling. | Twilio Compliance Toolkit docs. | `confirmed_by_source` | Midnight SMS is a release-risk decision and must be explicitly approved, opt-in, and tested. |
| Twilio Compliance Toolkit can classify message intent and treat some notifications differently from non-essential messages. | Twilio Compliance Toolkit docs. | `confirmed_by_source` | Implementation must set and document message intent instead of relying on default classification. |

## Blocker Ledger

| ID | Blocking unknown | Why it blocks | Current action |
| --- | --- | --- | --- |
| B1 | What exact default class request window should the new app prefill? | Legacy register-page body says midnight to 10:00 AM Monday; event fields show registration start/end on the same Monday. The cutoff changes UI state, validation, tests, and notification timing. | Proposed default: Monday 00:00-10:00 before Tuesday-start cohorts. |
| B2 | How should admins change the request window for a specific class? | The user requires timing to be easy to change. This blocks admin UX, validation, and proof tests. | Proposed: editable event-level `registrationStart` and `registrationEnd` remain the stored source of truth. |
| B3 | Should confirmation/announcement wording be editable separately from request close time? | Legacy copy says confirmations go out Monday afternoon, which is useful but not a precise datetime. | Proposed: add optional editable `selectionNote` per class; treat it as public expectation/display copy, not a hard-coded selection job in MVP. |
| B4 | What happens to previous-season entries on April 1? | Changes retention, audit, public position, and active-entry constraints. | Block schema. |
| B5 | What timezone defines April 1, request open, request close, and confirmation windows? | Boundary behavior must be deterministic. | Proposed: America/New_York, needs approval. |
| B6 | Is selection staff-reviewed from a sorted list, automatic, or scheduled batch? | Changes admin UI, jobs, notifications, and test plan. | Ask product/ops before assignment slice. |
| B7 | Can one user request multiple classes at the same time? | Changes request uniqueness, conflict checks, and UI. | Block class request model. |
| B8 | Can one user be accepted into multiple intro classes in a season? | Changes eligibility and acceptance rules. | Block assignment model. |
| B9 | What happens when an accepted user cancels before class? | Determines promotion behavior and notification sends. | Block promotion logic. |
| B10 | What happens after a no-show? | Determines future eligibility and admin state. | Defer unless no-show policy is MVP. |
| B11 | Should public UI show annual waitlist number? | Current site shows numbers, but high numbers can still be accepted; could confuse users. | Needs static HTML approval. |
| B12 | Should the new app publicly expose names/account links/statuses like the current site? | Current page exposes PII-like identity/status. | Block public roster design. |
| B13 | Is email in MVP? | Requires template, send timing, idempotency, and suppression behavior. | Block notification slice until approved. |
| B14 | How should Twilio SMS opt-out, quiet-hours handling, and A2P registration work? | SMS is now in MVP and includes a midnight registration-open text, which creates compliance and UX release risk. Consent location is approved: Learn-to-Sail waitlist signup. | Block SMS implementation until consent copy, STOP/HELP behavior, A2P setup, message intent, and midnight send policy are approved. |
| B15 | Can the agent access `sailing.mit.edu` live pages during planning and verification? | The feature depends on current legacy class pages, registration pages, class-list pages, and fleet/rating pages. Without live access, the agent cannot prove class timing, eligibility, registration copy, or experienced-sailor paths are current. | Try direct access first. If blocked, use the user's Chrome browser through Codex. If both fail, block implementation until access is restored or the user provides a current snapshot. `wp.mitsailing.com` may be used as additional content evidence, not as a substitute for `sailing.mit.edu`. |

## Proposed MVP Decisions Requiring Approval

These are defaults for discussion, not implementation authorization.

| Decision | Proposed MVP | Reason |
| --- | --- | --- |
| Annual waitlist closure | Close the annual waitlist entry after the person takes the class. | Matches current-site clarification that `Confirmed` means took class and no longer on waitlist. |
| Class request source of truth | Use editable `registrationStart` and `registrationEnd` event fields as the stored source of truth. | Matches existing repo model and lets staff change timing without code edits. |
| Learn-to-Sail default timing | Auto-fill Tuesday-start cohorts with Monday 00:00 open and Monday 10:00 close before the first class, but allow admins to override both fields per class. | Matches register-page body copy while keeping the rule easy to change. |
| Timing rule location | Put Learn-to-Sail default timing in one named helper/config path with focused tests. | Prevents scattered date math and makes future policy changes small. |
| Selection note | Add an optional editable class-level `selectionNote` short plain-text field. If set, public UI can show compact copy such as `Decisions Monday afternoon`; if blank, no selection note is shown. | Matches legacy approximate timing language without requiring a precise datetime; remains display-only. |
| Registration note | Do not add a class-level `registrationNote` field in MVP. | Expert review found it likely to become stale policy prose or contradict structured request state. |
| Confirmation timing | Staff sends confirmations Monday afternoon for Tuesday-start cohorts in MVP; notification timing must be editable/manual and may use `selectionNote` for UI copy, not as an irreversible scheduled job. | Matches register-page body copy and leaves operations flexible. |
| Timezone | America/New_York. | Matches venue and existing app date rules. |
| Selection mode | Staff-reviewed sorted requester list. | Safer than automatic selection while product rules settle. |
| Public terminology | Use `waitlist` for the product noun, `waitlist number` for the user's order, and `No waitlist` for first-come classes. Avoid `priority queue` and `priority list` in public UI except when quoting legacy pages. | Students already know course waitlists; this avoids CS jargon while still explaining acceptance order. |
| Public waitlist number | Show concise waitlist proof near the join-waitlist CTA, and show the signed-in user's private waitlist number after they join. | The total count helps users understand that joining first matters; the private number explains class acceptance order without exposing a roster. |
| Upcoming class dashboard | Show upcoming Learn-to-Sail class paths and at least one experienced/next-step class path when available. Use the same class-card structure before registration opens and while registration is open: not-open cards show the registration-open date/time and disabled action; live cards show the action. Label which classes use the waitlist and which do not. | Helps users see that the waitlist is for intro class acceptance, not every sailing class, while keeping open/not-open states easy to compare. |
| Pre-April dashboard | Before April 1, show Apr 1 access setup, not a disabled waitlist join or passive reminder. Logged-out users can provide email, optional mobile phone, required terms/privacy agreement, and optional SMS consent, then continue to account creation or sign-in. The first screen shows readiness steps and class-format choices. After account creation/sign-in, the saved state shows that Apr 1 notification will return them to the normal Learn-to-Sail/waitlist page; no custom Apr 1 URL is generated. Class-type cards for Mid-Week 1-2-3, Sunday All-in-One, and Intro for Experienced Sailors still show known meeting days and start/end times with `date TBD`. | Users can do useful work before April 1 without receiving a waitlist number before the annual waitlist opens, and the UI does not imply unsaved data has been persisted. |
| Public identity/status list | Do not expose full public names/account links by default. | Current page does this, but privacy should be explicitly approved. |
| Email | Include after request/acceptance template and send-log plan. | Useful, lower compliance burden than SMS. |
| SMS | Include Twilio SMS in MVP for opted-in users: 24-hour registration heads-up plus a midnight text with the normal calendar event page URL. For waitlist-ranked intro classes, copy must make the event page convenient without implying that midnight speed changes acceptance order. | Matches user requirement, uses the existing calendar/event flow, and avoids invented custom registration URLs. |
| SMS consent | Capture explicit Learn-to-Sail SMS opt-in during waitlist signup; store consent timestamp/source and support STOP/HELP. | Matches user requirement and gives consent a clear product moment. |
| Midnight SMS | Send the normal calendar event page URL at midnight only to users who opted into Learn-to-Sail registration texts, with the opt-in copy making overnight texts explicit. | Matches user requirement while making the unusual send time a deliberate user choice. |
| SMS fallback | Public UI and email must still work without SMS. | Users may not consent to SMS or may have deliverability failures. |

## Recommended Blocker Resolutions

These are product recommendations to review. They are not implementation approval.

| Blocker | Recommended MVP resolution | Why |
| --- | --- | --- |
| April 1 reset | Preserve old annual waitlist entries for admin history, mark them inactive for the new season, and start the new active season at position 1. | Keeps audit/history without confusing current-season users. |
| Multiple class requests | Allow users to request multiple future classes while they are active on the annual waitlist. | Matches the idea that a high number can still get in based on who requests each class. |
| Multiple acceptances | Prevent a user from being accepted into more than one active intro class at a time. | Avoids taking multiple seats while still allowing staff to handle exceptions manually. |
| Cancellation before class | If an accepted user cancels before the first class, keep their annual waitlist entry active and allow staff to promote the next eligible requester. | Preserves fairness and avoids punishing a cancellation before attendance. |
| No-show | Leave the annual waitlist entry active until staff marks the outcome; staff can mark took class, no-show, or keep active. | Avoids automatic punitive behavior and keeps MVP staff-reviewed. |
| Public waitlist number | Show `1,324 on the waitlist` as short social proof near `Join the waitlist first`; do not show a public ranking list. Signed-in users may see their private waitlist number. | The count supports the prerequisite, while the user's own number supports class acceptance order without exposing names or implying a fixed top-N cutoff. |
| Public identity/status list | Do not expose public names, account links, or statuses in MVP. | Legacy page exposes this, but privacy risk is unnecessary for the MVP. |
| Sharing | Allow a simple share/copy-link affordance only after the user has joined the waitlist; do not attach referrals, rewards, rank changes, or priority changes. | Keeps a Robinhood-style post-join sharing moment without making sharing a prerequisite or priority mechanic. |
| Staff selection | Use a staff-reviewed requester list sorted by annual waitlist position and eligibility. | Keeps selection transparent to staff and avoids premature automation. |
| Email | Include email for request receipt and acceptance/not-accepted outcomes after templates and send-log behavior are approved. | Email is a useful fallback and lower risk than SMS. |
| Twilio SMS | Include SMS for opted-in users only: 24-hour heads-up and midnight event-page URL. | Supports timely requests through the existing event page while keeping opt-in explicit and avoiding first-come-first-served messaging for waitlist-ranked classes. |

## Wording Drift Audit

Root cause of the custom-link wording error: the user requirement said SMS should send a link so users can quickly register for an event. The packet over-inferred that into generated/account-bound request or join URLs, influenced by pre-gate case studies and generic registration-link language. The corrected requirement is narrower: SMS/email notifications point users to the normal calendar event page, and the event page is where request/register happens.

Audit result after correction:

1. Current packet and static prototype no longer say `request link`, `registration link`, `live-link`, `quick register`, or `account-bound join link`.
2. The packet explicitly says no custom registration URLs are generated for the MVP.
3. The packet explicitly says no custom Apr 1 URL is generated.
4. The static prototype says `midnight event page`, not `midnight request link`.
5. Beginner Mid-Week and Sunday states still use one shared beginner waitlist/waitlist number; no separate class waitlists were found in the current packet or prototype.

Remaining blocker from the same drift class: older planning docs still conflict with this packet. Before coding, update or explicitly supersede older Learn-to-Sail waitlist plans so a worker cannot accidentally revive stale assumptions.

## Draft SMS Copy

SMS copy is product copy and compliance-sensitive. Final copy must be approved before implementation.

Waitlist signup opt-in:

```text
Text me when Learn-to-Sail registration is about to open. MIT Sailing may send a 24-hour reminder and a midnight calendar event page for classes I can request. Among requesters, waitlist number decides. Reply STOP to opt out.
```

24-hour heads-up:

```text
MIT Sailing: <class name> requests open <date/time> and close <close time>. Among requesters, waitlist number decides, not request time inside the window. Reply STOP to opt out.
```

Midnight calendar event page:

```text
MIT Sailing: <class name> request window is open until <close time>: <calendar event page URL>. Among requesters, waitlist number decides. Reply STOP to opt out.
```

SMS copy rules:

1. Include MIT Sailing sender identity.
2. Keep the class name and calendar event page URL short enough for SMS.
3. Include STOP opt-out copy.
4. Do not say the user is accepted until staff accepts the request.
5. Do not send to users who have not explicitly opted into Learn-to-Sail registration SMS.
6. Do not send the midnight SMS unless the opt-in copy made overnight registration-open texts clear.
7. SMS opt-in appears during Learn-to-Sail waitlist signup, not as a hidden default in general account creation.
8. For waitlist-ranked classes, do not use urgency copy that implies midnight registration speed changes acceptance.
9. Do not generate custom registration URLs for the MVP; notifications link to the normal calendar event page.

## Required 100/100 Gates

Before coding:

1. Human approves all product-behavior blockers B1-B15 or explicitly defers a blocker outside the current slice.
2. Human approves whether public waitlist number and public identity/status are shown.
3. Static HTML designs show all public states and admin sorted requester view.
4. Human approves product behavior and UX in the static HTML states.
5. Source evidence map is complete for each implementation slice.
6. Test matrix is approved before implementation.
7. Implementation plan uses tests first.

Before claiming complete:

1. Runtime proof includes acting as a user and proving request submit, status, persistence, staff acceptance, and accepted-user visibility.
2. `selectionNote` renders when set and does not change eligibility, ranking, acceptance, jobs, or notification send timing.
3. Automated tests and browser proof pass on the implemented slice.
4. Human approves product behavior, UX, evidence, and release risk.

Before merge/deploy:

1. Release-risk checklist is approved: privacy, retention, notifications, cancellation/no-show, data migration, rollback, and admin permission risk.

## Known 100/100 Blockers

These blockers must stop an agent from claiming the feature is complete:

| Category | Blocker | Required resolution |
| --- | --- | --- |
| Product behavior | April 1 reset behavior is not approved. | Decide whether old entries are archived, hidden, deleted, or made inactive. |
| Product behavior | Multiple simultaneous class requests are not approved. | Decide whether users can request more than one future class at a time. |
| Product behavior | Multiple accepted classes are not approved. | Decide whether acceptance into one class blocks acceptance into another. |
| Product behavior | Cancellation and promotion behavior is not approved. | Decide whether cancellation reopens promotion and when notifications are sent. |
| Product behavior | No-show behavior is not approved. | Decide whether no-shows remain on the annual waitlist, lose position, or require staff action. |
| UX | Static HTML states are not fully approved. | Produce any missing public/admin states and get human approval before implementation. |
| UX | Public waitlist number placement and copy are not approved. | Confirm the concise join CTA framing: `Join the waitlist first`, `Class acceptance is based on waitlist number`, and `1,324 on the waitlist`. |
| UX/privacy | Public identity/status exposure is not approved. | Decide whether any public roster is allowed. Default is no public names/account links/statuses. |
| Evidence | Admin event editing and requester-review source maps are incomplete. | Inspect exact repo surfaces before planning file changes. |
| Evidence | Existing plan conflicts are not fully reconciled. | Mark latest packet as source of truth and update or supersede older plan before coding. |
| Evidence | `sailing.mit.edu` is not accessible from direct agent requests or the user's Chrome browser. | Stop. Do not code from memory, static mockups, or `wp.mitsailing.com` alone. Restore access or use a human-provided current snapshot of the relevant pages. |
| Proof | Test matrix is not written or approved. | Define unit, integration, and browser proof cases before implementation. |
| Proof | Runtime browser proof does not exist. | Agent must act as user and staff after implementation and record evidence. |
| Release risk | Email scope is not approved. | Decide templates, send timing, idempotency, and whether email is MVP. |
| Release risk | Twilio SMS is not release-approved. | Complete A2P 10DLC setup, SMS consent/STOP/HELP, message templates, midnight send approval, delivery logging, and failure handling before claiming release-ready. |
| Release risk | Data retention and rollback are not approved. | Define migration, archival, rollback, and admin audit behavior before merge/deploy. |

## First Product Question

Can I set the MVP default class request timing to the legacy register-page behavior while keeping it editable per class?

Options:

1. Yes: for Tuesday-start cohorts, prefill requests to open Monday at 00:00, close Monday at 10:00, and let staff send confirmations Monday afternoon.
   - Matches the inspected register pages.
   - Keeps the stored event fields editable per class.
   - Includes an optional editable `selectionNote`, such as `Decisions Monday afternoon`.
   - Does not include an MVP registration note field.

2. Mostly: use Monday registration, but keep the close time as the existing event `registrationEnd` value instead of 10:00.
   - Matches the event fields more literally.
   - Risks keeping signups open later than the page copy says.

3. No: admins should manually set each class's request open/close window and confirmation timing.
   - Most flexible.
   - More admin burden and more room for inconsistent setup.

Recommendation for MVP: Option 1, with explicit event fields as the stored source of truth, auto-filled Learn-to-Sail defaults when cohorts are created, optional `selectionNote`, no MVP `selectionAnnouncementAt`, no MVP `registrationNote`, and one tested helper/config path so future timing changes are small.

## Static HTML Approval Required

Before implementation, create static HTML designs for these states and get human approval. Do not start coding from wireframe prose alone.

Static approval artifact:

`docs/superpowers/specs/2026-06-03-learn-to-sail-waitlist-static-states.html`

Public user states:

| State | User sees | Primary action |
| --- | --- | --- |
| Before April 1 | Learn-to-Sail dashboard shows Apr 1 access setup, not a disabled join action or passive reminder. Logged-out users can enter email, optional mobile phone, required terms/privacy agreement, and optional SMS consent. The screen shows readiness steps and Mid-Week/Sunday format choices before the signup fields. Primary action continues to account creation or sign-in. The first screen must not say setup is saved. No waitlist number is assigned before Apr 1 at 12:00 AM. | Set up notification / sign in to set up. |
| Before April 1, setup saved | After account creation or sign-in completes, the dashboard can show the account email, SMS status when opted in, completed readiness steps, and that Apr 1 notification will return the user to the normal Learn-to-Sail/waitlist page. It must not show a waitlist number or generated URL before Apr 1. | Edit setup / wait for Apr 1 notification. |
| Not logged in | Learn-to-Sail dashboard uses the same card structure as the pre-April state. The first card is the waitlist account gate with email, mobile phone, required terms/privacy checkbox, optional SMS consent checkbox, `Continue`, and `Sign in`. Class cards are visible but marked waitlist required. | Continue / sign in. |
| Logged in, not on annual waitlist | The first dashboard card uses the same signup structure as the not-logged-in card, but does not ask for email. It shows the signed-in account email as read-only identity, prefills mobile phone when available, leaves the phone field blank when no phone exists, and includes required terms/privacy agreement, optional SMS consent, and `Join waitlist`. It does not ask the user to create an account or sign in again. | Join waitlist. |
| Annual waitlist share | User can share the Learn-to-Sail link after joining; UI states sharing does not change waitlist position. | Copy link. |
| Logged in, on waitlist, no upcoming classes | The first dashboard card shows the user's private waitlist number and SMS status. The following class-type cards show known class types and times with `date TBD`, not fake events. | Change phone number in profile if needed. |
| Logged in, on waitlist, class not open | The first dashboard card shows the user's waitlist number, next request-open date, and SMS status. Upcoming class cards show meeting date(s), start/end times, waitlist/no-waitlist status, and disabled actions until registration opens. | Disabled action until that class opens. |
| On waitlist, SMS opted in | User sees Learn-to-Sail SMS preference and which texts will be sent. | Edit SMS preference. |
| Request window open | Same class-card dashboard. Signed-in/waitlisted users see class-request actions. Waitlist-ranked intro classes still show that seats go by waitlist number; no-waitlist classes are first come, first served. Other not-open classes still show their registration-open date/time. | Request by close time. |
| Request submitted | Awaiting selection, optional `selectionNote` visible. | Cancel request if allowed. |
| Accepted | Accepted state is obvious and class details are visible. | View details / cancel if allowed. |
| Not accepted | Not accepted state is visible without implying removal from annual waitlist. | Request another class. |
| Took class | Annual waitlist no longer active. | View next sailing steps. |

Admin states:

| State | Staff sees | Required controls |
| --- | --- | --- |
| Class setup | Existing event fields plus Learn-to-Sail defaults. | Edit `registrationStart`, `registrationEnd`, optional `selectionNote`. |
| Request review | Requesters sorted by annual waitlist position and eligibility. | Approve selected requesters, leave others awaiting/not selected. |
| Accepted user cancels | Class has an open spot after acceptance. | Promote next eligible requester or leave spot open. |
| Attendance completion | Accepted class list after class. | Mark took class, which closes annual waitlist entry. |

HTML design acceptance criteria:

1. No paragraph-length explainer text in the primary public flow.
2. Account signup/sign-in, annual waitlist signup, no-upcoming-class, and weekly class request states are visually distinct steps.
3. Request open/closed state is understandable at a glance.
4. Any aggregate waitlist count is used only as concise social proof near the join-waitlist CTA; class pages emphasize the signed-in user's waitlist number and the next class request action.
5. Upcoming class cards distinguish waitlist-ranked intro classes from next-step/experienced classes where the waitlist does not apply.
6. Not-open and open class states use the same card structure, so the user does not have to relearn the page when a request window opens.
7. Not-open class cards show the registration-open date/time and a disabled action; live signed-in/waitlisted cards show a request action with the close-time deadline.
8. Waitlist-ranked intro class cards visually emphasize the user's waitlist number, the request window, and `Not first-come`; SMS calendar-event-page copy is framed as convenience, not an acceptance-order boost.
9. Mid-Week 1-2-3 cards show separate Session 1, Session 2, and Session 3 rows with day/date, separate start time, and separate end time.
10. Sunday All-in-One and Intro for Experienced Sailors cards show day/date, separate start time, and separate end time.
11. Pre-April dashboard does not show an `Open` state, fake event dates, fake class requests, or a waitlist number. The first screen collects email, optional SMS, required terms/privacy agreement, shows readiness steps and class formats, and continues to account creation or sign-in. It must not show saved setup until the account step succeeds. The saved state must show that Apr 1 notification returns the user to the normal Learn-to-Sail/waitlist page; it must not show a generated URL.
12. `selectionNote` cannot be mistaken for a deadline or validation rule.
13. Public pages do not expose names/account links/statuses unless explicitly approved.
14. Share/copy-link UI appears only after joining the annual waitlist and clearly says sharing does not change waitlist position or class acceptance order.
15. Waitlist signup asks logged-out users for email and mobile phone. Logged-in users see account email as read-only identity and mobile phone prefilled when available.
16. Terms/privacy agreement is required in the waitlist signup form.
17. SMS consent is optional and explicitly mentions message/data charges plus late-night texts for waitlist opening, upcoming registration windows, class go-live, and class acceptance.
18. SMS is optional; the public flow still works without SMS consent.
19. Admin controls appear on the event/class setup and class requester review paths, not a detached backend-model page.
20. Every public dashboard state that presents class choices includes Intro for Experienced Sailors as a `No waitlist` path, unless a human explicitly approves excluding it from that state.
21. Intro for Experienced Sailors never asks the user to join the annual Learn-to-Sail waitlist before registration.
22. Experienced-sailor follow-on paths point to orientation, Provisional/fleet/rating guidance, and relevant boat pages; they do not reuse beginner waitlist ranking.
23. Class-choice states include a compact path chooser: new sailors use the beginner waitlist for Mid-Week/Sunday; experienced sailors use Intro for Experienced Sailors without the beginner waitlist.
24. The post-class state shows that the beginner waitlist entry is closed and that Provisional, fleet/rating, Lynx, windsurfing, Mashnee, and Bluewater paths are separate from beginner waitlist ranking.
25. Mobile public actions are at least 44px high, and the path chooser is not styled as an active segmented control unless it is implemented as real navigation.
26. No public waitlist-ranked flow uses `quick registration`, `quick register`, or similar speed-coded wording.

## Fresh-Agent Start Prompt

Use this prompt to start a new agent after this packet is approved:

```text
You are building the MIT Sailing Learn-to-Sail waitlist feature. Start in plan/design mode, not implementation mode.

Read `AGENTS.md` and `docs/superpowers/specs/2026-06-03-learn-to-sail-waitlist-feature-start.md` first. Treat that packet as the source of truth unless the user gives a newer correction.

Goal: design the first implementation slice for a two-layer Learn-to-Sail flow:
1. Annual waitlist entry, resetting every April 1.
2. Weekly class request, ranked among requesters by annual waitlist position and eligibility.

Current MVP decisions:
- Before April 1, users can complete Apr 1 access setup but cannot join the annual waitlist or receive a waitlist number.
- Apr 1 access setup means account identity, phone/SMS choice, required terms/privacy agreement, and Apr 1 notification readiness after account creation/sign-in. No custom Apr 1 URL is generated.
- Do not model pre-April as a passive reminder-only flow. Do not show `Reminder saved`, fake event dates, fake class requests, or waitlist numbers before Apr 1.
- Use editable event-level `registrationStart` and `registrationEnd` as the source of truth for request open/closed behavior.
- Learn-to-Sail defaults may prefill Tuesday-start cohorts with Monday 00:00 open and Monday 10:00 close before the first class, but admins must be able to override per class.
- Add optional class-level `selectionNote`, short display-only text such as `Decisions Monday afternoon`.
- Do not add `selectionAnnouncementAt` in MVP.
- Do not add broad `registrationNote` in MVP.
- `selectionNote` must never affect registration eligibility, waitlist ranking, class acceptance, jobs, or notification send timing.
- Twilio SMS is in MVP for users who explicitly opt into Learn-to-Sail registration texts.
- SMS opt-in is captured during Learn-to-Sail waitlist signup, not silently during general account creation.
- SMS behavior: send a 24-hour heads-up before registration opens, then send a midnight request-window-open text with the normal calendar event page URL. For waitlist-ranked classes, do not imply that midnight speed changes acceptance order.
- Midnight SMS is allowed only when the user has explicitly opted into Learn-to-Sail registration texts and the opt-in copy makes overnight texts clear.
- SMS must support consent records, STOP/HELP behavior, delivery logging, failure handling, and A2P 10DLC readiness before release.
- Public UI and email must still work without SMS.
- Sharing is allowed as a simple copy-link affordance, but it must not change waitlist position, ranking, or class acceptance order.
- A user leaves the annual waitlist when staff marks that they took the class, not when they request or are accepted.
- Do not copy the legacy fake-event status semantics blindly: legacy waitlist `Pending` means still on waitlist; legacy waitlist `Confirmed` means took class and no longer on waitlist.

Before coding:
1. Confirm live access to `sailing.mit.edu` with direct requests. If direct requests are blocked, use the user's Chrome browser through Codex. If both fail, stop and report it as a blocker.
2. Inspect the current repo surfaces for events, event registration, admin event editing, and public event registration state.
3. Re-check the relevant live legacy pages on `sailing.mit.edu`, including waitlist, Mid-Week, Sunday, Intro for Experienced Sailors, registration, fleet, and rating pages. Also inspect relevant `wp.mitsailing.com` content when helpful, but treat it as additional evidence, not a substitute for `sailing.mit.edu`.
4. Produce static HTML designs for the public states and admin states listed in the feature-start packet.
5. Get human approval of the HTML states.
6. Produce a test-first implementation plan with exact files and commands.
7. Treat unresolved product decisions as blockers, especially April 1 reset behavior, multiple class requests, cancellation, no-show, public waitlist number, whether public identity/status lists are allowed, and inability to access `sailing.mit.edu` by both direct requests and the user's Chrome browser.

Required proof after implementation:
- Tests first, then implementation.
- Unit/integration tests for date-window behavior.
- Runtime browser proof acting as a user: join waitlist, view not-open class, request open class, submit request, see awaiting state, staff accepts, user sees accepted state.
- Verify `selectionNote` renders when set and does not change request eligibility.
- Verify waitlist signup SMS opt-in state, 24-hour SMS scheduling, midnight event-page SMS scheduling, STOP/HELP handling, and no-SMS fallback behavior.
```

## Next Product Question

What should happen to previous-season annual waitlist entries on April 1?

Recommendation: preserve old entries for admin history, but make them inactive for the new season and start new active positions at 1. Public UI should only show the current season's active waitlist state.
