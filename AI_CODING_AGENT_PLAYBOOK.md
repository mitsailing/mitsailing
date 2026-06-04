# AI Coding Agent Playbook For Next.js, React, And Postgres Engineers

Version: 2.1
Audience: software engineers joining or working inside a large product company that builds a production web application with Next.js, React, TypeScript, and PostgreSQL.

This is an employee-facing engineering playbook. It explains how to start feature work with AI coding agents, how to split work across subagents, how to keep changes reviewable, and how to turn AI mistakes into durable improvements.

It is intentionally not a generic AI governance policy. Governance appears only where it changes day-to-day engineering behavior.

## What Good Looks Like

A good AI-assisted feature starts from a real product task, maps the current application, makes the smallest coherent change, proves it with tests and runtime evidence, and leaves behind better instructions or tests when the agent learns something.

The human engineer owns the result. The agent can inspect, draft, edit, test, and review, but the engineer remains accountable for product behavior, architecture, security, privacy, accessibility, data integrity, and release readiness.

## First Feature Checklist

Use this checklist when you start any non-trivial feature.

1. Read the ticket, PRD, or task source.
2. Identify the actor, starting page, object being changed, and success condition.
3. Identify data involved: public, internal, user data, regulated data, secrets, or production data.
4. Map the current route, component tree, server/client boundary, data access path, and tests.
5. Decide whether the work is UI-only, server-only, database-backed, or cross-cutting.
6. Pick the agent mode: single agent, conductor plus subagents, or manual work.
7. Write a small implementation packet before code changes.
8. Add or update tests before or with implementation.
9. Run targeted verification, then broader checks required by the repo.
10. Open or update the PR with evidence, unresolved risks, and reviewer focus areas.
11. If the agent made a repeatable mistake, create a durable learning artifact.

## Required Anti-Slop Gates

These are the required gates for high-quality AI-assisted code. They are project-agnostic and should be used before trusting an agent-built feature.

Overall rating:

- Without these gates, agentic feature work is usually **70-80/100**: fast, plausible, and often broken in real use.
- With these gates enforced, agentic feature work can reach **93-96/100**: still reviewed by humans, but much less likely to ship AI slop.

### Required 10

| Rank | Gate | Score | Required output |
| ---: | --- | ---: | --- |
| 1 | Intent confirmation | 99 | Actor, starting point, object, desired outcome, and non-goals in plain language. |
| 2 | User-journey runtime test | 99 | Agent acts as the user and proves the main path works in browser, API, or CLI. |
| 3 | Test-first acceptance criteria | 98 | Failing or planned tests before implementation for the core behavior. |
| 4 | Source evidence map | 96 | Existing routes, components, data paths, schemas, and tests with file references. |
| 5 | State and edge-case matrix | 95 | Happy path, empty, loading, invalid, unauthorized, failed, duplicate, and success states. |
| 6 | Negative/error-path tests | 94 | Tests that prove bad input, failed submit, missing permission, and validation errors behave correctly. |
| 7 | Data invariant and side-effect proof | 93 | Constraints, transactions, idempotency, and expected writes/events/messages. |
| 8 | Fresh adversarial review | 92 | Independent review focused on bugs, not style or praise. |
| 9 | Accessibility and usability smoke test | 91 | Keyboard path, labels, status messages, disabled-state reasons, mobile fit. |
| 10 | Verification report with exact evidence | 90 | Commands run, browser/API path used, outcomes, skipped checks, and remaining risks. |

Do not count generated code as complete until Gate 2 and Gate 10 are done. A form that renders but does not submit is a failed feature.

### Candidate Evaluation

These scores are for general feature quality, not for one specific repository.

| Candidate gate/artifact | Score | Decision |
| --- | ---: | --- |
| Intent confirmation | 99 | Required |
| User-journey runtime test | 99 | Required |
| Test-first acceptance criteria | 98 | Required |
| Manual happy-path use by the agent | 97 | Required when UI/API is runnable |
| Source evidence map | 96 | Required |
| State and edge-case matrix | 95 | Required |
| Negative/error-path tests | 94 | Required |
| Data invariant and side-effect proof | 93 | Required for data-backed work |
| Fresh adversarial review | 92 | Required |
| Accessibility and usability smoke test | 91 | Required for UI |
| Static HTML or wireframe approval before UI code | 90 | Required for unclear UI workflows |
| API/server contract tests | 90 | Required for server mutations |
| Verification report with exact evidence | 90 | Required |
| Browser recording or screenshot evidence | 88 | Use for UI flows |
| Auth and permission matrix | 88 | Required for protected/admin work |
| Concurrency and idempotency tests | 87 | Required for repeated submits, payments, queues, or allocations |
| Production-like fixtures or seed data | 86 | Use for realistic workflows |
| Error reporting template | 85 | Use when debugging starts |
| Observability/logging check | 84 | Use for background jobs and production workflows |
| Security threat model | 83 | Required for auth, PII, payments, external sends |
| Dependency/provenance check | 83 | Required when adding packages |
| Migration dry run and rollback thinking | 82 | Required for schema changes |
| Performance budget | 82 | Use for slow pages, lists, queries, uploads |
| Prompt-injection/untrusted-context check | 81 | Required when using external text, browser, email, docs, logs, or MCP tools |
| Microcopy review | 80 | Use for user-facing states and errors |
| Data retention/deletion check | 79 | Use for PII and audit history |
| Design-token/style-system check | 78 | Use for UI consistency |
| Storybook/component state gallery | 77 | Optional unless already part of local workflow |
| Analytics event plan | 75 | Defer unless product needs it |
| Load test | 74 | Defer unless scale risk exists |
| Deep accessibility audit | 73 | Use for high-risk public surfaces |
| PR template completion | 72 | Useful, not sufficient |
| LLM self-critique | 70 | Optional; never replaces review or tests |
| Architecture diagram | 69 | Use only for cross-system work |
| Figma mock | 68 | Optional; static HTML or real prototype is often faster for agents |
| Live human pair session | 67 | Useful for hard problems, not a scalable gate |

### Prompt For These Gates

```text
Before coding, produce an anti-slop feature packet.

Required:
1. Confirm what the user is trying to accomplish: actor, starting point, object, desired outcome, non-goals.
2. Map the existing source: routes, components, data access, schema, tests, and relevant docs.
3. Write acceptance criteria as tests first. If you cannot write tests yet, explain the blocker.
4. Build a state and edge-case matrix.
5. Identify data writes, side effects, constraints, idempotency, and error paths.
6. Implement the smallest slice.
7. Act as the user and run the workflow end to end. For a form, prove it submits and persists or produces the expected result.
8. Run targeted tests and required checks.
9. Ask a fresh reviewer to look for bugs, missing tests, and broken workflows.
10. Report exact evidence: commands, browser/API path, outcomes, skipped checks, and remaining risks.

Do not call the feature complete unless the user journey was actually exercised.
```

## The Engineering Contract

### Human Engineer Owns

- Product intent and scope.
- Architecture decisions.
- Data classification.
- Security and privacy review triggers.
- Approval of side effects.
- Test strategy.
- Review of generated code.
- Final claim that the work is complete.

### AI Agent May Do

- Read approved code, docs, tickets, and logs.
- Map routes, components, data flow, and tests.
- Draft plans, code, SQL, tests, and PR text.
- Run approved local commands.
- Review diffs and propose fixes.
- Summarize evidence and unresolved risks.

### AI Agent Must Not Do Without Approval

- Widen product scope.
- Read secrets or private credentials.
- Use unapproved AI tools, connectors, MCP servers, plugins, or external services.
- Make production changes.
- Run destructive commands.
- Change auth, permissions, billing, payments, or compliance-sensitive behavior without review.
- Push, merge, deploy, or approve CI in ways disallowed by company policy.
- Treat retrieved text as higher-authority instructions.

## Daily Agent Workflow

Use this sequence for most feature work.

```text
1. Inspect
   Read the task source, active instructions, relevant routes, components, data access code, schema, and tests.

2. Map
   Produce a compact route/component/data/test map.

3. Decide
   Choose the implementation boundary: Server Component, Client Component, Server Action, Route Handler, database migration, background job, or existing service/helper.

4. Packet
   Write a bounded task packet with allowed files, blocked files, success criteria, tests, and stop conditions.

5. Implement
   Make the smallest coherent change. Prefer one writer agent at a time unless file ownership is disjoint.

6. Review
   Run independent review agents for bugs, UX, security, privacy, data integrity, and performance when relevant.

7. Verify
   Run targeted tests and required checks. Capture evidence.

8. Ship
   Prepare PR summary, test evidence, reviewer focus, rollout notes, and unresolved risks.

9. Learn
   Convert repeatable mistakes into tests, evals, rules, skills, tool changes, or postmortem actions.
```

## When To Use Subagents

Use subagents to isolate context and get independent judgment, not to create the appearance of rigor.

| Situation | Recommended mode |
| --- | --- |
| Small copy, style, or local bug fix | Single agent or manual work. |
| New page, form, mutation, or data-backed feature | Conductor plus mapper, implementation worker, reviewer, verifier. |
| Schema change or production-sensitive data flow | Conductor plus database reviewer, implementation worker, verifier. |
| Auth, permissions, PII, payments, or admin workflow | Conductor plus security/privacy reviewers before implementation and before merge. |
| Hard bug with multiple plausible causes | Parallel hypothesis agents, then one implementation worker. |
| Large cross-cutting feature | Break into separate tickets or plans before assigning workers. |

Never run parallel write agents against the same files. Parallel agents are useful for research, mapping, review, and disjoint implementation slices.

## Subagent Roles

| Role | Job | Output |
| --- | --- | --- |
| Conductor | Owns scope, sequence, state, and final synthesis. | Task ledger, selected workers, decisions, blocker list, final go/no-go. |
| Codebase mapper | Reads the app and identifies existing routes, components, data flow, tests, and patterns. | Route/component/data/test map with likely edit points. |
| Docs researcher | Checks current official docs for framework/library/API behavior. | URLs, relevant findings, constraints, uncertainty. |
| Implementation worker | Makes one scoped code change. | Changed files, tests, commands, risks, decisions needed. |
| UI reviewer | Reviews actor path, accessibility, copy, states, responsive behavior. | Findings with evidence and minimal fixes. |
| Server/data reviewer | Reviews Server Actions, Route Handlers, transactions, queries, migrations, indexes. | Data integrity and performance findings. |
| Security reviewer | Reviews auth, authorization, secrets, prompt injection, tool permissions, side effects. | Threats, impact, mitigation, approval gates. |
| Privacy reviewer | Reviews PII, retention, logging, minimization, analytics, data sharing. | Data inventory, exposure paths, required redactions. |
| Bug reviewer | Independent defect review after implementation. | Severity-ordered findings with file/line evidence. |
| Verifier | Runs final checks and confirms source-of-truth state. | Commands, results, skipped checks, go/no-go. |
| Learning reviewer | Converts mistakes into durable artifacts. | Mistake type, artifact selected, owner, verification. |

## Stack Standards

These standards are written for a typical large-company Next.js App Router, React, TypeScript, and PostgreSQL stack. Local repository rules always win when they are stricter.

### Next.js

- Prefer App Router patterns for new work.
- Prefer Server Components for data loading, composition, and non-interactive UI.
- Use Client Components only where browser APIs, client state, event handlers, or client-only hooks are needed.
- Keep Client Component props serializable.
- Use Server Actions for UI-triggered mutations when the action belongs to the page/form flow.
- Use Route Handlers for external APIs, webhooks, machine clients, downloads, and non-UI HTTP interfaces.
- Authenticate and authorize every mutation path, including Server Actions.
- Validate all user input on the server.
- Use `redirect`, `notFound`, route-level error files, and expected error returns intentionally.
- Be explicit about caching, revalidation, and request-bound data.
- Avoid app-wide dynamic settings unless the whole route segment truly needs them.
- Keep metadata, Open Graph, image, font, and script decisions close to the route or layout that owns them.
- Default to Node runtime for database-backed routes unless the repo explicitly supports another runtime for that path.

### React

- Components should be pure: render should not cause side effects.
- Put state as close as possible to the component that owns the interaction.
- Treat `useEffect` as an escape hatch for external systems: browser APIs, subscriptions, imperative widgets, timers, or network synchronization that cannot be handled by the framework.
- Do not use effects for derived state, ordinary event handling, or data that the server can load.
- Prefer native form semantics and accessible controls before custom widgets.
- Keep loading, empty, error, disabled, optimistic, and success states explicit.
- Do not add manual memoization as a reflex. Use it when profiling, framework guidance, or a known expensive render justifies it. If the app uses React Compiler, avoid fighting it with unnecessary `memo`, `useMemo`, or `useCallback`.
- Do not hide complexity in giant components. Split by user task, state ownership, and reusable behavior.

### PostgreSQL

- Put data integrity in the database where it belongs: primary keys, foreign keys, unique constraints, `NOT NULL`, and `CHECK` constraints.
- Use transactions when a feature writes multiple rows or depends on read-then-write consistency.
- Design migrations for production: lock impact, backfills, rollback, deploy order, and compatibility with old and new app versions.
- For large production tables, consider concurrent index creation where supported by the migration tool and deployment process.
- Add indexes for real query patterns, not hypothetical future use.
- Use `EXPLAIN` or `EXPLAIN ANALYZE` for performance-sensitive queries.
- Avoid leaking raw SQL strings through application layers without typed parameters or a reviewed query builder.
- Treat nullable columns, cascades, soft deletes, and uniqueness as product decisions, not implementation details.
- Verify data migrations with before/after counts or invariant queries.

## Architecture Decision Guide

Use this before assigning an implementation worker.

| Question | Default answer | Escalate when |
| --- | --- | --- |
| Is this just display from server data? | Server Component. | It needs client interaction or browser state. |
| Is this an interactive widget? | Small Client Component at the leaf. | The client boundary would pull large server-only code into the bundle. |
| Is this a form mutation tied to a page? | Server Action. | It is consumed by external systems or needs HTTP semantics. |
| Is this an external endpoint or webhook? | Route Handler. | It can be modeled as a normal page action instead. |
| Does this need new persistent data? | Add schema deliberately with constraints and migration plan. | Existing table/field can represent the lifecycle cleanly. |
| Does this need derived data? | Compute server-side or in SQL when possible. | It needs a materialized table/cache with clear invalidation. |
| Does this need background work? | Use existing job/queue pattern. | The user can wait synchronously and the operation is bounded. |
| Does this need new auth/role behavior? | Stop for security review. | Existing policy already covers it and tests prove it. |

## Feature Start Template

```markdown
# Feature Start Packet

Feature:
Ticket/spec:
Engineer:
Date:

Actor:
Starting page/API:
Object being changed:
Success condition:

In scope:
Out of scope:
Open product questions:

Data involved:
Data classification:
Auth/permission impact:
Privacy impact:
Production/data migration impact:

Current app map:
- Route(s):
- Layout/page/component(s):
- Server Components:
- Client Components:
- Server Actions:
- Route Handlers:
- Data access:
- Database tables:
- Tests:

Proposed implementation boundary:
Expected tests:
Required reviewers:
Stop conditions:
```

## Route, Component, And Data Map Template

```markdown
# Route / Component / Data Map

Task:

User path:
1.
2.
3.

Routes:
| Route | Purpose | Owner component |
| --- | --- | --- |

Components:
| Component | Server/Client | Why | Data props |
| --- | --- | --- | --- |

Mutations:
| Mutation | Server Action / Route Handler | Auth check | Validation | Revalidation |
| --- | --- | --- | --- | --- |

Database:
| Table | Read/write | Constraint/index needed | Migration needed |
| --- | --- | --- | --- |

Existing tests:
Gaps:
Recommended edit points:
```

## Implementation Worker Template

```text
You are a bounded implementation worker for a Next.js, React, TypeScript, and PostgreSQL product.

Goal:
[One behavior.]

Source of truth:
[Ticket/spec/plan.]

Allowed files:
[Exact paths or modules.]

Blocked files:
[Anything off-limits.]

Architecture decision:
- Server Component:
- Client Component:
- Server Action:
- Route Handler:
- Database migration:

Required process:
1. Inspect the mapped files and tests.
2. State the smallest implementation plan.
3. Add or update focused tests when practical.
4. Implement the smallest coherent change.
5. Run targeted checks.
6. Report changed files, evidence, and risks.

Stop if:
- Scope needs to widen.
- Product semantics are ambiguous.
- Auth/privacy/security behavior changes.
- A migration or production-impacting operation needs approval.
- You need secrets or unapproved tools.

Return:
- Changed files.
- Tests added/updated.
- Commands run.
- Evidence.
- Unresolved risks.
- Decisions needed.
```

## Database Change Template

```markdown
# Postgres Change Packet

Feature:
Owner:

Current tables:
Proposed schema change:
Why existing schema is insufficient:

Constraints:
- Primary/foreign keys:
- Unique constraints:
- NOT NULL:
- CHECK:
- Cascades:

Indexes:
- Query served:
- Index type:
- Concurrent creation needed:
- Expected selectivity:

Migration plan:
1.
2.
3.

Deploy compatibility:
- Old app with new schema:
- New app with old schema:
- Backfill needed:
- Rollback:

Verification queries:
~~~sql
-- before

-- after
~~~

Risks:
Reviewer:
```

## Server Action / Route Handler Review Template

```markdown
# Server Mutation Review

Mutation:
Location:
Type: Server Action / Route Handler

Caller:
User-visible outcome:

Authentication:
Authorization:
Input validation:
CSRF/origin considerations:
Rate limiting/abuse controls:
Transaction boundary:
Revalidation/cache behavior:
Expected errors:
Audit/logging:
Tests:
```

## UI Review Template

```markdown
# UI Review

Actor:
Task:
Route:

States reviewed:
- Loading:
- Empty:
- Error:
- Disabled:
- Pending:
- Success:
- Permission denied:
- Mobile:
- Keyboard:
- Screen reader semantics:

Copy:
Accessibility:
Visual hierarchy:
Responsive behavior:
Screenshots/evidence:

Findings:
| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
```

## PR Template For AI-Assisted Work

```markdown
## Summary

## Linked Ticket / Source Of Truth

## AI Assistance

AI was used for:
- [ ] Research
- [ ] Code mapping
- [ ] Implementation draft
- [ ] Tests
- [ ] Review
- [ ] PR text

## Architecture Notes

- Server/Client boundary:
- Server Actions / Route Handlers:
- Database changes:
- Caching/revalidation:

## Tests And Verification

| Check | Result | Evidence |
| --- | --- | --- |

## Security / Privacy / Data Notes

## Reviewer Focus

## Unresolved Risks
```

## Verification Report Template

```markdown
# Verification Report

Task:
Commit/branch/PR:
Verifier:

Commands run:
| Command | Result |
| --- | --- |

Manual/runtime checks:
Database checks:
Screenshots/logs/traces:
CI/check state:

Skipped checks:
Unverified claims:
Remaining risks:
Final status: Pass / Fail / Blocked
```

## Review Packet Template

```text
You are an independent reviewer. You did not write this code.

Review:
[PR/diff/files.]

Focus:
- Product behavior.
- Bugs/regressions.
- Server/client boundary.
- Server Action / Route Handler correctness.
- Postgres integrity and query risk.
- Auth/security/privacy.
- Missing tests.
- Unnecessary complexity.

Return findings first:
- Severity.
- File/line.
- Evidence.
- Impact.
- Minimal fix or proving test.

If no issues, say that clearly and list remaining risk.
```

## Feedback Best Practices: Rules And Boundaries

Feedback is not useful until it becomes an action the agent can execute and a boundary it cannot cross again. Treat every meaningful correction as a small engineering input: reproduce it, classify it, convert it into a rule or test, fix it, and prove the fix.

This section is based on recurring patterns from agentic coding practice: write prompts like issues, use plan mode when the approach is uncertain, make verification criteria explicit, use subagents for independent review, keep untrusted context below system and repo instructions, and do not treat AI review as a substitute for tests or human approval.

### Feedback Intake Loop

Use this loop for user, reviewer, QA, design, security, support, and production feedback.

1. Quote the feedback in one sentence.
2. Name the failed user or engineer outcome.
3. Classify the failure type.
4. Reproduce or inspect the issue before changing code.
5. Choose the narrowest durable boundary: test, blocker, rule, skill, eval, source map, PR checklist, or runtime proof.
6. Ask `/impeccable` to refine product/UI feedback into specific user-visible changes when the issue affects experience, copy, layout, forms, or state clarity.
7. Ask Codex to implement only the selected fix and verification, not to redesign the whole feature.
8. Run the user journey or failing test that would have caught the problem.
9. Update the PR or packet with evidence and remaining risk.
10. If the same failure could recur, add the durable boundary before marking complete.

Do not accept feedback handling that says only "fixed", "improved", "made clearer", or "be careful next time". Those are not engineering artifacts.

### Feedback Classifier

| Feedback signal | Likely failure | Boundary to add | Codex action |
| --- | --- | --- | --- |
| "This is not what I asked for." | Intent drift. | Intent gate with actor, starting point, object, outcome, and non-goals. | Rewrite the feature packet before code. |
| "The page looks nice but I still do not know what to do." | User-journey clarity failure. | `/impeccable` critique plus novice-user task test. | Refine state labels, CTA hierarchy, and next-action proof. |
| "The form renders but does not submit." | Runtime workflow failure. | Browser/API journey test and negative-path test. | Reproduce the submit path, fix the smallest broken step, prove persistence or expected error. |
| "You assumed a rule that is not true." | Source evidence failure. | Source map and blocker rule. | Re-check authoritative docs/pages/code and update the packet. |
| "This feels like AI slop." | Craft or system-fit failure. | `/impeccable` audit against product context and design system. | Remove generic UI, align with existing patterns, verify responsive and accessibility states. |
| "This is too much architecture." | Scope inflation. | Simplicity boundary: field/helper before table/service/workflow. | Delete unnecessary abstraction and keep the smallest coherent slice. |
| "This misses auth, privacy, or data risk." | Safety boundary failure. | Security/privacy checklist and tests. | Add authorization, minimization, redaction, retention, or stop for review. |
| "The same mistake happened again." | Learning artifact failure. | Rule, skill, eval, or regression test. | Add the narrowest durable artifact and prove it triggers. |

### `/impeccable` Feedback Prompt

Use this when feedback is about UI, product flow, copy, perceived quality, onboarding, form behavior, or user understanding.

```text
Use /impeccable on this feedback before changing code.

Context:
- Product surface:
- Actor:
- Starting point:
- User goal:
- Current artifact or route:
- Feedback:

Required output:
1. Restate the product misunderstanding in plain language.
2. Identify which user state or decision point failed.
3. Decide whether the fix is copy, layout, control placement, state model, visual hierarchy, accessibility, or flow.
4. Propose the smallest set of UI changes.
5. List what Codex should edit.
6. List what must be verified in browser.

Boundaries:
- Do not add new product behavior unless the feedback requires it.
- Do not solve unclear states with paragraph-length explanatory text.
- Do not introduce new visual patterns when existing components can carry the fix.
- If the product rule is unknown, mark it as a blocker instead of designing around an assumption.
```

### Codex Feedback Fix Prompt

Use this after `/impeccable` has converted product feedback into concrete changes, or when feedback is already technical and testable.

```text
Fix this feedback with the narrowest safe change.

Feedback:
[paste exact feedback]

Approved interpretation:
[paste the classified failure and intended behavior]

Allowed scope:
[files/routes/components/tests]

Boundaries:
- Do not widen product scope.
- Do not invent new states, permissions, services, tables, or flows.
- Do not touch unrelated files.
- If an authoritative source is unavailable, stop and report a blocker.
- If this affects UI, preserve existing design system patterns and verify desktop/mobile.

Required steps:
1. Reproduce or inspect the issue.
2. Add or update the test/check that would catch it.
3. Implement the smallest fix.
4. Run targeted verification.
5. Act as the end user for the affected journey.
6. Report exact evidence, skipped checks, and remaining risk.
```

### Rule And Boundary Selection

Pick the smallest artifact that would have stopped the mistake. Large global rules are expensive; tests and scoped rules usually work better.

| If feedback exposes... | Prefer this boundary | Avoid |
| --- | --- | --- |
| A broken behavior | Regression test or browser journey. | A new prompt warning. |
| A missing product rule | Blocker in the feature packet. | Agent assumption written as product truth. |
| Confusing UI state | Static state artifact plus `/impeccable` acceptance criteria. | More explanatory prose on the page. |
| Repeated repo convention miss | Scoped rule or skill update. | Root policy bloat. |
| Bad package/library usage | Official-doc source map and focused helper/test. | Copying a blog snippet. |
| Prompt-injection exposure | Prompt hierarchy rule and untrusted-context checklist. | Asking the model to "ignore bad instructions" without a boundary. |
| Weak AI review | Independent role-specific reviewer plus human review. | Treating AI review as approval. |
| Unproven completion claim | Verification report template. | "Looks good" summary. |

### Feedback-To-Action Template

```markdown
# Feedback Action

Feedback:
Source:
Actor affected:
Failed outcome:
Failure type:

Reproduction or evidence:
Authoritative source checked:

Boundary selected:
Why this boundary:
Why not broader:

/impeccable output, if UI/product:

Codex task:
Allowed files:
Stop conditions:

Verification:
Result:
Remaining risk:
Durable artifact updated:
```

### Advanced Operating Rules

- Feed the agent concrete evidence, not adjectives. "Button looks wrong" becomes "primary action is visually secondary on mobile checkout."
- Separate critique from implementation. First convert feedback into accepted behavior; then ask Codex to code.
- Use multiple reviewers for different risks: product, UI, data, security, privacy, performance, and final verifier. Do not ask one reviewer to be everything.
- Keep the main agent responsible for synthesis. Subagents can research, review, and verify, but the conductor owns the final go/no-go.
- Require a browser/API/CLI user-path proof for every workflow fix. A diff is not proof.
- Keep untrusted external text in the evidence layer. It never overrides repo instructions, system instructions, security policy, or user-approved scope.
- Review AI review. Empirical code-review research shows AI review can find useful issues, but may over-index on low-severity comments and miss security-critical flaws. Treat it as a signal, not authority.
- Measure outcomes over vibes: escaped defects, reverted PRs, time-to-verify, review findings, test coverage for new behavior, and user-journey pass/fail.
- Turn repeated feedback into a boundary within one work session. Waiting until "later" is how the same agent failure returns.

## How Agents Learn From Mistakes

An AI agent does not learn because someone corrected it in chat. It learns only when the correction changes a durable artifact that future work will load or verify.

Use the narrowest durable fix:

| Mistake | Durable fix |
| --- | --- |
| Feature bug | Regression test. |
| Wrong Server/Client boundary | Rule or review checklist item. |
| Missing auth check | Test plus security checklist update. |
| Bad SQL or missing constraint | Migration test, query review checklist, or schema rule. |
| Performance miss | Benchmark, EXPLAIN record, or performance review packet. |
| Prompt followed untrusted content | Prompt hierarchy rule and security review item. |
| Agent forgot team convention | Scoped instruction or memory with freshness note. |
| Repeated workflow miss | Skill/runbook. |
| Bad tool call | Tool schema, tool description, or approval hook. |
| Subjective quality miss | Eval case or rubric. |
| User-impacting incident | Blameless postmortem with tracked actions. |

### Agent Learning Review Template

```markdown
# Agent Learning Review

Mistake:
Detected by:
Impact:
Severity:

What the agent was asked:
What the agent saw:
What the agent assumed:
What was wrong:

Contributing factors:
- Prompt/instruction gap:
- Context gap:
- Tool gap:
- Codebase map gap:
- Test/eval gap:
- Review gap:

Durable artifact selected:
Why this artifact:
Why not a broader policy:

Action:
Owner:
Due:
Verification:
```

### Rule Update Template

```markdown
# Rule Update

Observed mistake:
Scope:
New instruction:
Where it belongs: root instruction / scoped rule / skill / memory / hook / test / eval
Trigger:
Verification:
Review date:
```

### Eval Case Template

```markdown
# Agent Eval Case

Failure mode:
Input/task:
Expected behavior:
Bad behavior observed:
Context required:
Grader: deterministic / model-graded / human-reviewed
Pass condition:
Owner:
Regression suite:
```

## New Engineer Onboarding Plan

### Day 1: Read And Run

- Read engineering principles, repo instructions, data policy, and AI tool policy.
- Run the app and test suite locally.
- Use an agent only in observe/plan mode until you understand the repo's review expectations.

### Week 1: First Small PR

- Pick a small ticket with a clear route or component.
- Ask an agent to map the route/component/data/test path.
- Make the change yourself or with one bounded worker.
- Run targeted checks.
- Ask an independent agent for review.
- Open a PR with evidence.

### Week 2: Data-Backed Feature

- Map the server/client boundary.
- Identify Server Action or Route Handler.
- Identify schema and constraints.
- Write tests for the mutation and data integrity.
- Get database/security review if needed.

### Month 1: Trusted Agent Use

- Use subagents for research, mapping, review, and verification.
- Write cleaner task packets.
- Add tests or rules when agents make repeatable mistakes.
- Help improve the team prompt/rule library without bloating it.

## What To Avoid

- Starting with code before mapping the route, component, and data flow.
- Asking an agent to "build the feature" without a packet.
- Adding Client Components because it feels easier.
- Adding `useEffect` for derived state or form submission.
- Adding a table when a field or constraint would do.
- Adding an index without a query.
- Shipping a migration without lock/backfill/rollback thinking.
- Letting agents make product decisions silently.
- Treating AI review as human review.
- Treating "the agent said tests pass" as evidence.
- Writing broad policy when a test, rule, or checklist item would fix the mistake.

## References

- Next.js App Router docs: https://nextjs.org/docs/app
- Next.js Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js updating data and Server Actions: https://nextjs.org/docs/app/getting-started/updating-data
- Next.js Route Handlers: https://nextjs.org/docs/app/api-reference/file-conventions/route
- Next.js caching: https://nextjs.org/docs/app/getting-started/caching
- React docs: https://react.dev/
- React Effects guide: https://react.dev/learn/synchronizing-with-effects
- React Server Components: https://react.dev/reference/rsc/server-components
- React Compiler docs: https://react.dev/learn/react-compiler
- PostgreSQL constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
- PostgreSQL transactions: https://www.postgresql.org/docs/current/tutorial-transactions.html
- PostgreSQL CREATE INDEX: https://www.postgresql.org/docs/current/sql-createindex.html
- PostgreSQL EXPLAIN: https://www.postgresql.org/docs/current/using-explain.html
- OpenAI Codex best practices: https://developers.openai.com/codex/learn/best-practices
- OpenAI, How OpenAI uses Codex: https://openai.com/business/guides-and-resources/how-openai-uses-codex/
- OpenAI agent evals: https://developers.openai.com/api/docs/guides/agent-evals
- Anthropic Building effective agents: https://www.anthropic.com/engineering/building-effective-agents
- Anthropic Claude Code best practices: https://www.anthropic.com/engineering/claude-code-best-practices
- Claude Code subagents docs: https://code.claude.com/docs/en/sub-agents
- GitHub Copilot coding agent best practices: https://docs.github.com/en/copilot/using-github-copilot/coding-agent/best-practices-for-using-copilot-to-work-on-tasks
- GitHub Copilot code review docs: https://docs.github.com/en/copilot/how-tos/agents/copilot-code-review/using-copilot-code-review
- Google DORA 2025 report summary: https://blog.google/innovation-and-ai/technology/developers-tools/dora-report-2025/
- OWASP LLM prompt injection guidance: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- Copilot code review security study: https://arxiv.org/abs/2509.13650
