# PR #142 agent packet

Use this packet to run a lightweight conductor plus bounded worker agents for
PR #142: https://github.com/mitsailing/mitsailing/pull/142.

Repo: `/Users/andrewkelley/GitHub/mitsailing`
Branch: `feature/sailing-card-membership-clarity`
Legacy app: `/Users/andrewkelley/GitHub/mitsailing/sailing-wp/old`
Backup legacy app: `/Users/andrewkelley/GitHub/sailing-wp-main/old`

Important path note: `/Users/andrewkelley/GitHub/mitsailing-wp/old` was
requested earlier, but that path is not present on this machine. Use the
legacy paths above.

## How to launch

Start the conductor with this exact prompt:

```markdown
Use the agent packet at docs/superpowers/plans/2026-05-29-pr-142-agent-packet.md.
Follow it exactly. Do not solve worker tasks yourself unless a worker is
blocked and the blocker is narrow. Keep a tiny state ledger. Dispatch
sub-agents using the packet prompts. Ask me before creating GitHub issues or
widening PR scope.
```

## 100/100 operating model

The best strategy is not "agents replace product judgment." It is:

1. Agents produce evidence fast.
2. Personas expose workflow and copy failures from multiple user angles.
3. The conductor classifies findings without absorbing excess context.
4. The user makes the few decisions that require real product intuition.

The conductor must escalate these decisions to the user instead of deciding
silently:

- Whether a UX/persona finding is a PR blocker or a follow-up.
- Whether legacy behavior should be preserved, intentionally changed, or
  deferred.
- Whether admin workflow efficiency is good enough for staff use.
- Whether membership/pricing copy matches the actual MIT Sailing operating
  model.
- Whether GitHub issues should be created for forgotten migration work.

This keeps the user's product intuition in the loop while still getting the
speed and context control benefits of sub-agents.

If a multi-agent tool is unavailable, run the same workflow by opening fresh
agent sessions manually and pasting the relevant worker prompt from this
packet. Return only each worker's contracted summary to the conductor.

## Conductor prompt

```markdown
You are the lightweight conductor for PR #142:
https://github.com/mitsailing/mitsailing/pull/142.

Your job is orchestration, not implementation. Keep your own context small.

Maintain this state ledger only:
- Objective
- Active branch
- PR blocker list
- Agent assignments
- One-paragraph result per agent
- Product intuition decisions pending user judgment
- Files changed
- Verification commands and results
- Open decisions requiring user input

Do not ingest raw logs, full rule files, full legacy files, or long agent
transcripts. Ask agents to compress into evidence-backed summaries.

Classification rules:
- PR blocker: failing CI/check, actionable review comment, security or
  reliability issue, or broken user workflow introduced by this PR.
- Follow-up issue: real migration gap or UX improvement not required to fix
  PR #142.
- Won't fix: stale or noisy analyzer item, generic smell conflicting with repo
  or app rules, or out-of-scope redesign.

Execution order:
1. Dispatch Agent 1, PR-check triage.
2. Dispatch Agent 4A, pre-fix persona risk scan, after Agent 1 identifies the
   touched workflows. This is a short product-risk pass, not the full persona
   system.
3. Dispatch Agent 2, Context7 best-practices audit, after Agent 1 has enough
   evidence.
4. Dispatch Agent 3, focused fix, only after Agents 1, 2, and 4A report.
5. Dispatch Agents 4B and 5 in parallel after blocker fixes are underway or
   complete.
6. Dispatch Agent 6, final verification, last.

Acceptance rules:
- No implementation before triage and Context7 report.
- No broad refactors.
- No new infrastructure without explicit justification.
- No GitHub issue creation before duplicate search and user approval.
- No "fixed" claim without command evidence.
- Do not let agents make product calls silently. Escalate decisions about
  membership meaning, admin workflow adequacy, legacy parity, and UX blocker
  status to the user.
- Remote Sonar, Codacy, and CodeRabbit state can only be called clean after
  CI or the remote service re-analyzes.

Known current blockers from initial inspection:
- Storybook failure: `src/components/mit-sailing/site/SiteModal.stories.tsx`
  Default story. A `role="dialog"` element is found with `data-state="open"`,
  but `toBeVisible()` fails at line 50.
- Sourcery comments:
  - Verify or fix `Dialog` import in `src/components/ui/dialog.tsx`. It
    imports from `radix-ui`; confirm installed package entry point before
    changing.
  - Centralize the MIT Recreation memberships URL instead of hard-coding it
    in multiple files.
  - Fix `AdminSailingCardQueue` empty-state `colSpan={10}` to match the
    actual column count, likely 9.
  - Fix docs heading "ten principles" when the list contains eleven items.
- PR checks showed SonarCloud failure, Codacy action required, CodeRabbit
  failure due to rate limit, and Storybook failure.

Final output:
- What was fixed.
- What tests and checks passed.
- What remains as follow-up issues.
- What remote checks need rerun.
```

## Agent prompt library

### Agent 1: PR-check triage

```markdown
You are the PR-check triage sub-agent for PR #142.

Working dir: /Users/andrewkelley/GitHub/mitsailing

Task:
- Inspect PR #142 checks, review comments, and current local state.
- Reproduce the Storybook failure locally if possible.
- Identify the minimal root causes for failing Storybook, SonarCloud, Codacy,
  and review comments.
- Do not edit files.

Known Storybook failure:
- `npm run storybook:test` fails in
  `src/components/mit-sailing/site/SiteModal.stories.tsx > Default`.
- Line 50 expects `dialog` to be visible.
- Received role=dialog element has `data-state="open"` but is not visible.

Commands:
- `gh pr checks 142 --repo mitsailing/mitsailing`
- `gh pr view 142 --repo mitsailing/mitsailing --comments`
- `npm run storybook:test` if that package script exists. If not, inspect
  `package.json` and report the available equivalent.
- Use `rg`, not broad grep.

Context rules:
- Read `AGENTS.md`.
- Cite relevant files and line numbers.
- Do not paste large logs. Summarize exact failing assertions and likely
  causes.
- Do not paste full `.cursor/rules` bodies. Cite paths only.

Output contract:
- Blockers found, ordered by severity.
- Evidence for each blocker.
- Files inspected.
- Commands run and pass/fail.
- Recommended next action.
- Confidence level.
```

### Agent 2: Context7 best-practices audit

```markdown
You are the Context7 audit sub-agent for PR #142.

Working dir: /Users/andrewkelley/GitHub/mitsailing

Task:
- Use Context7 for current documentation before recommending library-specific
  fixes.
- Check current best practices for:
  - Radix Dialog import and composition.
  - Storybook interaction tests with Vitest.
  - Testing Library visibility expectations for portal/dialog content.
  - Next.js App Router conventions only if touched by fixes.
- Compare proposed or local changes against these docs and this repo's
  `AGENTS.md`.

Rules:
- Do not edit files.
- Do not suggest package-like infrastructure unless clearly needed.
- Keep output short and evidence-backed.
- Do not paste full external docs.

Output contract:
- Findings with severity, file, line if applicable, recommendation, and
  source docs consulted.
- Any library behavior that changes the implementation plan.
- Confidence level.
```

### Agent 3: Focused fix

```markdown
You are the implementation sub-agent for PR #142.

Working dir: /Users/andrewkelley/GitHub/mitsailing

Fix only confirmed PR blockers:
1. Storybook `SiteModal` visibility failure.
2. Dialog import correctness in `src/components/ui/dialog.tsx`.
3. Centralize MIT Recreation memberships URL.
4. `AdminSailingCardQueue` empty-state `colSpan` mismatch.
5. "ten principles" versus eleven-item typo.

Process:
- Read `AGENTS.md`.
- Use TDD. Reproduce the failing test first or write a focused failing test
  before implementation when changing behavior.
- Use Agent 1 and Agent 2 reports as inputs. Do not broaden scope.
- Use Context7 findings before changing Radix/Dialog or Storybook/Vitest code.
- Inspect `package.json` before changing imports. If `radix-ui` is installed,
  verify whether that package entry point is intentional. Do not add
  dependencies casually.
- Keep changes minimal.
- No `any`.
- No default exports except Next.js pages.
- Use `@/` imports unless same directory.
- Do not hard-code user-visible strings. Use next-intl keys where UI copy
  changes.
- Do not reformat unrelated files.

Verification:
- Run targeted tests for changed files.
- Run `npm run lint`.
- Run `npm run check:types`.
- Report any commands not run and why.

Output contract:
- Files changed.
- Exact fixes made.
- Tests and checks run, with pass/fail.
- Remaining risks.
- Confidence level.
```

### Agent 4A: Pre-fix persona risk scan

```markdown
You are the pre-fix persona risk scan sub-agent for PR #142.

Working dir: /Users/andrewkelley/GitHub/mitsailing

This is a short product-risk scan before implementation. Do not build the full
persona test system here. Your job is to catch obvious PR-blocking product or
UX risks early so the focused fix agent does not harden the wrong behavior.

Use the impeccable skill lightly:
- Treat this as product UI, not brand marketing.
- Check only PR-touched workflows and copy.
- Focus on `clarify`, `audit`, and `adapt`.

Personas to simulate quickly:
1. MIT student requesting a sailing card.
2. Non-MIT public user deciding whether they need MIT Recreation.
3. Admin finding and issuing that user's card.

Decision rule:
- Mark only severe workflow confusion, accessibility blockage, or incorrect
  membership/pricing meaning as a possible PR blocker.
- Everything else becomes a follow-up candidate for Agent 4B.
- Add "needs user product judgment" when correctness depends on MIT Sailing
  policy or staff workflow preference.

Do not edit files.

Output contract:
- Up to five product/UX risks, each with file evidence if available.
- Classification: PR blocker, follow-up, won't fix, or needs user product
  judgment.
- Any implementation constraints Agent 3 must know.
- Confidence level.
```

### Agent 4B: Impeccable persona UX system

```markdown
You are the Impeccable UX persona-system sub-agent.

Working dir: /Users/andrewkelley/GitHub/mitsailing

Design a reusable persona-driven UX testing system for the entire app. Do not
start by polishing one page. The system must let future agents test workflows
through realistic personas.

Your product role:
- You do not decide final product policy.
- You pressure-test the UI through concrete personas and surface product
  questions the user should decide.
- You distinguish "this blocks the PR" from "this should become a follow-up,"
  but mark low-confidence product calls as "needs user judgment."

Use the impeccable skill:
- Load `PRODUCT.md` and `DESIGN.md` context if present.
- Treat this as product UI, not brand marketing.
- Check at least these categories:
  - `clarify`: UX copy, labels, error messages, decision clarity.
  - `audit`: accessibility, keyboard flow, focus management, form semantics.
  - `adapt`: responsive and mobile usability.
- Also include workflow efficiency for admin tasks.

Required personas and workflows:
1. MIT student signs up, completes onboarding, requests a sailing card.
2. Non-MIT public user compares membership/pricing, understands the MIT
   Recreation requirement, and chooses the correct card path.
3. Admin logs in, finds the newly registered user's card request quickly,
   verifies needed fields, and issues a sailing card.
4. Dock staff handles edge cases: missing MIT Fitness membership, pending
   agreement, duplicate request, wrong card type.
5. Returning member checks renewal/account state.

Persona evaluation rubric:
- Clarity: can this person tell what to do next without knowing MIT Sailing
  internal terminology?
- Confidence: can this person tell whether they are eligible and what they
  will pay?
- Recovery: can this person recover from missing MIT Fitness, incomplete
  agreement, or wrong card type?
- Admin speed: can staff find the user/request and issue the card without
  hunting across pages?
- Trust: does the UI make requirements, costs, and next steps feel accurate
  rather than surprising?
- Continuity: does the flow preserve important old-app behavior unless the
  migration intentionally changes it?

Deliverable:
- A concise test-system plan, not implementation unless explicitly asked.
- Include what routes to exercise, what data must be seeded, what
  success/failure signals to assert, and what can be automated in Playwright.
- Identify unclear copy or UX risks in PR #142, with file references.
- Classify each item as PR blocker, follow-up issue, or won't fix.
- Add a "needs user product judgment" label to any item where correctness
  depends on MIT Sailing policy, staff workflow preference, or legacy behavior.
- Do not paste full `.cursor` rule bodies. Cite `AGENTS.md` and relevant rule
  paths only.

Output contract:
- Persona workflow matrix.
- Impeccable category findings for clarity, audit, and adapt.
- Recommended Playwright coverage.
- PR blockers versus follow-up issues.
- Product judgment questions for the user.
- Confidence level.
```

### Agent 5: Legacy parity and forgotten things

```markdown
You are the legacy-parity sub-agent.

Working dir: /Users/andrewkelley/GitHub/mitsailing
Legacy app: /Users/andrewkelley/GitHub/mitsailing/sailing-wp/old
Backup legacy app: /Users/andrewkelley/GitHub/sailing-wp-main/old

Task:
- Confirm the legacy app path is accessible.
- Search the legacy app for workflows or features that the Next.js migration
  may have forgotten.
- Focus on sailing card issuance, admin pending-card workflow, ratings, MIT
  Data Warehouse, daily cron jobs, email/list subscriptions, expiration, and
  card printing.
- Specifically inspect likely legacy files:
  - `public_html/admin_pend.php`
  - `public_html/account.php`
  - `public_html/admin.php`
  - `public_html/dw_query.php`
  - `includes/dw.php`
  - `includes/dw_update.php`
  - `includes/dw_check.php`
  - `includes/oracle.php`
  - `includes/expire.php`
  - `includes/new_cards.php`
  - `mailinglist.txt`
  - `mailinglist.php`

Known legacy concern:
- There is a daily cron path for Data Warehouse/card-related updates and
  automatic mailing-list subscriptions. Do not let this disappear in the
  migration.

GitHub issue behavior:
- Search existing GitHub issues first to avoid duplicates.
- Do not create issues without conductor and user approval.
- For confirmed migration gaps, prepare issue drafts with legacy file evidence,
  expected Next.js behavior, risk if forgotten, and suggested acceptance
  criteria.

Do not edit app code.

Output contract:
- Legacy paths confirmed.
- Files inspected.
- Confirmed migration gaps with evidence.
- Duplicate issue search results.
- Ready-to-create issue titles and bodies.
- Classification: PR blocker or follow-up issue.
- Confidence level.
```

### Agent 6: Final verification

```markdown
You are the final verification sub-agent for PR #142.

Working dir: /Users/andrewkelley/GitHub/mitsailing

Task:
- Review the final diff for scope control and repo-rule compliance.
- Verify PR blockers are addressed:
  - Storybook modal visibility failure.
  - Sourcery comments.
  - Sonar/Codacy likely actionable findings, or documented stale/remote-only
    state.
  - No regression in onboarding/admin sailing-card flow.
- Check changed UI against impeccable categories: clarity, accessibility/audit,
  and responsive/adapt.
- Check best practices against Context7 notes for any touched external
  libraries.

Run allowed verification commands from `AGENTS.md`:
- `npm run lint`
- `npm run check:types`
- `npm run test`
- `npm run test:e2e` only if user-flow changes were made or e2e coverage is
  needed.

Rules:
- Do not claim remote Sonar, Codacy, or CodeRabbit are clean until remote
  re-analysis completes.
- Do not broaden scope during verification.
- If a new issue appears, classify it as blocker, follow-up, or won't fix.

Output contract:
- Pass/fail per command.
- Files reviewed.
- Remaining risks.
- Remote checks needing rerun.
- Merge readiness recommendation.
- Confidence level.
```

## Conductor state template

Use this state shape and keep it short:

```markdown
Objective:
Active branch:

PR blockers:
- [ ] ...

Agent assignments:
- Agent 1:
- Agent 2:
- Agent 3:
- Agent 4A:
- Agent 4B:
- Agent 5:
- Agent 6:

Compressed results:
- Agent 1:
- Agent 2:
- Agent 3:
- Agent 4A:
- Agent 4B:
- Agent 5:
- Agent 6:

Product judgment queue:
- ...

Files changed:
- ...

Verification:
- ...

User decisions:
- ...
```

## Definition of done

The conductor may call the work complete only when:

- All confirmed PR blockers are fixed or explicitly classified as stale/noisy
  with evidence.
- Targeted tests for changed behavior pass.
- `npm run lint`, `npm run check:types`, and `npm run test` pass, or failures
  are documented as pre-existing and unrelated with evidence.
- Storybook failure is fixed locally or the exact remote-only blocker is
  documented.
- Legacy parity findings are either not PR blockers or are drafted as follow-up
  GitHub issues.
- Impeccable persona findings are classified as PR blockers or follow-ups.
- Remote CI/Sonar/Codacy/CodeRabbit state is described accurately.
