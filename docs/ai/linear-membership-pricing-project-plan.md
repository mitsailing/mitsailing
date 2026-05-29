# Linear Project Seed: Membership Pricing V1

Use this as the initial Linear project plan after creating the Linear trial or
workspace. Until Linear is connected, this file is the seed document agents use
to keep pricing, membership, onboarding, and persona work aligned.

Once Linear exists, copy this into a Linear project document and create the
issues/milestones below. After that, Linear becomes the PM source of truth and
this file becomes a bootstrap reference.

## Linear Setup

Project:
Membership pricing V1

GitHub repo:
mitsailing/mitsailing

GitHub PR to run first:
[#142 Clarify sailing card pricing and onboarding](https://github.com/mitsailing/mitsailing/pull/142)

GitHub docs PR dependency:
[#143 Add PR agent orchestration runbook](https://github.com/mitsailing/mitsailing/pull/143)

Project goal:
Users can understand membership pricing, complete the right onboarding path,
know what payment is available now, and know what is manual or deferred.
Staff can see the right follow-up work without relying on chat memory.

## Milestones

| Milestone | Goal | Current GitHub mapping |
| --- | --- | --- |
| Pricing clarity | Pricing pages and onboarding copy explain who pays, what is included, and what happens next. | PR #142, issue #125 |
| Onboarding payments | Sailing-card and racing membership payment paths are explicit, implemented, or clearly deferred. | Issues #114, #126-132 |
| Learn-to-Sail waitlist | The two beginner intro classes have a waitlist path, admin handling, and email support. | Issues #135-137 |
| Profile and affiliation editing | Users can correct MIT affiliation and identity/profile state after onboarding. | Issues #111, #138 |
| Staff completion | Staff/admin can complete card issuance only after required prerequisites. | Issues #86, #115 |
| Operational parity | Warehouse sync, emails, Mailman/list side effects, and scheduled jobs are preserved or tracked. | Issues #84, #90, legacy audit |

## Initial Issues

Create these in Linear, or link existing GitHub issues if syncing GitHub and
Linear.

| Issue | Type | Status | GitHub mapping | Acceptance evidence |
| --- | --- | --- | --- | --- |
| Clarify sailing card pricing and onboarding | Current PR | In progress | PR #142, issue #125 | Persona can read pricing and choose correct next step. |
| Add sailing-card membership payment during onboarding | Feature | Planned | #114 | User can pay when the chosen onboarding path requires payment, or sees a correct deferred/manual state. |
| Add racing membership payment during onboarding | Feature | Planned | #129-132, #87 | Non-MIT racer can move from pricing to onboarding to payment, or sees a clearly linked deferred path. |
| Add admin pricing writes and Stripe Price sync | Foundation | Planned | #127 | Admin/source of truth can update pricing without stale Stripe mismatch. |
| Harden Stripe webhook dispatch for multi-domain payments | Foundation | Planned | #128 | Payment events are routed by domain without cross-domain side effects. |
| Add racing membership renewal reminders and price updates | Feature | Planned | #132 | Returning racer understands renewal timing and price. |
| Add Learn-to-Sail waitlist domain foundation | Feature | Planned | #135 | Waitlist data model and eligibility are clear. |
| Add public Learn-to-Sail waitlist class flow | Feature | Planned | #136 | Beginner can join a waitlist for the two intro classes. |
| Add admin and email support for Learn-to-Sail waitlist | Feature | Planned | #137 | Staff can manage waitlist and users receive correct email. |
| Add profile sailing affiliation and MIT identity editor | Feature | Planned | #111, #138 | Returning user can correct MIT affiliation/profile state after onboarding. |
| Add sailing-card onboarding confirmation email | Feature | Planned | #115 | User gets clear confirmation and next step after onboarding. |
| Preserve staff-gated card assignment prerequisites | Policy/test | Planned | #86 | Staff cannot assign a sailing card until intro for experienced sailors or one beginner class is complete. |
| Document pavilion rental manual payment copy | Clarity | Planned | New or existing issue | Pavilion rental requester is told payment is manual and how staff will follow up. |

## Non-Goals

- Do not build online pavilion rental payment. Pavilion rental payment is
  manual. The product requirement is clear manual-payment copy and staff
  follow-up.
- Do not build a broad payment platform rewrite.
- Do not add SMS, calendar attachments, or V2 notification preferences unless
  explicitly scoped.
- Do not make onboarding completion automatically unlock sailing-card
  assignment.

## Persona Requirements

Use these personas before coding or reviewing pricing/onboarding work.

| Persona | Required path | Must catch |
| --- | --- | --- |
| MIT student getting first sailing card | Pricing or card info -> signup -> onboarding -> confirmation -> staff/admin state | Whether payment is required, whether card assignment is blocked until class/intro prerequisites, and what happens next. |
| Non-MIT racer | Pricing -> account/signup -> onboarding/racing membership -> payment or deferred explanation | If racing membership payment is missing, it must be linked to an existing task or drafted as a new issue. |
| Returning member | Profile/account -> membership/card state -> renewal or correction | Whether MIT affiliation/profile can be edited after onboarding. |
| Beginner class participant | Class listing -> intro class full -> waitlist -> email/admin state | Whether the two beginner classes have waitlist handling. |
| Staff/admin | Admin queue -> user registration -> prerequisite evidence -> card assignment | Card assignment must be unavailable before eligibility and available after eligibility. |
| Pavilion rental requester | Rental info/reservation path -> payment question | UI must say pavilion rental payment is manual and what staff/contact/next step follows. |

## Persona Gap Rule

When a persona discovers a missing capability:

1. Search this Linear project and linked GitHub issues first.
2. If the task exists, link it in the current PR run ledger.
3. If missing, draft a new Linear issue with persona evidence.
4. Ask Andrew before creating or changing the issue.
5. Final PR verification must classify the gap as fixed, linked, deferred, or
   intentionally dropped.

Example:

```markdown
Persona: Non-MIT racer
Discovery: Reads pricing, starts onboarding, cannot pay for racing membership.
Expected action: Link to the racing membership payment issue if it exists. If
missing, draft "Add racing membership payment during onboarding" and ask before
creating it.
```

## Linear Fields

Recommended statuses:

- Backlog
- Ready
- In progress
- Blocked
- In review
- Done
- Deferred
- Dropped

Recommended labels:

- `persona-discovered`
- `pricing`
- `membership`
- `onboarding`
- `payment`
- `waitlist`
- `admin`
- `manual-payment`
- `needs-decision`
- `legacy-parity`

Recommended custom fields if available:

- GitHub PR
- GitHub issue
- Persona evidence
- Milestone
- Product decision

## First Linear Agent Prompt

After the Linear project exists, run:

```text
Use the Membership pricing V1 Linear project as the PM source of truth.
Audit linked GitHub PRs, branches, and issues for pricing, membership,
onboarding, waitlists, profile affiliation editing, card assignment, and
manual pavilion rental payment copy.

For each persona-discovered gap, search the Linear project and linked GitHub
issues first. If it exists, link it. If it does not exist, draft a Linear issue
and ask before creating it.

Do not build online pavilion rental payment. Pavilion rental payment is manual;
verify the UI tells users that clearly.
```
