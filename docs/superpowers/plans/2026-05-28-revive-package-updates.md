# Revive Package Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the dependency and GitHub Actions updates from PR #92 forward onto current `origin/main`, preserving the proprietary package metadata already merged in #133.

**Architecture:** Treat current `origin/main` as authoritative, then replay the package/workflow update and the follow-up compatibility fixes from PR #92. Do not merge PR #15 separately; it carries the same dependency bump but lacks the sanitizer, cron, Oxlint, and Tailwind follow-ups from #92.

**Tech Stack:** Next.js 16, React 19, TypeScript, npm lockfile v3, GitHub Actions, Oxlint/Ultracite, Knip, Vitest, Playwright.

---

## Current Assessment

- Local `main` is one commit behind `origin/main`.
- `origin/main` commit `8a1bf6ba` changes package metadata only:
  - `package.json`: `"license": "MIT"` -> `"license": "UNLICENSED"`
  - `package-lock.json`: root license metadata follows the package license.
  - `LICENSE` was renamed to `THIRD_PARTY_NOTICES.md`.
- PR #15 and PR #92 both contain the same dependency and workflow update set.
- PR #92 supersedes PR #15 because it also includes required follow-up fixes:
  - `cmsRichText` and site alert sanitizer coverage for `sanitize-html`.
  - BullMQ-compatible cron validation after `cron-parser` v5.
  - Tailwind 4.3 `scrollbar-gutter-stable` utility updates.
  - Oxlint config migration for ESM config loading.
- PR #92 is draft and merge-dirty because current `main` changed package metadata and config files after the PR branch was created.

## File Structure

- Modify: `package.json` - Dependency versions, `"type": "module"`, and keep `"license": "UNLICENSED"`.
- Modify: `package-lock.json` - Lockfile for the revived dependency set, with root license metadata still `UNLICENSED`.
- Modify: `.github/workflows/CI.yml` - Keep current `main` workflow structure and apply the artifact action update from #92.
- Modify: `.github/workflows/deploy.yml` - Apply Docker Buildx action update from #92.
- Modify: `.github/workflows/docker-pr.yml` - Apply Docker Buildx action update from #92.
- Modify: `.github/workflows/preview.yml` - Apply Docker Buildx action update from #92.
- Delete: `.oxlintrc.json` - Replaced by `oxlint.config.ts`.
- Create: `oxlint.config.ts` - TypeScript Oxlint config compatible with package ESM.
- Modify: `knip.config.ts` - Combine current `main` ignores with #92's Knip v6 `ignoreIssues`.
- Modify: `src/libs/mit-sailing/cmsRichText.ts` - Sanitizer behavior compatible with updated `sanitize-html`.
- Modify: `src/libs/mit-sailing/cmsRichText.test.ts` - Regression coverage for raw-text sanitizer behavior.
- Modify: `src/libs/mit-sailing/sanitizeSiteAlertHtml.test.ts` - Regression coverage for site alert sanitizer behavior.
- Modify: `src/libs/legacy-sync/legacyMysqlSyncConstants.ts` - Cron validation compatible with BullMQ nested `cron-parser` v4 while top-level `cron-parser` is v5.
- Modify: `src/libs/legacy-sync/legacyMysqlSyncConstants.test.ts` - Regression coverage for unsupported hashed cron syntax.
- Modify: `src/components/auth/profile/ProfileSideNav.tsx` - Tailwind 4.3 scrollbar utility rename.
- Modify: `src/components/mit-sailing/admin/AdminSideNav.tsx` - Tailwind 4.3 scrollbar utility rename.
- Modify: `src/components/mit-sailing/admin/catalog/AdminCmsMediaControls.tsx` - Tailwind 4.3 scrollbar utility rename.
- Modify: `src/components/mit-sailing/contact/ContactFormDialog.tsx` - Tailwind 4.3 scrollbar utility rename.
- Modify: `src/components/mit-sailing/pavilion-reservations/PavilionReservationWizard.tsx` - Tailwind 4.3 scrollbar utility rename.
- Modify: `src/components/mit-sailing/site/SiteHeader.tsx` - Tailwind 4.3 scrollbar utility rename.

### Task 1: Sync Local Main To Current Origin

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create/rename already on origin: `THIRD_PARTY_NOTICES.md`

- [ ] **Step 1: Confirm worktree state**

```bash
git status --short --branch
```

Expected: `main...origin/main [behind 1]` is acceptable. Existing untracked plan files under `docs/superpowers/plans/` are acceptable. There must be no modified tracked files before pulling.

- [ ] **Step 2: Fast-forward local main**

```bash
git switch main
git pull --ff-only origin main
```

Expected: local `main` advances to `8a1bf6ba chore: mark app proprietary and retain upstream notice (#133)`.

- [ ] **Step 3: Verify main has no dependency-version changes left to pull**

```bash
git diff --unified=0 HEAD~1..HEAD -- package.json
```

Expected output contains only:

```diff
-  "license": "MIT",
+  "license": "UNLICENSED",
```

- [ ] **Step 4: Verify local main matches origin main**

```bash
git status --short --branch
git diff --name-status HEAD..origin/main -- package.json package-lock.json
```

Expected: branch status no longer says `behind 1`, and the package-file diff command prints no file names.

### Task 2: Create A Fresh Package Update Branch

**Files:**
- No file edits in this task.

- [ ] **Step 1: Create the branch from current origin main**

```bash
git switch -c feature/revive-package-updates origin/main
```

Expected: Git reports `Switched to a new branch 'feature/revive-package-updates'`.

- [ ] **Step 2: Verify PR #92 and PR #15 package deltas are equivalent**

```bash
git diff --unified=0 origin/main...origin/pr/92 -- package.json > /tmp/pr92-package.diff
git diff --unified=0 origin/main...origin/pr/15 -- package.json > /tmp/pr15-package.diff
diff -u /tmp/pr15-package.diff /tmp/pr92-package.diff
```

Expected: the only meaningful difference is that PR #92 adds:

```diff
+  "type": "module",
```

Interpretation: use #92, because it includes #15's dependency bump plus the ESM/Oxlint follow-up.

### Task 3: Replay Package And Workflow Updates

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/workflows/CI.yml`
- Modify: `.github/workflows/deploy.yml`
- Modify: `.github/workflows/docker-pr.yml`
- Modify: `.github/workflows/preview.yml`

- [ ] **Step 1: Restore the package and workflow files from PR #92**

```bash
git restore --source=origin/pr/92 -- \
  package.json \
  package-lock.json \
  .github/workflows/CI.yml \
  .github/workflows/deploy.yml \
  .github/workflows/docker-pr.yml \
  .github/workflows/preview.yml
```

Expected: the six files are modified in the worktree.

- [ ] **Step 2: Preserve the current proprietary package license**

Edit `package.json` so the top metadata block is:

```json
{
  "name": "mitsailing",
  "version": "0.0.0",
  "private": true,
  "description": "MIT Sailing — pavilion and programs on the Charles (https://mitsailing.com).",
  "homepage": "https://mitsailing.com",
  "bugs": {
    "url": "https://github.com/mitsailing/mitsailing/issues"
  },
  "license": "UNLICENSED",
  "author": "MIT Sailing (https://mitsailing.com)",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/mitsailing/mitsailing.git"
  },
  "type": "module",
```

Edit `package-lock.json` root package metadata so it also has:

```json
"license": "UNLICENSED",
```

- [ ] **Step 3: Verify package dependency changes match PR #92**

```bash
git diff --unified=0 origin/main -- package.json
```

Expected: dependency changes include these representative lines:

```diff
+  "type": "module",
-    "@better-auth/i18n": "^1.6.7",
+    "@better-auth/i18n": "^1.6.11",
-    "cron-parser": "4.9.0",
+    "cron-parser": "5.5.0",
-    "tailwindcss": "^4.2.2",
+    "tailwindcss": "^4.3.0",
-    "oxlint": "1.56.0",
+    "oxlint": "1.65.0",
```

Expected: the diff must not change `"license": "UNLICENSED"` back to `"MIT"`.

- [ ] **Step 4: Verify workflow action changes**

```bash
git diff --unified=0 origin/main -- .github/workflows/CI.yml .github/workflows/deploy.yml .github/workflows/docker-pr.yml .github/workflows/preview.yml
```

Expected: updates include:

```diff
-        uses: actions/download-artifact@v7
+        uses: actions/download-artifact@v8
-        uses: docker/setup-buildx-action@v3
+        uses: docker/setup-buildx-action@v4
```

- [ ] **Step 5: Run dependency graph check**

```bash
npm run check:deps
```

Expected at this point: it may fail because Oxlint and Knip follow-up files have not been replayed yet. Continue to Task 4 if the failures reference `knip.config.ts`, `.oxlintrc.json`, or package/config usage from the updated toolchain.

### Task 4: Replay Oxlint And Knip Follow-Ups

**Files:**
- Delete: `.oxlintrc.json`
- Create: `oxlint.config.ts`
- Modify: `knip.config.ts`

- [ ] **Step 1: Restore the Oxlint TypeScript config from PR #92 and remove the JSON config**

```bash
git restore --source=origin/pr/92 -- oxlint.config.ts
git rm .oxlintrc.json
```

Expected: `.oxlintrc.json` is staged for deletion, and `oxlint.config.ts` exists.

- [ ] **Step 2: Preserve ZenStack ignored generated files in Oxlint config**

Edit `oxlint.config.ts` so `ignorePatterns` includes both the old static folders and the generated ZenStack files:

```ts
ignorePatterns: [
  'mit-redesign/**',
  'donation-figma/**',
  'zenstack/input.ts',
  'zenstack/models.ts',
  'zenstack/schema.ts',
],
```

- [ ] **Step 3: Combine current main and PR #92 Knip config**

Edit `knip.config.ts` so `ignore` keeps the ZenStack generated files from current `main`:

```ts
  ignore: [
    'checkly.config.ts',
    'src/libs/I18n.ts',
    // Used by next-intl request config above; Knip ignores that entrypoint.
    'src/libs/site-text/siteTextMessageLoader.ts',
    'src/types/I18n.ts',
    // Manual admin/developer utility for folding DB overrides back into en.json.
    'scripts/export-i18n-overrides.ts',
    // Manual one-off importer for owned legacy Pavilion reservation CSV history.
    'scripts/import-legacy-pavilion-reservations.ts',
    // Invoked by Docker Compose healthcheck + Dockerfile COPY; not a Node import graph entry
    'scripts/worker-redis-healthcheck.cjs',
    // Invoked by esbuild's `server-only` alias in `npm run build:worker`.
    'src/worker/serverOnlyShim.ts',
    // Catalog + time helpers: partially consumed by prisma seed; getters/types fill in when UI is ported
    'src/data/mit-sailing/**',
    'src/lib/mit-sailing/**',
    // Generated by ZenStack from zenstack/schema.zmodel; consumed by later migration tasks.
    'zenstack/input.ts',
    'zenstack/models.ts',
    'zenstack/schema.ts',
  ],
```

Edit `ignoreDependencies` so it keeps the current main entries and adds the PR #92 simplified list only where it does not remove needed ignores:

```ts
  ignoreDependencies: [
    '@commitlint/types',
    '@hookform/resolvers',
    '@swc/helpers', // Avoid error in CI: "`npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync."
    '@zenstackhq/cli',
    '@zenstackhq/server',
    'oxfmt',
    'oxlint-tsgolint',
    'postcss',
    'react-hook-form',
    'vite',
  ],
```

Edit `knip.config.ts` so it also includes PR #92's `ignoreIssues` block:

```ts
  ignoreIssues: {
    'src/components/mit-sailing/donate/DonateAlternateGivingSection.tsx': [
      'types',
    ],
    'src/components/mit-sailing/site/NavigationDropdown.tsx': ['types'],
    'src/libs/admin/catalog/scopedCatalogLists.ts': ['types'],
    'src/libs/admin/catalog/types.ts': ['types'],
    'src/libs/admin/events/eventAdminQueries.ts': ['types'],
    'src/libs/admin/pavilion-reservations/pavilionReservationAdminQueries.ts': [
      'types',
    ],
    'src/libs/health/readiness.ts': ['types'],
    'src/libs/legacy-sync/postgresMirrorSql.ts': ['types'],
    'src/libs/mit-sailing/catalogHistory.ts': ['types'],
    'src/libs/mit-sailing/classQueries.ts': ['types'],
    'src/libs/mit-sailing/classRelatedOccurrences.ts': ['types'],
    'src/libs/mit-sailing/cmsHistory.ts': ['types'],
    'src/libs/mit-sailing/cmsHomeOverview.ts': ['types'],
    'src/libs/mit-sailing/cmsMediaTypes.ts': ['exports'],
    'src/libs/mit-sailing/eventCalendar.ts': ['types'],
    'src/libs/mit-sailing/pavilionReservationBookingTimeline.ts': ['types'],
    'src/libs/newsletter/newsletterActions.ts': ['types'],
    'src/libs/newsletter/newsletterConstants.ts': ['exports'],
    'src/libs/newsletter/newsletterValidation.ts': ['types'],
  },
```

- [ ] **Step 4: Verify config files have no conflict markers**

```bash
rg '<<<<<<<|=======|>>>>>>>' knip.config.ts oxlint.config.ts package.json package-lock.json .github/workflows
```

Expected: no output.

- [ ] **Step 5: Run dependency graph check**

```bash
npm run check:deps
```

Expected: PASS.

### Task 5: Replay Runtime Compatibility Fixes

**Files:**
- Modify: `src/libs/mit-sailing/cmsRichText.ts`
- Modify: `src/libs/mit-sailing/cmsRichText.test.ts`
- Modify: `src/libs/mit-sailing/sanitizeSiteAlertHtml.test.ts`
- Modify: `src/libs/legacy-sync/legacyMysqlSyncConstants.ts`
- Modify: `src/libs/legacy-sync/legacyMysqlSyncConstants.test.ts`

- [ ] **Step 1: Restore sanitizer and cron compatibility files from PR #92**

```bash
git restore --source=origin/pr/92 -- \
  src/libs/mit-sailing/cmsRichText.ts \
  src/libs/mit-sailing/cmsRichText.test.ts \
  src/libs/mit-sailing/sanitizeSiteAlertHtml.test.ts \
  src/libs/legacy-sync/legacyMysqlSyncConstants.ts \
  src/libs/legacy-sync/legacyMysqlSyncConstants.test.ts
```

Expected: the five files are modified.

- [ ] **Step 2: Run sanitizer regression tests**

```bash
npm run test -- src/libs/mit-sailing/cmsRichText.test.ts src/libs/mit-sailing/sanitizeSiteAlertHtml.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run legacy sync cron regression tests**

```bash
npm run test -- src/libs/legacy-sync/legacyMysqlSyncConstants.test.ts
```

Expected: PASS.

### Task 6: Replay Tailwind Utility Follow-Ups

**Files:**
- Modify: `src/components/auth/profile/ProfileSideNav.tsx`
- Modify: `src/components/mit-sailing/admin/AdminSideNav.tsx`
- Modify: `src/components/mit-sailing/admin/catalog/AdminCmsMediaControls.tsx`
- Modify: `src/components/mit-sailing/contact/ContactFormDialog.tsx`
- Modify: `src/components/mit-sailing/pavilion-reservations/PavilionReservationWizard.tsx`
- Modify: `src/components/mit-sailing/site/SiteHeader.tsx`

- [ ] **Step 1: Restore Tailwind utility updates from PR #92**

```bash
git restore --source=origin/pr/92 -- \
  src/components/auth/profile/ProfileSideNav.tsx \
  src/components/mit-sailing/admin/AdminSideNav.tsx \
  src/components/mit-sailing/admin/catalog/AdminCmsMediaControls.tsx \
  src/components/mit-sailing/contact/ContactFormDialog.tsx \
  src/components/mit-sailing/pavilion-reservations/PavilionReservationWizard.tsx \
  src/components/mit-sailing/site/SiteHeader.tsx
```

Expected: the six files are modified.

- [ ] **Step 2: Verify old scrollbar utility is gone**

```bash
rg 'scrollbar-gutter' src/components/auth/profile/ProfileSideNav.tsx src/components/mit-sailing
```

Expected: only valid Tailwind 4.3 utility names from PR #92 appear. No stale utility spelling from before the package update remains.

- [ ] **Step 3: Run component tests touched by PR #92**

```bash
npm run test -- src/components/mit-sailing/site/SiteHeader.test.tsx src/components/auth/profile/ProfileSideNav.test.tsx src/components/mit-sailing/contact/ContactFormDialog.test.tsx src/components/mit-sailing/pavilion-reservations/PavilionReservationWizard.test.tsx src/components/mit-sailing/admin/catalog/AdminCatalogRichText.test.tsx
```

Expected: PASS.

### Task 7: Full Verification And Publish Decision

**Files:**
- No new file edits expected.

- [ ] **Step 1: Run static checks**

```bash
npm run check:i18n
npm run check:types
npm run lint
```

Expected: all three commands PASS.

- [ ] **Step 2: Run full unit/component suite**

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 3: Run local production build**

```bash
npm run build-local
```

Expected: PASS.

- [ ] **Step 4: Run E2E gate if the branch is intended to replace PR #92 immediately**

```bash
npm run test:e2e
```

Expected: PASS. If this fails, inspect the first failing Playwright trace and fix only failures caused by this package update branch.

- [ ] **Step 5: Review final diff**

```bash
git diff --stat origin/main
git diff --name-status origin/main
git diff --check
```

Expected:

```text
git diff --check
```

prints no whitespace errors. The name-status list should match the File Structure section, with no unrelated files.

- [ ] **Step 6: Commit**

```bash
git add \
  package.json \
  package-lock.json \
  .github/workflows/CI.yml \
  .github/workflows/deploy.yml \
  .github/workflows/docker-pr.yml \
  .github/workflows/preview.yml \
  .oxlintrc.json \
  oxlint.config.ts \
  knip.config.ts \
  src/libs/mit-sailing/cmsRichText.ts \
  src/libs/mit-sailing/cmsRichText.test.ts \
  src/libs/mit-sailing/sanitizeSiteAlertHtml.test.ts \
  src/libs/legacy-sync/legacyMysqlSyncConstants.ts \
  src/libs/legacy-sync/legacyMysqlSyncConstants.test.ts \
  src/components/auth/profile/ProfileSideNav.tsx \
  src/components/mit-sailing/admin/AdminSideNav.tsx \
  src/components/mit-sailing/admin/catalog/AdminCmsMediaControls.tsx \
  src/components/mit-sailing/contact/ContactFormDialog.tsx \
  src/components/mit-sailing/pavilion-reservations/PavilionReservationWizard.tsx \
  src/components/mit-sailing/site/SiteHeader.tsx
git commit -m "chore: update actions and npm dependencies"
```

Expected: one commit containing the revived #92 package update and compatibility fixes.

- [ ] **Step 7: Push and update PR strategy**

```bash
git push -u origin feature/revive-package-updates
```

Expected: branch pushes successfully.

Preferred PR handling:

```bash
gh pr create --draft --base main --head feature/revive-package-updates --title "chore: update packages and dependency followups" --body-file /tmp/revive-package-updates-pr-body.md
```

Use a PR body with this content:

```markdown
## Summary

- Update GitHub Actions and npm dependencies from current main.
- Preserve the proprietary package metadata from #133.
- Move Oxlint configuration to `oxlint.config.ts` and mark the package as ESM.
- Keep sanitizer and cron validation behavior compatible with updated dependencies.
- Adopt Tailwind 4.3 scrollbar gutter utilities.

## Validation

- `npm run check:deps`
- `npm run check:i18n`
- `npm run check:types`
- `npm run lint`
- `npm run test`
- `npm run build-local`
- `npm run test:e2e`

## Supersedes

- Supersedes #15.
- Replaces #92 with the same package update applied to current `main`.
```

Expected: create a fresh PR, then close #15 and #92 after the replacement PR exists and links back to them. If repository policy prefers reusing #92, force-push only after confirming with the maintainer because #92 is an existing draft branch.

## Self-Review

- Spec coverage: This plan answers the package question, syncs the one package metadata commit already on `origin/main`, and carries the actual dependency update forward from #92.
- Red-flag scan: No step relies on vague future work; each edit step names exact files and commands.
- Type consistency: The plan consistently uses `feature/revive-package-updates`, PR #92 as the source branch, and current `origin/main` as the base.
