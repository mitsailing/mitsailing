# First PR Agent Playbook

Use this when a student, sailor, or volunteer asks for help making a small MIT
Sailing pull request.

Public entry points:

- `https://mitsailing.com/ai`
- `https://mitsailing.com/llm.txt`

## Goal

Get one focused change from idea to PR while the contributor reviews the app
locally before anything is pushed.

## Start

1. Use the repo `https://github.com/mitsailing/mitsailing`.
2. Clone it if needed.
3. Read `AGENTS.md` before editing.
4. Read `README.md` only if you need human-facing project context.
5. Create `.env` from `.env.example` if `.env` does not exist.
6. Install dependencies if needed.
7. If the contributor cannot push to `mitsailing/mitsailing`, fork the repo and
   push the branch to the fork.
8. Create a short branch with the right prefix.
9. Start the app locally.
10. Tell the contributor the localhost URL and exact page to check.

## Edit Loop

- Make only the requested change.
- Keep the app running so the contributor can view it locally.
- Show the diff and the local page or route to inspect.
- Wait for feedback.
- Accept multiple edit rounds.
- Do not commit, push, or open a PR until the contributor says `ready for PR`.

## Ready For PR

When the contributor says `ready for PR`:

1. Run `npm run test`.
2. Run `npm run lint`.
3. Run `npm run check:types`.
4. Stage only the intended files.
5. Commit with a short conventional commit message.
6. Push the branch to `mitsailing/mitsailing`, or to the contributor's fork if
   they do not have repo write access.
7. Open a PR to `main` for Andrew Kelley to review.

The PR description should include what changed, how it was tested, and
screenshots for visible UI changes.

## Guardrails

- Keep the PR small: one page, copy edit, bug, UI fix, or focused feature.
- Follow existing patterns.
- Do not refactor unrelated code.
- Do not commit secrets, production data, generated noise, or files the
  contributor does not understand.
- If setup fails, explain the failing command and fix the local setup before
  editing app code.
