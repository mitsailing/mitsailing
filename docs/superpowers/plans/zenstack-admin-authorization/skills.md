# Skill Policy

Use skills to load reusable workflows, not to inflate every worker prompt.

## Use These Installed Skills

- `writing-plans`: when changing the plan or task packets.
- `executing-plans`: if a worker executes a packet inline instead of through a
  spawned worker.
- `test-driven-development`: auth, policies, validation, server actions, and
  migration-sensitive logic.
- `next-best-practices`: Next.js App Router, RSC, route handlers, Server Actions,
  and cache/revalidation decisions.
- `shadcn`: shared UI components and shadcn conventions.
- `requesting-code-review`: before completing large or risky packets.
- `grill-me`: when a new architectural decision is exposed and the packet does
  not already settle it.

## Do Not Install Low-Signal Skills For This PR

Skill Finder searches for generic simplicity, maintainability, dependency
management, and ZenStack-specific skills returned mostly low-install community
skills. Do not add those to the worker baseline. Use
`.cursor/rules/package-first-simple.mdc` plus official docs/Context7 instead.

## Good Optional Installs

These are worth considering only if a future worker lacks the installed local
equivalent:

- `vercel-labs/next-skills@next-best-practices`: high-install official Next.js
  skill. Already available locally as `next-best-practices`.
- `obra/superpowers@executing-plans`, `writing-plans`, and
  `test-driven-development`: already available locally.
- `better-auth/skills@better-auth-best-practices`: promising for Better Auth,
  but still use official Better Auth docs and installed package types before
  changing auth behavior.

## Package Gate

Skills are not a substitute for package verification. Before custom infrastructure:

1. Review existing repo patterns.
2. Consult official docs or Context7 for the package-backed path.
3. Assess package health for new production dependencies.
4. Stop and ask before implementing custom infrastructure when a maintained
   package or existing local abstraction may be simpler.

