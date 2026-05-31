# Ownership History Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the public `main` history so it starts at the MIT Sailing adoption point, mark the app package as proprietary, and keep only the minimum retained upstream MIT notice.

**Architecture:** Create a new root baseline commit from the tree at `764eb73e`, replay Andrew-authored commits after that point, then apply one ownership cleanup commit. Keep the root app unlicensed/proprietary while preserving the upstream MIT notice in `THIRD_PARTY_NOTICES.md` for retained fork-derived code.

**Tech Stack:** Git history rewrite, GitHub CLI, npm package metadata, Markdown notices.

---

## File Structure

- Delete: `LICENSE`
  - Removes the root MIT license from the proprietary app.
- Create: `THIRD_PARTY_NOTICES.md`
  - Holds the retained upstream MIT notice only.
- Modify: `package.json`
  - Changes root package metadata from `"MIT"` to `"UNLICENSED"`.
- Modify: `package-lock.json`
  - Mirrors the root package license metadata change.
- No source code changes are planned.

## Decisions Locked In

- The new visible history starts from the tree at commit `764eb73e4c13a2b97081bff2d812c4e07f3c151d`.
- Commits after `764eb73e` are replayed on top of the new baseline to preserve Andrew-authored project history.
- The retained upstream notice is separate from the app license and uses the shortest practical wrapper around the upstream MIT text.
- No old upstream tags are preserved on the rewritten public branch.

### Task 1: Preflight and Backup

**Files:**
- No file edits.

- [ ] **Step 1: Confirm the expected repository and branch**

Run:

```bash
pwd
git remote -v
git branch --show-current
git status --short
git rev-parse HEAD
git rev-parse 764eb73e4c13a2b97081bff2d812c4e07f3c151d
gh repo view mitsailing/mitsailing --json isPrivate,visibility,forkCount,nameWithOwner,url
```

Expected:

```text
/Users/andrewkelley/GitHub/mitsailing
origin	https://github.com/mitsailing/mitsailing.git (fetch)
origin	https://github.com/mitsailing/mitsailing.git (push)
main
764eb73e4c13a2b97081bff2d812c4e07f3c151d
```

`git status --short` may show unrelated untracked local notes or plans. Do not include unrelated files in the rewrite cleanup commit.

- [ ] **Step 2: Create local backup refs**

Run:

```bash
git branch backup/pre-ownership-cleanup-2026-05-28 main
git tag backup/pre-ownership-cleanup-2026-05-28 main
git show --stat --oneline backup/pre-ownership-cleanup-2026-05-28 -1
```

Expected:

```text
dd436d6a feat: add annual sailing-card onboarding (#113)
```

- [ ] **Step 3: Capture the old PR state**

Run:

```bash
gh pr view 110 --json number,title,state,headRefName,baseRefName,files,url
```

Expected:

```text
PR 110 is open, deletes LICENSE only, and does not update package metadata.
```

Close or supersede PR #110 after the cleanup branch exists; do not merge it as-is.

### Task 2: Build the Rewritten Branch

**Files:**
- No file edits.

- [ ] **Step 1: Create the new root branch from the adoption tree**

Run:

```bash
git switch --orphan ownership-history-cleanup 764eb73e4c13a2b97081bff2d812c4e07f3c151d
git add -A
git commit --author="Andrew Kelley <ACPK@users.noreply.github.com>" -m "chore: establish MIT Sailing application baseline"
git log --oneline --max-count=3
```

Expected:

```text
The most recent log line ends with: chore: establish MIT Sailing application baseline
```

The new commit has no parent and contains the project tree as it existed at `764eb73e`.

- [ ] **Step 2: Replay Andrew-era commits after the baseline**

Run:

```bash
git cherry-pick 764eb73e4c13a2b97081bff2d812c4e07f3c151d..backup/pre-ownership-cleanup-2026-05-28
```

Expected:

```text
The command completes without conflicts.
```

If a conflict occurs, resolve only the conflicted files, run `git status --short`, then continue:

```bash
git add --all
git cherry-pick --continue
```

Do not use `git cherry-pick --abort` unless the conflict resolution is clearly wrong and the branch must be rebuilt from Task 2 Step 1.

- [ ] **Step 3: Verify old upstream history is not reachable from the rewritten branch**

Run:

```bash
git merge-base --is-ancestor b8e1c40e8a85941b685a32bd78ed7bba6b2a49de HEAD; echo $?
git log --reverse --format='%h %an %s' | head -5
git log --format='%an' | sort | uniq -c
```

Expected:

```text
1
The first log line is authored by Andrew Kelley and ends with: chore: establish MIT Sailing application baseline
```

The author list may include bot authors from replayed commits if Andrew merged or generated them after adoption, but it should not show the long pre-adoption upstream history as reachable ancestors.

### Task 3: Apply Proprietary Metadata and Minimal Upstream Notice

**Files:**
- Delete: `LICENSE`
- Create: `THIRD_PARTY_NOTICES.md`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Delete the root MIT license**

Run:

```bash
rm LICENSE
git status --short LICENSE
```

Expected:

```text
 D LICENSE
```

- [ ] **Step 2: Change root package metadata to unlicensed**

Edit `package.json`:

```diff
-  "license": "MIT",
+  "license": "UNLICENSED",
```

Edit `package-lock.json` in the root package block:

```diff
-      "license": "MIT",
+      "license": "UNLICENSED",
```

Then run:

```bash
node -e 'const fs = require("node:fs"); for (const file of ["package.json", "package-lock.json"]) JSON.parse(fs.readFileSync(file, "utf8")); console.log("package metadata parses")'
```

Expected:

```text
package metadata parses
```

- [ ] **Step 3: Add the minimal retained upstream notice**

Create `THIRD_PARTY_NOTICES.md` with exactly:

```markdown
# Third-party notices

Portions derived from upstream MIT-licensed boilerplate:

MIT License

Copyright (c) 2026 Remi W.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Verify license search results**

Run:

```bash
rg -n '"license": "MIT"|MIT License|Copyright \(c\) 2026 Remi W\.|UNLICENSED|Third-party notices' LICENSE package.json package-lock.json THIRD_PARTY_NOTICES.md
```

Expected:

```text
package.json has one match for "license": "UNLICENSED".
package-lock.json has one root-package match for "license": "UNLICENSED".
THIRD_PARTY_NOTICES.md:1:# Third-party notices
THIRD_PARTY_NOTICES.md has one match for MIT License.
THIRD_PARTY_NOTICES.md has one match for Copyright (c) 2026 Remi W.
```

`LICENSE` should be reported as missing or should not produce matches because it has been deleted.

- [ ] **Step 5: Commit the ownership cleanup**

Run:

```bash
git add package.json package-lock.json THIRD_PARTY_NOTICES.md
git add -u LICENSE
git commit -m "chore: mark app proprietary and retain upstream notice"
```

Expected:

```text
The commit succeeds with message: chore: mark app proprietary and retain upstream notice
```

### Task 4: Verification

**Files:**
- No file edits.

- [ ] **Step 1: Run fast static checks**

Run:

```bash
npm run lint
npm run check:types
```

Expected:

```text
Both commands exit 0.
```

- [ ] **Step 2: Verify rewritten ancestry shape**

Run:

```bash
git rev-list --count HEAD
git log --reverse --format='%h %an %s' | head -5
git log --format='%h %an %s' -- LICENSE
git merge-base --is-ancestor c128d562e439cf39bd8bcaa2a15f9dc2017fb9ac HEAD; echo $?
```

Expected:

```text
The commit count is much smaller than the old 1700+ commit history.
The first commit is Andrew Kelley chore: establish MIT Sailing application baseline.
The LICENSE log shows no reachable retained root MIT license history after the delete commit.
The final echo prints 1.
```

- [ ] **Step 3: Compare final tree to original main except intended ownership files**

Run:

```bash
git diff --name-status backup/pre-ownership-cleanup-2026-05-28..HEAD
```

Expected:

```text
D	LICENSE
M	package-lock.json
M	package.json
A	THIRD_PARTY_NOTICES.md
```

No source files should differ from the original `main` tree.

### Task 5: Publish the Rewritten Main

**Files:**
- No file edits.

- [ ] **Step 1: Confirm before force-push**

Run:

```bash
git status --short
git branch --show-current
git log --oneline --max-count=5
gh repo view mitsailing/mitsailing --json visibility,forkCount,nameWithOwner,url
```

Expected:

```text
ownership-history-cleanup
forkCount is 0
```

Get explicit user approval before the next step. The next step rewrites `origin/main`.

- [ ] **Step 2: Force-push with lease**

Run:

```bash
git push --force-with-lease origin ownership-history-cleanup:main
```

Expected:

```text
main is updated on origin with the rewritten history.
```

- [ ] **Step 3: Sync local `main` to rewritten origin**

Run:

```bash
git switch main
git fetch origin
git reset --hard origin/main
git log --reverse --format='%h %an %s' | head -5
```

Expected:

```text
The first commit is Andrew Kelley chore: establish MIT Sailing application baseline.
```

- [ ] **Step 4: Close superseded PR #110**

Run:

```bash
gh pr close 110 --comment "Superseded by the ownership history cleanup: root LICENSE removed, package metadata changed to UNLICENSED, and retained upstream notice moved to THIRD_PARTY_NOTICES.md."
```

Expected:

```text
PR #110 is closed.
```

### Task 6: GitHub Cleanup Checks

**Files:**
- No file edits.

- [ ] **Step 1: Inspect public branch metadata**

Run:

```bash
gh repo view mitsailing/mitsailing --json defaultBranchRef,isPrivate,visibility,forkCount
gh api repos/mitsailing/mitsailing/branches/main --jq '.commit.sha'
```

Expected:

```text
defaultBranchRef.name is main.
visibility is the intended current setting.
forkCount is 0.
The branch SHA matches local HEAD.
```

- [ ] **Step 2: Inspect tags before deciding whether to delete old upstream tags**

Run:

```bash
git ls-remote --tags origin | sed -n '1,80p'
```

Expected:

```text
Review tags manually.
```

If old upstream tags are present on GitHub and the goal is to remove public references to pre-adoption history, delete only those tags after approval:

```bash
git push origin --delete v5.1.12
```

Do not delete current MIT Sailing release tags without confirming which tags are app-owned.

## Self-Review

- Spec coverage: The plan covers history rewrite, proprietary package metadata, root license removal, minimum upstream notice, verification, force-push gating, and PR #110 cleanup.
- Placeholder scan: No `TBD`, `TODO`, or vague implementation steps remain.
- Type consistency: No code APIs are introduced; command names, branch names, and file paths are consistent across tasks.
