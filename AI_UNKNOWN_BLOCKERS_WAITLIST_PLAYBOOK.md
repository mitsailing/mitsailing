# Enterprise AI Feature Packet: Unknowns As Blockers

## Audience

This packet is for experienced software engineers using AI coding agents to build product features in a Next.js, React, and Postgres application. It assumes the engineer understands the stack and wants a repeatable process that prevents agent overconfidence, hidden assumptions, unreviewed product decisions, and unverified claims.

## Purpose

The document teaches one operating rule:

> The AI agent must know what it does not know, classify the risk, and stop when an unknown changes correctness, safety, product policy, data integrity, or user trust.

The example feature is a sailing.mit.edu intro-class waitlist:

- Users sign up and join an annual waitlist.
- The waitlist resets every April 1.
- Users request specific weekly intro classes.
- Class acceptance is based on annual waitlist order among users who requested that class.
- A high waitlist number can still be accepted if earlier users do not request that class.
- The UI must be simple enough to understand at a glance, without explainer paragraphs.
- Email and SMS may notify users when classes open and when requests are accepted.

## Target Standard

The target is not "better prompts". The target is a workflow where an agent cannot proceed past a gate while material unknowns are unresolved.

## Engineer Quickstart

Use this when starting a feature with an AI agent.

1. Paste the Conductor Prompt from this document.
2. Require the agent to fill Gates 0 through 2 before proposing implementation slices.
3. Reject any plan that has product rules without a blocker ledger.
4. Complete Gates 3 through 6 for each slice before a worker writes code.
5. Resolve blockers in this order: product policy, data model, user state, auth/privacy, notifications, implementation details.
6. Split work into slices only after the blocker ledger is stable.
7. For UI-affecting slices, require static HTML state designs for approval before React implementation.
8. Give each worker one slice, resolved blocker IDs, forbidden areas, and verification commands.
9. Run a fresh review agent before merging any implementation slice.
10. Convert every user-caught mistake into a blocker rule or test.

Definition of ready for coding:

- The user path is clear.
- The claim ledger has no unlabeled material claims.
- Current-slice blockers are resolved.
- Gates 3 through 6 are complete for the slice being assigned.
- UI-affecting slices have approved static HTML state designs.
- The implementation slice has explicit file or module boundaries.
- The test plan proves the user-visible behavior and data invariants.
- External sends, production mutation, schema migration, auth changes, and SMS are either explicitly in scope or blocked.

Definition of done:

- The implemented slice matches the resolved product rule.
- Required checks passed or failures are reported exactly.
- The final answer distinguishes verified facts from remaining risk.
- Reviewer findings are fixed or classified.
- Any mistake created a durable rule, test, or packet update.

## Non-Negotiable Standard

Wrong confidence is worse than a clean blocker.

Rank outcomes this way:

1. Correct and verified.
2. Blocked with a precise unknown and next validation step.
3. Narrow progress with labeled assumptions.
4. Confident but unverified output.
5. Incorrect output that appears complete.

An AI agent is not done because it produced a plan, code, or polished answer. It is done when every material claim is either verified or explicitly blocked.

## The Seven-Gate Workflow

Every substantial feature moves through gates 0 through 6. An AI agent may not skip a gate.

| Gate | Name | Output | Exit criteria |
| --- | --- | --- | --- |
| 0 | Intent | User path and product objective | Actor, starting point, object, and outcome are clear. |
| 1 | Evidence | Claim ledger | Material claims are source-backed or marked unknown. |
| 2 | Blockers | Blocker ledger | Current-slice blockers are resolved with evidence, or the slice explicitly excludes them with forbidden-area guardrails. |
| 3 | Product rule | MVP rule and assignment model | Product-sensitive blockers are resolved before implementation. |
| 4 | UX state | State labels, actions, accessibility constraints, and static HTML approval for UI slices | Users can infer status and next action without explainer paragraphs. |
| 5 | Data integrity | Invariants, constraints, transactions, and tests | Schema and concurrency risks are explicit. |
| 6 | Stack checks | Next.js, React, Postgres, auth, i18n, admin, and notification boundaries | Source-backed implementation slices are ready. |

If a blocker appears after Gate 2, the agent returns to Gate 2. A human-owned blocker remains blocking for every affected slice until the human decision is recorded.

## Gate 0: Intent

Before research or coding, the agent must write this in plain language:

| Field | Required answer for this feature |
| --- | --- |
| Actor | A person who wants to take an intro sailing class. |
| Starting point | Public class/event flow after sign-in or account creation. |
| Object | Annual waitlist entry and weekly class request. |
| Outcome | User joins the annual waitlist, requests classes they can attend, and sees whether a specific class request is accepted. |
| Primary product risk | Building first-click registration instead of annual waitlist ranking among class requesters. |

Exit criteria:

- The agent can explain why joining the annual waitlist is different from requesting a class.
- The agent can explain why a high waitlist number can still be accepted.
- The agent has not assumed SMS is in MVP.

## Gate 1: Evidence

The agent must maintain a claim ledger.

| Claim | Evidence | Confidence | Action |
| --- | --- | --- | --- |
| Users join an annual waitlist. | User request. | `confirmed_by_source` | Model annual season state. |
| The waitlist resets every April 1. | User request. | `confirmed_by_source` | Confirm timezone and historical-row behavior. |
| Users request weekly classes. | User request. | `confirmed_by_source` | Model class request separately from waitlist entry. |
| Acceptance is based on waitlist status. | User request. | `confirmed_by_source` | Define deterministic assignment rule. |
| High numbers can still be accepted. | User request. | `confirmed_by_source` | Rank only users who requested the class. |
| Existing implementation already exists. | Repo search found a plan, not proof of implementation. | `blocking_unknown` before coding | Inspect schema, actions, components, and tests. |
| Email is likely in scope. | User said email may notify users. | `inferred_low_risk` for planning only | Confirm templates/provider before coding. |
| SMS is in scope. | User said "maybe". | `blocking_unknown` for implementation | Decide MVP scope and consent model. |

Allowed confidence labels:

| Label | Meaning | May proceed? |
| --- | --- | --- |
| `confirmed_by_source` | Verified by user instruction, repo source, issue, official docs, or runtime source of truth. | Yes |
| `confirmed_by_test` | Verified by a passing check. | Yes |
| `inferred_low_risk` | Not directly proven, but reversible and consistent with local patterns. | Yes, with note |
| `unknown_nonblocking` | Unknown but outside the current slice. | Yes, if isolated |
| `blocking_unknown` | Unknown affects correctness, safety, data, product policy, or irreversible design. | No |

The agent must not use "probably", "seems", or "should be" as confidence labels.

## Stop, Defer, Or Assume

Not every unknown deserves a human question. The agent must classify the unknown before asking.

| Classification | Use when | Agent action |
| --- | --- | --- |
| Stop | A wrong answer changes product rule, schema, permissions, messaging, migration, or irreversible behavior. | Do not continue the slice. Ask one focused question or inspect the source. |
| Defer | The unknown matters later but is outside the current slice. | Mark out of scope and add a guardrail preventing related code. |
| Assume | Existing local pattern gives a reversible, low-risk default. | State the assumption and add the verification step. |

Examples for this feature:

| Unknown | Classification | Reason |
| --- | --- | --- |
| Whether SMS is in MVP. | Stop for SMS work, defer for waitlist join. | SMS adds consent, provider, legal, and external sends. |
| Whether to use `Request this class` or `Request a spot`. | Stop for UI implementation. | CTA sets user expectation and tests. |
| Whether acceptance consumes annual priority. | Stop for data and assignment. | Changes core fairness model. |
| Which component owns the public event CTA. | Assume only after repo inspection. | Existing component ownership can be discovered. |
| Whether to show waitlist number in admin. | Defer for public MVP, stop for admin slice. | Admin workflow can be a later slice. |

## Gate 2: Blockers

An unknown becomes a blocker when a wrong assumption could affect:

- User-facing behavior.
- Fairness or eligibility.
- Data model shape.
- Access control, privacy, or security.
- Notifications or external systems.
- Migrations or irreversible state.
- Acceptance criteria.
- Admin operations.
- User trust.

### Required Blocker Ledger For The Waitlist

| ID | Blocking unknown | Why it blocks | Blocked action / allowed deferment |
| --- | --- | --- | --- |
| B1 | Does acceptance consume annual priority? | Changes fairness, eligibility, and data model. | Stop. |
| B2 | What happens to prior-season entries on April 1? | Changes queries, retention, and audit. | Stop before schema. |
| B3 | What timezone defines April 1? | Boundary tests and reset jobs need one clock. | Stop before season helper. |
| B4 | Can users request multiple classes at once? | Changes uniqueness constraints and conflict rules. | Stop before request model. |
| B5 | Can users be accepted into multiple intro classes in a season? | Changes eligibility and assignment logic. | Stop before assignment logic. |
| B6 | Is assignment automatic, admin-run, or admin-reviewed? | Changes jobs, admin UI, tests, and notifications. | Stop before admin or assignment implementation. |
| B7 | What is the request window? | Changes closed/open states and late-request behavior. | Stop before UI copy and tests. |
| B8 | What happens after cancellation or no-show? | Changes promotion, penalties, and notifications. | Stop before promotion or penalty logic. |
| B9 | Are admin overrides allowed? | Requires audit and visible exception handling. | Stop before override implementation. |
| B10 | Is SMS in MVP? | Requires explicit consent, opt-out, quiet hours, provider setup. | Exclude SMS from MVP. |
| B11 | Can the UI show waitlist number? | Can confuse users if high numbers may still be accepted. | Stop before public number display. |
| B12 | Does existing registration status support `requested`, `accepted`, and `not accepted`? | Avoids new states if existing lifecycle works. | Inspect before schema. |

Blocker handling:

- If a blocker can be answered from the repo, the agent researches it.
- If a blocker requires product judgment, the agent asks the human one focused question.
- If a blocker is not in the current slice, the agent marks it out of scope and prevents related code.
- If a blocker is unresolved and central to the slice, the agent stops.

### Product Questions In Order

Ask these one at a time. Do not ask the whole list up front unless the human asks for a full questionnaire.

1. Does acceptance into one intro class consume or reduce a user's annual waitlist priority?
2. Should a user be able to request more than one weekly intro class at the same time?
3. Should a user be able to be accepted into more than one intro class in the same season?
4. Is assignment staff-reviewed from a sorted list, fully automatic, or automatic with staff override?
5. What request window should each weekly class use?
6. What happens when an accepted user cancels before class?
7. What happens after a no-show?
8. Should the public UI show the user's annual waitlist number?
9. Is email in MVP?
10. Is SMS in MVP, with separate consent work included?

The first question is the highest leverage. If acceptance consumes priority, the product is a matching/allocation system. If it does not, the product is an annual queue plus per-class request ranking.

### Proposed MVP Decisions Requiring Human Acceptance

These are proposed defaults. They are not authorization to code.

| Decision | Proposed MVP value | Why |
| --- | --- | --- |
| Annual priority after acceptance | Acceptance does not consume annual priority. | Keeps the feature as annual queue plus class requests, not a matching system. |
| Season timezone | America/New_York. | Matches the sailing venue's local operating day. |
| Assignment mode | Staff-reviewed sorted requester list. | Simpler and safer than automatic acceptance while product rules settle. |
| Cancellation before class | Cancelled accepted spot promotes the next eligible requester. | Matches user expectation that open spots can be filled. |
| No-show policy | Admin-only record in MVP; no automatic penalty. | Avoids hidden eligibility changes. |
| Admin override | No public reorder control in MVP. | Avoids fairness exceptions without audit design. |
| Public waitlist number | Show only if UX review confirms it does not confuse class acceptance. | High numbers can still be accepted. |
| SMS | Out of MVP. | Requires separate consent and provider scope. |

## Operating Roles

Use roles to keep the agent from blending product decisions, implementation, and review into one fluent but fragile answer.

| Role | Responsibility | Must not do |
| --- | --- | --- |
| Conductor | Owns gates, blocker ledger, slices, and final evidence. | Code before Gate 2. |
| Product rules researcher | Finds fairness, eligibility, lifecycle, and staff workflow decisions. | Decide product policy without labeling assumptions. |
| Repo mapper | Finds existing files, statuses, schema, tests, and patterns. | Invent implementation facts. |
| UX state researcher | Produces minimal state labels, actions, and accessibility blockers. | Add explainer paragraphs to solve unclear states. |
| Data integrity researcher | Defines invariants, constraints, transactions, and migration risks. | Add schema before blockers are resolved. |
| Notification researcher | Separates email and SMS scope, consent, opt-out, provider, and send logs. | Treat SMS as implied by "maybe". |
| Worker | Implements one ready slice. | Touch blocked areas. |
| Reviewer | Finds bugs, hidden assumptions, missing tests, and blocker violations. | Rewrite the feature without findings. |

Subagents should be used for independent questions. Do not spawn multiple agents to answer the same unresolved product decision.

## Gate 3: Product Rule

This is the proposed product model. It is not final until B1 through B8 are accepted.

### Recommended MVP

- Annual waitlist opens or resets every April 1.
- One active annual waitlist entry per user per season.
- Annual waitlist number is stable for that season.
- Joining the waitlist does not request a class.
- Each weekly intro class has explicit requests.
- A request starts as `Requested`.
- Staff sees requesters sorted by annual waitlist number.
- Staff accepts users for a class from that sorted list.
- Accepted users see `Accepted`.
- Users not accepted for that class remain on the annual waitlist.
- Email supports request/acceptance lifecycle after provider/template checks.
- SMS is out of MVP unless separate consent and compliance scope is approved.

### Assignment Algorithm

The agent must implement this only after B1 through B8 are resolved.

1. Load active requests for one class.
2. Exclude ineligible users.
3. Exclude cancelled requests.
4. Exclude users already accepted into a conflicting class if product disallows that.
5. Sort by annual waitlist sequence ascending.
6. Use request timestamp only as a tie-breaker.
7. Use stable user ID as the final deterministic tie-breaker.
8. Accept up to class capacity.
9. Leave the remaining requesters as not accepted or still requested, depending on the chosen lifecycle.
10. If an accepted user cancels before cutoff, promote the next eligible requester using the same order.

The annual waitlist sequence must not change when a user requests a class.

## Gate 4: UX State Model

The UI must use state labels and actions, not explanatory paragraphs.

| State | Badge | Primary action | Secondary data |
| --- | --- | --- | --- |
| Signed out | None | `Sign in` | None |
| Not on waitlist | None | `Join waitlist` | `Opens Apr 1` when closed |
| On waitlist | `Waitlist #42` | `Request this class` | Class date/time |
| Requested | `Requested` | `Cancel request` | Class date/time |
| Accepted | `Accepted` | `Cancel spot` | Class date/time |
| Not accepted | `Still waitlisted` | `Request next class` | None |
| Requests closed | `Closed` | None | Next request window |
| Ineligible | `Unavailable` | `View requirements` | Short reason |

UX rules:

- Badges show state. Buttons perform actions.
- Do not make badges clickable.
- Do not use `Submit`, `Register`, or `Update` when the action is `Join waitlist`, `Request this class`, `Cancel request`, or `Cancel spot`.
- Do not hide deadline, eligibility, or request outcome behind a disclosure.
- Do not rely on color alone.
- Dynamic status changes need accessible status semantics.
- Repeated row actions need unique accessible names, for example `Cancel Tuesday 6 PM request`.

UX blockers:

- If users cannot understand that annual waitlist position and class request are separate, the UI is not ready.
- If "not accepted" looks like losing annual waitlist status, the UI is not ready.
- If disabled controls do not show a reason, the UI is not ready.
- If no explainer text causes accessibility or state ambiguity, the design must use concise visible status text.

### Static HTML Design Approval

UI-affecting slices need static HTML designs before React implementation. This is not production code. It is an approval artifact for user states, labels, density, and mobile/desktop behavior.

The HTML design must show:

- Signed-out state.
- On waitlist, before request window.
- Request window open.
- Requested.
- Accepted.
- Not accepted but still waitlisted.
- Requests closed.
- Ineligible or unavailable.
- Admin sorted requester list if the slice includes admin acceptance.

Approval criteria:

- The annual waitlist and weekly class request are visually distinct.
- The request window is obvious without explanatory paragraphs.
- The selection window is represented without implying automatic acceptance unless approved.
- A high waitlist number does not look hopeless.
- Badges show state and buttons perform actions.
- Mobile and desktop states fit without text overlap.
- Accessible names or notes are included for repeated actions and dynamic statuses.

Do not implement the React UI until the static HTML state design is approved or the UI slice is explicitly deferred.

### Additional Approval Gates Evaluated

Scoring rubric:

- Product/user-risk reduction: 30 points.
- Catches mistakes before code: 20 points.
- Fit for this waitlist feature and stack: 20 points.
- Evidence quality: 20 points.
- Low overhead: 10 points.

Decision: use the top 10 gates for this feature. Static HTML design approval stays in Gate 4; the remaining high-value gates should be assigned to the relevant slice.

| Rank | Candidate gate/artifact | Score | Decision |
| ---: | --- | ---: | --- |
| 1 | User-path timeline map covering April 1 reset, 1-week request window, and 2-4 day selection window | 97 | Use |
| 2 | State machine table for annual waitlist entry and weekly class request | 96 | Use |
| 3 | Static HTML state design approval | 94 | Use |
| 4 | Product decision record for fairness, assignment, cancellation, no-show, and SMS scope | 94 | Use |
| 5 | Data invariant and constraint map before schema | 93 | Use |
| 6 | Test matrix approval before coding | 92 | Use |
| 7 | Source evidence map with paths, functions, findings, and remaining unknowns | 91 | Use |
| 8 | Admin operations flow for sorted requester review and acceptance | 90 | Use |
| 9 | Accessibility state contract for badges, status messages, and repeated actions | 89 | Use |
| 10 | Notification consent matrix separating email and SMS | 88 | Use |
| 11 | Postgres concurrency and idempotency plan | 88 | Use for data slices |
| 12 | Threat model / data-flow diagram for auth, PII, admin, and notifications | 87 | Use for auth/notification slices |
| 13 | Server Action/API contract before implementation | 86 | Use for mutation slices |
| 14 | Migration dry-run and rollback plan | 85 | Use for schema slices |
| 15 | Storybook or component-state gallery | 84 | Optional if local stack supports it |
| 16 | Playwright screenshot approval for responsive states | 84 | Optional after React implementation |
| 17 | E2E journey storyboard | 83 | Use before E2E slice |
| 18 | Notification template preview approval | 82 | Use for email slice |
| 19 | Permission matrix for user, admin, worker, and unauthenticated actor | 82 | Use for auth/admin slices |
| 20 | Audit log plan for acceptance, cancellation, override, and notification sends | 81 | Use for admin slices |
| 21 | Error taxonomy and blocker reporting template | 80 | Use |
| 22 | Seed data and fixture plan | 79 | Use for tests |
| 23 | Microcopy approval sheet | 78 | Use only if labels are contentious |
| 24 | Data retention/deletion policy | 78 | Use if historical waitlist rows are retained |
| 25 | Idempotency-key matrix for requests, accepts, promotions, and sends | 77 | Use for mutation/notification slices |
| 26 | Observability dashboard sketch | 74 | Defer unless ops needs it |
| 27 | Product analytics event plan | 72 | Defer |
| 28 | Load/capacity model | 71 | Defer unless demand is extreme |
| 29 | PR merge checklist | 70 | Use existing repo process instead |
| 30 | Visual regression baselines | 69 | Defer until UI is stable |
| 31 | Browser QA script | 68 | Use as lightweight fallback |
| 32 | Story map backlog | 67 | Useful, not a gate |
| 33 | Sequence diagram | 66 | Optional if state machine is unclear |
| 34 | Figma wireframe | 65 | Optional; static HTML is faster here |
| 35 | High-level architecture diagram | 63 | Too broad for this slice |
| 36 | Performance budget | 62 | Defer unless UI or query latency becomes risky |
| 37 | Design-token audit | 60 | Defer; use existing styles |
| 38 | Dependency/provenance assessment | 58 | Use only if adding packages |
| 39 | User interview script | 56 | Useful product work, too slow as coding gate |
| 40 | Full service blueprint | 54 | Too heavy for MVP |

Recommended 10 gates for this waitlist:

1. User-path timeline map.
2. State machine table.
3. Static HTML state design.
4. Product decision record.
5. Data invariant and constraint map.
6. Test matrix approval.
7. Source evidence map.
8. Admin operations flow.
9. Accessibility state contract.
10. Notification consent matrix.

Add Postgres concurrency/idempotency and threat modeling when the slice touches data allocation, auth, PII, admin permissions, or external sends.

## Gate 5: Data Model And Integrity

The agent must not design schema until B1 through B8 are resolved.

Minimum invariants:

| Invariant | Enforcement |
| --- | --- |
| One active annual waitlist entry per user per season. | Unique constraint or active-key design. |
| Annual sequence is unique per season. | Unique constraint. |
| Annual sequence is stable. | Domain tests and no update path except audited correction. |
| Class request is separate from annual waitlist entry. | Separate table or existing registration metadata. |
| One active request per user per class. | Unique constraint or transaction guard. |
| Automatic assignment cannot exceed capacity. | Transaction guard and tests. |
| Admin override is auditable. | Existing audit mechanism or explicit audit record. |
| Cancellation preserves history. | Status transition, not deletion. |
| Prior seasons do not count after reset. | Season helper and query tests. |
| Notification sends are idempotent. | Dedupe key per user, class, channel, template. |

Postgres rules:

- Do not allocate annual sequence with an unguarded `max(sequence) + 1`.
- If using `max(sequence) + 1`, protect it with a transaction-level advisory lock or another safe sequence strategy.
- Keep unique constraints as the final backstop.
- Test concurrent joins and duplicate class requests.
- Migration claims require actual migration output, not schema prose.

## Gate 6: Next.js, React, And Postgres Stack Checks

Before coding, the agent must answer these from source:

| Area | Required source answer |
| --- | --- |
| App Router | Which route owns public class/event detail and class request? |
| Server boundary | Which actions belong in Server Actions vs route handlers? |
| React UI | Which components own CTA, form, calendar row, and status display? |
| i18n | Which namespace owns the visible labels? |
| Auth | How does signed-out flow preserve return to the class request? |
| Registration | Which existing statuses map to requested, accepted, cancelled, and not accepted? |
| Admin | Which admin surface approves class/event registrations today? |
| Email | Which template, worker, provider, and suppression pattern already exists? |
| SMS | Whether phone verification, consent, provider, opt-out, and quiet-hour logic exist. |
| Tests | Which unit, integration, e2e, and browser checks prove the feature? |

Each answer must use this evidence format:

| Field | Required content |
| --- | --- |
| Source | File path, function/component name, line reference, or official docs URL. |
| Finding | What the source proves. |
| Decision impact | How the finding changes the slice. |
| Remaining unknown | What still blocks or must be verified. |

Default stack decisions:

- Prefer Server Components and server-side data reads for initial state.
- Use Client Components only for interactive controls that require client state.
- Use Server Actions for authenticated form submissions when consistent with the app.
- Keep user-visible strings in existing i18n patterns.
- Keep Postgres constraints and transactions close to domain invariants.
- Do not add dependencies for allocation, notifications, or state machines without explicit approval.

## Notification Gate

Email and SMS are separate scopes.

### Email

Potential email messages:

- Annual waitlist opened.
- Class requests opened.
- Request saved.
- Request accepted.
- Not accepted this week.

Email blockers:

- Transactional vs promotional classification.
- Sender identity.
- Template ownership.
- Unsubscribe/suppression behavior for non-transactional messages.
- Bounce and complaint handling.
- Idempotent send log.

### SMS

SMS is blocked unless approved as a separate scope.

SMS blockers:

- Explicit SMS opt-in for this notification purpose.
- Consent evidence storage.
- Phone verification.
- E.164 phone storage.
- STOP/START/HELP handling.
- Quiet-hour scheduling.
- Sender registration such as A2P/10DLC when required.
- Provider delivery webhooks.
- Privacy policy and terms coverage.

Agent rule:

> Do not implement SMS sending from a "maybe".

## Implementation Slices

Use small slices. Each slice must list resolved blockers and forbidden areas.

| Slice | Allowed work | Still blocked |
| --- | --- | --- |
| 1. Discovery packet | Repo map, claim ledger, product blockers, source evidence. | All code. |
| 2. Domain model plan | Proposed tables/fields, invariants, migration risks. | Actual migration until product blockers resolved. |
| 3. Waitlist join | Annual entry, April 1 season, position query, tests. | Class requests, notifications. |
| 4. Class request | Request one class, status labels, duplicate guard, tests. | Auto assignment, SMS. |
| 5. Admin acceptance | Sorted request list, accept/cancel, capacity guard. | Overrides unless audited. |
| 6. Email | Templates and worker sends after classification. | SMS and marketing copy. |
| 7. E2E | Public and admin flows. | Production sends. |

## First Prompt For This Waitlist Feature

Use this prompt before any implementation:

```text
Create a feature-start packet for a sailing.mit.edu intro-class waitlist.

User intent:
- Users sign up and join an annual waitlist.
- The waitlist resets every April 1.
- Users request specific weekly intro classes.
- Acceptance is based on annual waitlist order among users who requested that class.
- A high waitlist number can still be accepted when earlier users do not request that class.
- The UI must be obvious at a glance and avoid explainer paragraphs.
- Email and SMS may notify users, but SMS is not in scope unless explicitly approved.

Rules:
- Do not code.
- Inspect the repo before claiming existing implementation.
- Build Gate 0 through Gate 2 first: intent, claim ledger, blocker ledger.
- Use only these confidence labels: confirmed_by_source, confirmed_by_test, inferred_low_risk, unknown_nonblocking, blocking_unknown.
- Stop on blockers that affect product rule, schema, user state, auth/privacy, notification sends, or migrations.
- Reconcile any older waitlist plan with the latest requirement above.

Output:
- User path.
- Confirmed evidence.
- Blocking unknowns with owner and decisive check.
- Proposed MVP rule.
- Implementation slices.
- Verification plan.
- Subagent prompts.
```

## Full Prompt Pack

Use these prompts in order. The sequence is designed so the first agent does not jump from product intent directly to code.

### 1. Mind Map Prompt

Use when the feature is still fuzzy.

```text
Create a mind map for the sailing.mit.edu intro-class annual waitlist.

Use `AI_UNKNOWN_BLOCKERS_WAITLIST_PLAYBOOK.md` as the operating model.

Confirmed intent:
- Users sign up and join an annual waitlist.
- The waitlist resets every April 1.
- Users can request a specific intro class starting 1 week before the first class session.
- Users are selected 2-4 days before the first class session.
- Before the 1-week request window, users can see the class but cannot request it.
- Acceptance is based on annual waitlist order among users who requested that class.
- A high waitlist number can still be accepted when earlier users do not request that class.
- The UI must be obvious at a glance and avoid explainer paragraphs.
- Email may notify users when class requests open and when requests are accepted.
- SMS is not in scope unless explicitly approved later.

Do not code.

Output a structured mind map with:
- User states.
- Staff/admin states.
- Data objects.
- Time windows.
- Notifications.
- Edge cases.
- Blockers.
- Tests.

Mark each branch as `confirmed`, `proposed`, or `blocking_unknown`.
End with the 3 most important product questions, ordered by implementation impact.
```

### 2. Plan Mode Prompt

Use after the mind map is useful.

```text
Create a feature-start packet and implementation plan for the sailing.mit.edu intro-class annual waitlist.

Use `AI_UNKNOWN_BLOCKERS_WAITLIST_PLAYBOOK.md`.

Do not code.

Build Gates 0 through 2 first:
- Gate 0: intent.
- Gate 1: claim ledger.
- Gate 2: blocker ledger.

Then complete Gates 3 through 6 only as proposed slice readiness:
- Gate 3: product rule.
- Gate 4: UX state model.
- Gate 5: data integrity.
- Gate 6: Next.js, React, Postgres, auth, i18n, admin, email, and test source checks.

Use only these confidence labels:
- `confirmed_by_source`
- `confirmed_by_test`
- `inferred_low_risk`
- `unknown_nonblocking`
- `blocking_unknown`

Stop on blockers that affect product rule, schema, user state, auth/privacy, notification sends, selection timing, or migrations.

Output:
- What we are trying to accomplish.
- Confirmed repo/user evidence.
- Blocking unknowns with owner and decisive check.
- One highest-leverage product question to ask next.
- Proposed MVP rule, clearly marked as proposed.
- Implementation slices with blocked areas.
- Verification matrix.
- Subagent prompts.
```

### 3. Refinement Prompt

Use after reviewing the first plan.

```text
Refine the feature-start packet for the intro-class annual waitlist.

Focus only on making the plan ready for experienced engineers and AI workers.

Do not code.

Tighten:
- Blocker ledger.
- Product rule.
- Request window: requests open 1 week before the first class session.
- Selection window: users are picked 2-4 days before the first class session.
- Difference between annual waitlist entry and weekly class request.
- Minimal UX state labels.
- Data invariants.
- Verification commands.
- Implementation slices.

Remove:
- Vague language.
- Unowned decisions.
- Assumptions hidden as defaults.
- Any SMS work unless explicitly approved.

Output the revised packet plus a short list of remaining blockers.
```

### 4. Product Decision Prompt

Use when the agent needs a human answer.

```text
Ask only the next highest-leverage product question for the intro-class annual waitlist.

Context:
- Users join an annual waitlist that resets April 1.
- Users request specific classes starting 1 week before the first class session.
- Users are selected 2-4 days before the first class session.
- Acceptance is based on annual waitlist order among requesters.

Rules:
- Ask one question only.
- Explain why it blocks implementation in one sentence.
- Provide 2-3 concrete options with tradeoffs.
- Do not ask implementation questions until product-policy blockers are resolved.
```

### 5. Repo Mapping Prompt

Use before any coding slice.

```text
Map the existing repo for the intro-class annual waitlist feature.

Do not code.

Find source evidence for:
- Public class/event pages.
- Event registration actions and statuses.
- Auth/sign-in return path.
- Admin registration approval surfaces.
- Existing event/class seed data.
- Email templates/workers/provider patterns.
- i18n namespaces.
- Schema and generated-client workflow.
- Relevant unit, integration, and e2e tests.

For every finding include:
- Source path or official docs URL.
- Function/component/model name.
- What it proves.
- Decision impact.
- Remaining unknown.

End with `source_blocker`, `requirement_blocker`, or `verification_blocker` items.
```

### 6. UX Prompt

Use before UI coding.

```text
Design the minimal UX state model for the intro-class annual waitlist.

Do not code.

Requirements:
- No explainer paragraphs.
- Badges show state.
- Buttons perform actions.
- Users can see classes before the request window opens.
- Requests open 1 week before the first class session.
- Users are selected 2-4 days before the first class session.
- A high annual waitlist number can still be accepted if earlier users did not request that class.

Output:
- State table with badge, primary action, secondary data, and accessible name.
- Empty/closed/requested/accepted/not accepted states.
- Admin-facing state labels.
- Accessibility blockers.
- Component tests to prove the states.
```

### 7. Static HTML Approval Prompt

Use before React implementation for UI-affecting slices.

```text
Create static HTML designs for the intro-class annual waitlist UI.

Do not write production React code.
Do not change app files unless explicitly asked.

Use the approved UX state model and show these states:
- Signed out.
- On waitlist, before request window.
- Request window open.
- Requested.
- Accepted.
- Not accepted but still waitlisted.
- Requests closed.
- Ineligible or unavailable.
- Admin sorted requester list if admin acceptance is in scope.

Design constraints:
- No explainer paragraphs.
- Badges show state.
- Buttons perform actions.
- Annual waitlist entry and weekly class request must be visually distinct.
- Requests open 1 week before the first class session.
- Users are selected 2-4 days before the first class session.
- A high waitlist number can still be accepted if earlier users did not request that class.
- Show desktop and mobile layouts.
- Include accessible names or notes for repeated actions and dynamic status changes.

Output:
- A single static HTML file or HTML snippet.
- A list of states covered.
- Approval questions for any ambiguous state.
- What must be approved before React implementation.
```

### 8. Coding Worker Prompt

Use only after the slice is ready.

```text
Implement only this slice: [slice name].

Use the approved feature packet and `AI_UNKNOWN_BLOCKERS_WAITLIST_PLAYBOOK.md`.

Resolved blockers:
- [IDs]

Still blocked / forbidden:
- [IDs and areas]

Rules:
- Keep the diff minimal.
- Match existing Next.js, React, Postgres, i18n, and test patterns.
- Do not implement SMS, production sends, migrations, auth changes, automatic assignment, or admin overrides unless this slice explicitly includes them.
- Preserve the difference between annual waitlist entry and weekly class request.
- Enforce request window: 1 week before the first class session.
- Enforce selection window only if the slice explicitly includes selection behavior.
- If a new blocker appears, stop and report it.

Verification:
- Run the targeted tests for this slice.
- Run `npm run check:types`.
- Run `npm run lint` if UI/server code changed.
- Run `npm run check:i18n` if user-visible strings changed.
- Run `npm run build-local` if schema, Server Actions, auth, or Next.js boundaries changed.

Report exact commands and outcomes.
```

### 9. Test Design Prompt

Use before or during implementation.

```text
Design the test plan for the intro-class annual waitlist.

Do not code unless explicitly asked.

Cover:
- Annual waitlist join and April 1 reset.
- Request window opens 1 week before the first class session.
- Users cannot request before the window opens.
- Users are selected 2-4 days before the first class session.
- Annual waitlist entry is separate from weekly class request.
- High-number user accepted when lower-number users do not request the class.
- Duplicate class request behavior.
- Cancellation and promotion behavior if in scope.
- Minimal UI states.
- Admin sorted requester list if in scope.
- Email behavior if in scope.
- SMS remains blocked unless consent scope is approved.

Output:
- Unit tests.
- Integration tests.
- Component tests.
- E2E tests.
- Required commands.
- Remaining `oracle_blocker` or `verification_blocker` items.
```

### 10. Error Reporting Prompt

Use when an agent hits an error.

```text
Report the error using the unknown-blocker format.

Do not guess a fix yet.

Include:
- Command or action attempted.
- Exact error output or failing assertion.
- Files or source touched.
- Most likely 1-3 causes.
- Which cause you will validate first.
- Whether this is a `source_blocker`, `requirement_blocker`, `verification_blocker`, `state_blocker`, or implementation bug.
- Next smallest diagnostic command.

Do not continue coding until the error is classified.
```

### 11. Debugging Prompt

Use after error classification.

```text
Debug the classified issue systematically.

Rules:
- Start from the most likely cause.
- Validate with the smallest command, test, source read, or reproduction.
- Do not apply a fix until the cause is proven or strongly isolated.
- Keep the fix scoped to the failing behavior.
- Add or update the smallest test that would have caught the issue.
- If the failure exposes a product or schema unknown, stop and return it as a blocker.

Output:
- Hypothesis.
- Validation evidence.
- Root cause.
- Fix plan.
- Test plan.
- Commands to run.
```

### 12. Review Prompt

Use with a fresh agent after code changes.

```text
Review the current feature packet or diff for the intro-class annual waitlist.

Findings first.

Prioritize:
1. Product rule mistakes.
2. Blockers hidden as assumptions.
3. Annual waitlist and weekly request state being collapsed.
4. Request window or selection window bugs.
5. Data integrity and concurrency bugs.
6. Auth, privacy, notification, or external-system risks.
7. UX states that rely on explainer paragraphs.
8. Missing tests.

For each finding include:
- Severity.
- Blocker status.
- Evidence.
- User impact.
- Smallest fix.
```

### 13. Completion Report Prompt

Use before handing work back.

```text
Prepare the completion report for this slice.

Include:
- Slice implemented.
- Resolved blocker IDs.
- Files changed.
- User-visible behavior changed.
- Data/schema behavior changed.
- Notifications touched or explicitly not touched.
- Verification commands run and exact outcomes.
- Remaining blockers.
- Remaining risks.
- Mistakes found and the durable rule/test added.

Do not claim the feature is complete unless all slices are implemented and verified.
```

## Example Conductor Output For This Feature

This is the shape a good agent should produce before coding.

```markdown
# Feature-Start Packet: Intro Class Annual Waitlist

## User path

- Actor: A person who wants to take an intro sailing class.
- Starting point: Public intro class/event page after sign-in or account creation.
- Object: Annual waitlist entry and weekly class request.
- Outcome: User joins the annual waitlist, requests specific classes, and sees whether each request is accepted.

## Confirmed claims

| Claim | Source | Confidence |
| --- | --- | --- |
| Waitlist resets every April 1. | User instruction. | confirmed_by_source |
| Users request weekly classes after joining. | User instruction. | confirmed_by_source |
| Acceptance is based on waitlist status among requesters. | User instruction. | confirmed_by_source |
| High numbers can still be accepted. | User instruction. | confirmed_by_source |

## Blocking unknowns

| ID | Unknown | Why it blocks | Next step |
| --- | --- | --- | --- |
| B1 | Does acceptance consume annual priority? | Changes fairness and schema. | Ask product. |
| B3 | What timezone defines April 1? | Changes season helper and tests. | Ask product or adopt app timezone if established. |
| B6 | Is assignment staff-reviewed or automatic? | Changes admin UI and jobs. | Ask product/ops. |
| B10 | Is SMS in MVP? | Adds consent, provider, quiet hours, and external sends. | Ask product/legal. |

## Proposed MVP assumption

If product accepts the defaults:

- Acceptance does not consume annual priority.
- America/New_York defines April 1.
- Staff reviews a sorted requester list and accepts users.
- SMS is out of MVP.

## Slices

1. Discovery and source map.
2. Annual waitlist entry and season helper.
3. Class request state.
4. Admin sorted acceptance.
5. Email notifications.
6. E2E verification.

## Do not implement yet

- SMS.
- Automatic assignment jobs.
- Admin reorder/priority override.
- Migration until schema blockers are resolved.
```

## Required Tests

The agent must propose these before coding and implement the relevant subset per slice:

- User joins annual waitlist and receives one stable annual number.
- April 1 reset excludes prior-season active positions from the new season.
- Joining the waitlist does not request any class.
- User requests one weekly class and sees `Requested`.
- Duplicate request returns the existing request or fails idempotently.
- Assignment sorts requesters by annual waitlist number.
- High-number user is accepted when lower-number users did not request that class.
- Late requester does not displace accepted users after the request window closes.
- Accepted user cancels and the next eligible requester is promoted.
- Capacity cannot be exceeded by automatic assignment.
- User not accepted this week remains on the annual waitlist.
- Admin override, if allowed, is audited.
- SMS is not sent without explicit SMS consent.
- Dynamic status changes are announced accessibly.

## Verification Matrix

Agents must report exact commands and outcomes. Planned tests are not evidence.

| Slice type | Minimum verification |
| --- | --- |
| Plan-only or discovery packet | No npm command required; include source paths and unresolved blockers. |
| Pure helper/domain logic | Targeted `npm run test -- <test files>` and `npm run check:types`. |
| React UI or i18n changes | Targeted component tests, `npm run check:i18n`, `npm run lint`, and `npm run check:types`. |
| Server Action, auth, or registration lifecycle changes | Targeted action/integration tests, `npm run lint`, `npm run check:types`, and `npm run build-local`. |
| Schema or migration changes | Generated schema verification, targeted tests, `npm run check:types`, and `npm run build-local`. |
| Notification worker/template changes | Targeted worker/template tests, `npm run check:i18n`, `npm run lint`, and `npm run check:types`. |
| E2E slice | `npm run test:e2e -- <waitlist e2e file>` after targeted lower-level tests pass. |
| Final feature hardening | `npm run lint`, `npm run check:types`, `npm run check:i18n`, `npm run test`, and the focused waitlist e2e command. |

If a command cannot run, the agent must report it as a `verification_blocker` unless the slice is explicitly plan-only.

## Conductor Prompt

Use this as the first prompt for a new AI agent.

```text
You are the feature conductor for an experienced software engineering team.

Task:
Create a feature-start packet for the intro-class annual waitlist.

Do not code.

Required process:
1. Write the user path: actor, starting point, object, outcome.
2. Inspect the repository and current official docs before making stack claims.
3. Build a claim ledger. Use only these labels: confirmed_by_source, confirmed_by_test, inferred_low_risk, unknown_nonblocking, blocking_unknown.
4. Build a blocker ledger. Treat product policy, fairness, data model, auth, privacy, notifications, migrations, and external systems as blocker-sensitive.
5. Reconcile any prior plan with the latest requirement: annual reset every April 1, weekly class requests, acceptance among requesters, minimal UI text, SMS only if explicitly scoped.
6. Stop on blockers that affect the current slice.

Output:
- What we are trying to accomplish.
- Confirmed evidence.
- Blocking unknowns.
- Proposed MVP product rule.
- Implementation slices.
- Verification plan.
- Subagent prompts.
```

## Subagent Prompts

Run independent subagents only when their questions do not block the conductor's immediate next step.

### Product Rules

```text
Identify product decisions that affect fairness, eligibility, request state, acceptance, cancellation, no-shows, and admin operations. Return a proposed rule model and blocker ledger. Do not code.
```

### Repo Mapper

```text
Map current source evidence for class/event registration, auth return paths, admin approval, email workers, i18n, tests, schema, and migrations. Return file paths and confirmed/unknown labels. Do not code.
```

### UX State

```text
Design the minimal visible state model. Use badges for state and buttons for actions. No explainer paragraphs. Identify accessibility blockers and required tests. Do not code.
```

### Data Integrity

```text
Define data invariants, uniqueness constraints, transactions, concurrency risks, idempotency keys, and migration blockers for annual waitlist plus weekly class requests. Do not code.
```

### Notifications

```text
Classify each notification as transactional, informational, or promotional. Identify email and SMS consent, opt-out, quiet-hour, provider, webhook, logging, and privacy blockers. Do not code.
```

### Security Review

```text
Review the feature packet for auth, authorization, PII, notification consent, untrusted context, prompt injection, excessive agency, and external mutation risks. Findings first, with severity and blocker status.
```

## Worker Prompt

Use only after the conductor marks a slice ready.

```text
Implement only this slice: [slice].

Context:
- Feature packet: [path]
- Resolved blockers: [IDs]
- Still-blocked areas: [IDs]

Rules:
- Keep the diff minimal.
- Match existing Next.js, React, Postgres, i18n, and test patterns.
- Do not add dependencies without explicit approval.
- Do not implement SMS, production sends, migrations, auth changes, or admin overrides unless this slice explicitly includes them.
- If a new blocker appears, stop and report it.
- Report exact verification commands and results.
```

## Review Prompt

Use a fresh reviewer.

```text
Review the feature packet or diff.

Findings first. Prioritize:
1. Product rule mistakes.
2. Blockers hidden as assumptions.
3. Data integrity and concurrency bugs.
4. Auth, privacy, notification, or external-system risks.
5. UX states that confuse users or rely on paragraphs.
6. Missing tests.

For each finding include severity, blocker status, evidence, user impact, and smallest fix.
```

## Review Checklist

Use this after every plan or implementation slice.

| Check | Pass condition |
| --- | --- |
| User path | Actor, starting point, object, and outcome are explicit. |
| Annual vs class state | Waitlist entry and class request are not collapsed. |
| April 1 reset | Timezone and old-season behavior are explicit or blocked. |
| Acceptance rule | Ranking among class requesters is explicit. |
| High-number acceptance | Test case exists or is planned. |
| UI simplicity | State labels and actions carry the flow without paragraphs. |
| Accessibility | Dynamic status, labels, and repeated row actions are covered. |
| Data integrity | Unique constraints, transactions, and idempotency are covered. |
| Auth | Signed-out return path is explicit. |
| Notifications | Email and SMS are scoped separately. |
| SMS | No SMS implementation without explicit consent and provider blockers resolved. |
| Verification | Commands or tests are named for the slice. |
| Scope | Blocked areas are not touched. |

## Mistake Learning Loop

AI agents do not learn from "be careful". They learn when mistakes become specific blocker rules, tests, or instruction updates.

For every user-caught mistake:

| Field | Required content |
| --- | --- |
| Symptom | What the agent got wrong. |
| Root cause | Missing source check, unclear requirement, bad assumption, weak prompt, missing test, or tool failure. |
| Missed signal | The evidence the agent ignored. |
| New blocker rule | The smallest rule that would have stopped the mistake. |
| Regression check | Test, eval, review item, or source query. |
| Instruction update | Smallest durable update to AGENTS, skill, runbook, or feature packet. |

Example:

| Field | Content |
| --- | --- |
| Symptom | Agent built normal first-click registration. |
| Root cause | It collapsed annual waitlist entry and weekly class request into one concept. |
| Missed signal | User said high waitlist numbers can still be accepted based on who registers. |
| New blocker rule | Acceptance algorithm blocks implementation until annual rank among class requesters is explicit. |
| Regression check | Test high-number user accepted when lower-number users do not request that class. |
| Instruction update | Add B1, B4, and B6 to the blocker ledger. |

## Research Sources

AI uncertainty and hallucination:

- Anthropic, "Language Models (Mostly) Know What They Know": https://www.anthropic.com/research/language-models-mostly-know-what-they-know
- SelfCheckGPT paper: https://arxiv.org/abs/2303.08896
- Nature, semantic entropy hallucination detection: https://www.nature.com/articles/s41586-024-07421-0
- Nature, larger and more instructable models becoming less reliable: https://www.nature.com/articles/s41586-024-07930-y

Agent workflow, evals, and guardrails:

- OpenAI agent evals: https://developers.openai.com/api/docs/guides/agent-evals
- OpenAI trace grading: https://developers.openai.com/api/docs/guides/trace-grading
- OpenAI eval best practices: https://developers.openai.com/api/docs/guides/evaluation-best-practices
- OpenAI agent safety guidance: https://developers.openai.com/api/docs/guides/agent-builder-safety
- OpenAI Agents SDK guardrails: https://openai.github.io/openai-agents-js/guides/guardrails/
- OpenAI Codex AGENTS.md guidance: https://developers.openai.com/codex/guides/agents-md
- OpenAI Codex approvals and security: https://developers.openai.com/codex/agent-approvals-security
- OpenAI Codex review workflow: https://developers.openai.com/codex/app/review
- Anthropic, "Building Effective Agents": https://www.anthropic.com/engineering/building-effective-agents
- GitHub Copilot cloud agent best practices: https://docs.github.com/en/copilot/tutorials/cloud-agent/get-the-best-results

Stack sources:

- Next.js AI coding agents guide: https://nextjs.org/docs/app/guides/ai-agents
- PostgreSQL advisory lock functions: https://www.postgresql.org/docs/current/functions-admin.html
- PostgreSQL unique indexes: https://www.postgresql.org/docs/17/indexes-unique.html

Security, privacy, and safety:

- NIST AI Risk Management Framework: https://www.nist.gov/itl/ai-risk-management-framework
- NIST Generative AI Profile: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf
- OWASP Top 10 for LLM Applications: https://owasp.org/www-project-top-10-for-large-language-model-applications/
- OWASP MCP Top 10: https://owasp.org/www-project-mcp-top-10/

UX and accessibility:

- GOV.UK error-message guidance: https://design-system.service.gov.uk/components/error-message/
- W3C WAI ARIA status messages: https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22
- WCAG status messages understanding: https://w3c.github.io/wcag/understanding/status-messages
- Testing Library guiding principles: https://testing-library.com/docs/guiding-principles
- Storybook visual tests: https://storybook.js.org/docs/8/writing-tests/visual-testing
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots

Notifications:

- Twilio Compliance Toolkit: https://www.twilio.com/docs/messaging/features/compliance-toolkit
- Twilio consent and opt-in policy: https://www.twilio.com/docs/verify/consent-opt-in
- Twilio Consent Management API: https://www.twilio.com/docs/messaging/features/consent-api
- FTC CAN-SPAM compliance guide: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business

Security and data integrity:

- OWASP Threat Modeling Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- Next.js data security guide: https://nextjs.org/docs/app/guides/data-security
- PostgreSQL transaction isolation: https://www.postgresql.org/docs/17/transaction-iso.html
