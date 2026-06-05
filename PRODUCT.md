# Product

## Register

## Users

MIT Sailing serves several overlapping groups:

- New MIT-community sailors trying to take their first Learn-to-Sail class.
- Busy students with narrow schedules who need to understand which class option fits.
- Experienced sailors new to MIT who need Pavilion orientation, Tech Dinghy rigging, and the correct first MIT-specific class without joining the beginner waitlist.
- Returning sailors checking classes, events, ratings, fleet access, membership, cards, and Pavilion information.
- Staff and volunteers running events, classes, payments, cards, content, and repeat admin workflows.
- Public visitors deciding whether MIT Sailing is open to them and what they can do next.

## Product Purpose

MIT Sailing is the public and operational web product for the Walter C. Wood Sailing Pavilion and MITNA programs on the Charles. It helps eligible people understand what they can do, complete the next task, and return when action becomes possible.

The product must connect public discovery, account creation, membership/card eligibility, event registration, class requests, fleet/rating paths, notifications, and admin operations without making users learn the underlying database model.

Success means a user can look at a page on mobile or desktop and know:

- Am I eligible?
- What is the next action?
- Is this action available now?
- What happens after I act?
- What will MIT Sailing notify me about?

## Current Focus: Event Page Registration

The event page is the common public surface for classes, races, social events, external registrations, informational calendar items, and Learn-to-Sail requests. The registration area must adapt to the event's actual registration mode instead of making every event look like a beginner waitlist class.

The standard event page must support:

- First-come registration where registering confirms the user's spot.
- Approval-required registration where the user requests a spot and waits for review.
- External registration where the event page links to another trusted registration page.
- No-registration events where the page is informational.
- Opening-later, closed, full, pending, approved, payment-due, success, and error states.

The Learn-to-Sail workflow is the most complex event-page variant and has two layers:

1. One annual beginner waitlist opens every April 1 and resets annually.
2. Users on that waitlist request individual beginner classes when those class windows open.

Mid-Week 1-2-3 and Sunday All-in-One share the same beginner waitlist. Each class has limited spots, and that number may change. When more people request a class than can be accepted, waitlist number ranks those requesters for acceptance. Requesting at midnight does not improve acceptance order once the request window is open.

Before April 1, users may complete setup for Apr 1: account identity, email, phone, and required terms/privacy acceptance. SMS consent is deferred — apply after blocker #175 is resolved. Users do not receive a waitlist number until the waitlist actually opens.

Intro for Experienced Sailors is not part of the beginner waitlist. It is the first MIT-specific orientation path for people who already know how to sail and want to use the Tech Dinghy at MIT. Other fleet and rating paths, including Lynx Catboat, Windsurfing, and Mashnee, must stay discoverable without being mistaken for beginner waitlist steps.

Email is the MVP notification path for this event-registration slice. SMS is a separate approval-gated follow-up per `AI_UNKNOWN_BLOCKERS_WAITLIST_PLAYBOOK.md` and GitHub issue #175; do not implement SMS signup, consent copy, late-night text behavior, or registration-open text links until that blocker is resolved.

The current product slice is the event page and its registration surfaces: the event detail shell, the sticky registration panel, the normal `/events/[slug]/register` form, Storybook state coverage for event actions, and the registration/status copy those surfaces show. It is not a new home page, standalone waitlist dashboard, or separate Learn-to-Sail microsite.

## Brand Personality

Friendly, direct, kinetic, civic, competent.

MIT Sailing should feel like a custom 2026 site made for a real waterfront program: fast to scan, warm enough for first-time students, practical under pressure, and unmistakably MIT. It should not feel like a generic SaaS dashboard, an old table-based club site, or a decorative landing page that gets in the way of registering for a class.

The existing home page is not part of this event-registration slice unless the user separately approves that wider work. Event pages are in scope because the registration action lives there.

## Voice

Use plain, specific, action-oriented language. Labels and buttons should say what will happen. Help text should appear only when it changes the user's next action or prevents a real mistake.

Preferred copy:

- "Join the waitlist"
- "Join beginner waitlist"
- "Waitlist #184"
- "Request this class"
- "Not first-come"
- "Sign up for Apr 1 alert"
- "The sooner you join the waitlist, the better"
- "Request time does not change your order"
- "Limited spots"
- "Waitlist order if requests exceed spots"
- "No waitlist"
- "Register for this event"
- "Request a spot"
- "Registration confirms your spot"
- "Text me when registration opens" — deferred; apply after blocker #175 is resolved
- "We will email you when your request is reviewed"

Avoid internal or ambiguous terms in public UI:

- "Priority queue"
- "Priority list"
- "Confirmed" when it could mean either class accepted or completed the fake legacy waitlist event
- "Register now" for a class request that is not accepted yet
- "Register faster" or any copy implying the class request itself changes waitlist order
- "Generated link" or any copy implying a custom registration URL
- "Event admin" or "staff" in public registration copy when "we" or "MIT Sailing" is clearer

## Anti-references

- The legacy table-heavy sailing.mit.edu experience as the visual model.
- Generic SaaS hero/card grids, purple or blue gradients, decorative glassmorphism, glow, bokeh/orb backgrounds, and repeated icon-card templates.
- Nested cards, sharp table-like lines everywhere, and hairline borders plus wide shadows.
- Long explainer paragraphs that compensate for unclear structure.
- Standalone waitlist dashboards or custom landing pages when the event page already contains the user's action.
- Waitlist UI that looks per-class when there is one shared beginner waitlist.
- Waitlist UI that implies a midnight race for class acceptance.
- Public event buttons that use one-off styling instead of the shared button vocabulary.
- Beginner and experienced-sailor paths presented as vague tabs or choices that require reading a paragraph to understand.
- Any redesign, reinterpretation, or color change of the MIT Sailing flag/burgee or MIT logo.
- Spelling out the full Institute name in custom type. Use MIT in plain text, or use official brand assets when an official lock-up is required.
- Blue as the primary wordmark color for "Sailing"; MIT red, black, white, and silver gray are the identity colors.
- Generic boat imagery that shows retired Tech Dinghies, generic white-sail dinghies, generic catboats, or a generic yacht in place of Mashnee.

## Design Principles

- Start from the user path. Identify the actor, their starting point, and the object they are trying to change before adding UI.
- Make scarcity visible without panic. Each class has limited spots; waitlist number ranks requesters when demand exceeds the spots available.
- Show the next action before explaining the system. A page should answer "what can I do now?" first, then show timing and status.
- Make the event page pattern work for all registration modes before specializing Learn-to-Sail.
- Treat dates, windows, and eligibility as product objects. Registration windows, selection notes, class sessions, and notification timing must be shown as structured facts, not buried prose.
- Use modern visual hierarchy, not decoration. Energy should come from photography, typography, spacing, schedule structure, MIT red, and real waterfront details.
- Keep public and admin surfaces related but not identical. Public pages can be more expressive; admin pages stay dense, fast, and repeatable.
- Design mobile as a primary surface. Schedule rows, waitlist status, phone/SMS consent, errors, and CTAs must work in one column without hidden meaning.
- Prove the workflow. Agents must test as real users: not logged in, logged in without waitlist, on waitlist with no classes, on waitlist before a class opens, request open, request submitted, accepted, rejected/full, and error states.

## Accessibility & Inclusion

Target WCAG 2.2 AA for public and product surfaces.

- Every control needs visible labels, meaningful focus states, keyboard access, and touch targets that work on mobile.
- Do not rely on color alone for waitlist status, registration windows, acceptance, success, or errors.
- Error and success messages must be attached to the relevant control or region and should explain the recovery action.
- Motion must respect reduced-motion preferences and communicate state rather than decoration.
- SMS consent is deferred — apply after blocker #175 is resolved. When approved, consent must be optional, explicit, and understandable before signup completes.
- Mobile users, users with limited time, and users unfamiliar with MIT Sailing vocabulary are first-class users, not edge cases.
