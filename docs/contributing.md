# Contributing

Start with the README quick path. AI agents should follow
[the first PR playbook](ai/first-pr-agent.md); this page is reference material
for contributors who need more detail after their first AI-assisted PR.

## Branch Names

- `feature/<slug>` for new behavior;
- `fix/<slug>` for bugs;
- `docs/<slug>` for docs;
- `refactor/<slug>` for cleanup that should not change behavior;
- `issue-123/<slug>` when the work tracks an issue.

## Commit And Push

Ask AI to review the diff, stage only the intended files, commit with a short
conventional message, push the branch, and open the PR. If you cannot push to
`mitsailing/mitsailing`, ask AI to fork the repo and open the PR from your fork.

Commit types: `feat`, `fix`, `docs`, `refactor`, `test`, `ci`, `build`, or
`chore`.

## Pull Request

Ask AI to open a PR to `main` from your branch or fork.

In the PR description, include:

- what changed;
- how you tested it;
- screenshots for visible UI changes;
- the issue link, if there is one.

After AI opens the PR, wait for CI and review. If CodeRabbit is unavailable,
ask an AI agent to do a local code review before merge.

Merging to `main` deploys production through GitHub Actions. See
[deploy](deploy.md) for the production flow.
