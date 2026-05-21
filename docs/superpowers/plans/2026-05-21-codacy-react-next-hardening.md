# Codacy React Next Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Codacy findings that are valid for a modern React/Next.js App Router project while avoiding broad analyzer noise.

**Architecture:** Keep the existing React/Next structure and fix issues at their narrowest owner. Security fixes preserve Tiptap rich text semantics and harden sanitizer boundaries before HTML reaches `dangerouslySetInnerHTML`; React fixes keep event handlers synchronous at the JSX boundary while satisfying the repo lint rules; accessibility fixes prefer native HTML semantics over ARIA roles.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library, sanitize-html, Tailwind v4.

---

## File Structure

- `package.json`, `package-lock.json`: upgrade `sanitize-html` once a patched version is available through npm.
- `src/libs/mit-sailing/cmsRichText.ts`: block raw-text tags such as `xmp` in CMS rich-text sanitization while preserving Tiptap output for paragraphs, headings, lists, links, emphasis, line breaks, and allowed CMS images.
- `src/libs/mit-sailing/cmsRichText.test.ts`: prove `xmp` payloads do not survive sanitization and Tiptap-supported rich text still renders correctly.
- `src/libs/mit-sailing/sanitizeSiteAlertHtml.ts`: block raw-text tags such as `xmp` in alert body sanitization.
- `src/libs/mit-sailing/sanitizeSiteAlertHtml.test.ts`: prove alert sanitizer strips `xmp` payloads.
- `src/components/mit-sailing/about/AboutPageView.tsx`: validate dynamic CTA `href` values that can originate from CMS/config data.
- `src/components/mit-sailing/admin/catalog/AdminCatalogListCell.tsx`: validate external/catalog URL rendering and use app `Link` for safe internal paths.
- `src/app/[locale]/(auth)/(center)/login/SignInForm.tsx`, `src/app/[locale]/(auth)/(center)/reset-password/ResetPasswordForm.tsx`, `src/components/mit-sailing/admin/catalog/AdminCmsMediaControls.tsx`: convert async JSX handlers to synchronous wrappers that explicitly discard/catch promises.
- `src/components/mit-sailing/site/SiteAlertsBanner.tsx`, `src/app/[locale]/(auth)/(center)/verify-email/VerifyEmailForm.tsx`, `src/app/[locale]/(auth)/(center)/reset-password/ResetPasswordForm.tsx`: fix valid effect dependency findings without adding memoization.
- `src/components/auth/ImpersonationBanner.tsx`, `src/components/auth/profile/ProfileSideNav.tsx`, `src/components/mit-sailing/admin/AdminSideNav.tsx`, `src/components/mit-sailing/alerts/SiteAlertsListView.tsx`, `src/components/mit-sailing/site/FooterSocialStrip.tsx`, `src/components/mit-sailing/site/SiteAlertsBanner.tsx`, `src/components/mit-sailing/events/EventsListView.tsx`: remove redundant/incorrect ARIA and use semantic elements where valid.
- `src/components/mit-sailing/admin/events/AdminEventsListView.tsx`, `src/app/[locale]/(marketing)/(site)/admin/pavilion-reservations/page.tsx`, `src/app/[locale]/(marketing)/(site)/admin/pavilion-reservations/[id]/page.tsx`: associate labels with controls using explicit `id`/`htmlFor` or replace visual labels with non-label wrappers.

## Scope Decisions

- Fix valid React/Next findings: unsafe sanitized HTML boundary, dynamic `href` safety where data is not literal, async JSX event handlers, React effect dependency drift, and invalid JSX accessibility semantics.
- Preserve rich text editor display requirements. Tiptap is the editor (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`). Its official docs show HTML output for paragraphs, unordered/ordered lists, links, and images. Sanitization must keep the repo's supported subset instead of converting editor output to plain text or removing valid lists/links.
- Do not fix generic Codacy noise in this pass: hard-coded passwords in test fixtures, HTML strings in tests, dependency range warnings for all packages, GitHub Actions SHA pinning, Docker `USER`, and timing-attack warnings for client-side password-confirmation equality. Those are not React/Next correctness findings.
- Do not fix nested render-helper findings unless the code defines a PascalCase component inside another component and renders it as `<NestedComponent />`. Render helper functions that return JSX but are called as ordinary functions do not trigger React state reset.
- Treat `sanitize-html@2.17.3` CVE-2026-44990 as valid. If npm does not yet publish a patched version during execution, keep the dependency unchanged and harden `nonTextTags` locally; report the blocked package upgrade.

### Task 1: Harden HTML Sanitizers

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/libs/mit-sailing/cmsRichText.ts`
- Modify: `src/libs/mit-sailing/cmsRichText.test.ts`
- Modify: `src/libs/mit-sailing/sanitizeSiteAlertHtml.ts`
- Modify: `src/libs/mit-sailing/sanitizeSiteAlertHtml.test.ts`

- [ ] **Step 1: Write failing sanitizer tests**

Add to `src/libs/mit-sailing/cmsRichText.test.ts` inside `describe('sanitizeCmsRichTextHtml', ...)`:

```ts
  it('keeps the supported Tiptap rich text subset', () => {
    expect(
      sanitizeCmsRichTextHtml(
        '<h2>Race notes</h2><p><strong>Bring</strong> layers<br>and water.</p><ul><li>Rig boats</li><li>Check weather</li></ul><ol><li>Launch</li></ol><p><a href="/classes">Class info</a> <a href="https://example.com">External</a></p>'
      )
    ).toBe(
      '<h2>Race notes</h2><p><strong>Bring</strong> layers<br />and water.</p><ul><li>Rig boats</li><li>Check weather</li></ul><ol><li>Launch</li></ol><p><a href="/classes">Class info</a> <a href="https://example.com" rel="noopener noreferrer" target="_blank">External</a></p>'
    );
  });

  it('strips raw-text xmp payloads before React rendering', () => {
    expect(
      sanitizeCmsRichTextHtml('<xmp><img src=x onerror=alert(1)></xmp>')
    ).toBe('');
  });
```

Add to `src/libs/mit-sailing/sanitizeSiteAlertHtml.test.ts` inside `describe('sanitizeSiteAlertBodyHtml', ...)`:

```ts
  it('keeps alert links and line breaks while stripping unsupported rich markup', () => {
    expect(
      sanitizeSiteAlertBodyHtml(
        '<strong>Notice</strong><br><a href="/alerts">Read alerts</a>'
      )
    ).toBe('<br /><a href="/alerts">Read alerts</a>');
  });

  it('strips raw-text xmp payloads before React rendering', () => {
    expect(
      sanitizeSiteAlertBodyHtml('<xmp><img src=x onerror=alert(1)></xmp>')
    ).toBe('');
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- src/libs/mit-sailing/cmsRichText.test.ts src/libs/mit-sailing/sanitizeSiteAlertHtml.test.ts
```

Expected: the rich text preservation tests pass, and both new `xmp` tests fail because `sanitize-html@2.17.3` lets the inner `<img onerror>` text pass through.

- [ ] **Step 3: Harden sanitizer options**

In `src/libs/mit-sailing/cmsRichText.ts`, add `xmp` to `nonTextTags`. Do not remove `a`, `br`, `em`, `h2`, `h3`, `h4`, `img`, `li`, `ol`, `p`, `strong`, or `ul` from `allowedTags`; those map to the supported Tiptap editor output.

```ts
  nonTextTags: ['script', 'style', 'textarea', 'option', 'xmp'],
```

In `src/libs/mit-sailing/sanitizeSiteAlertHtml.ts`, add the same explicit option:

```ts
  nonTextTags: ['script', 'style', 'textarea', 'option', 'xmp'],
```

- [ ] **Step 4: Upgrade sanitizer dependency if npm has a patched release**

Run:

```bash
npm install sanitize-html@^2.17.4
```

Expected: `package.json` and `package-lock.json` update if `2.17.4` or newer is published. If npm reports no matching version, keep only the local `xmp` hardening and document the package-upgrade blocker in the final handoff.

- [ ] **Step 5: Run focused sanitizer tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/cmsRichText.test.ts src/libs/mit-sailing/sanitizeSiteAlertHtml.test.ts
```

Expected: PASS.

### Task 2: Validate Dynamic React Hrefs

**Files:**
- Modify: `src/components/mit-sailing/about/AboutPageView.tsx`
- Modify: `src/components/mit-sailing/admin/catalog/AdminCatalogListCell.tsx`
- Create: `src/components/mit-sailing/admin/catalog/AdminCatalogListCell.test.tsx`

- [ ] **Step 1: Add failing tests for unsafe hrefs**

Create `src/components/mit-sailing/admin/catalog/AdminCatalogListCell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminCatalogListCell } from './AdminCatalogListCell';

describe('AdminCatalogListCell', () => {
  it('renders safe url values as links', () => {
    render(
      <AdminCatalogListCell
        field="url"
        kind="url"
        row={{ id: '1', url: 'https://example.com/member' }}
      />
    );

    expect(
      screen.getByRole('link', { name: 'https://example.com/member' })
    ).toHaveAttribute('href', 'https://example.com/member');
  });

  it('renders internal url values with app links', () => {
    render(
      <AdminCatalogListCell
        field="url"
        kind="url"
        row={{ id: '1', url: '/classes' }}
      />
    );

    expect(screen.getByRole('link', { name: '/classes' })).toHaveAttribute(
      'href',
      '/classes'
    );
  });

  it('renders unsafe url values as plain text', () => {
    const unsafeHref = ['java', 'script:alert(1)'].join('');

    render(
      <AdminCatalogListCell
        field="url"
        kind="url"
        row={{ id: '1', url: unsafeHref }}
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(unsafeHref)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run focused tests to verify failure**

Run:

```bash
npm run test -- src/components/mit-sailing/admin/catalog/AdminCatalogListCell.test.tsx
```

Expected: unsafe URL test fails where unsafe `href` values currently pass through.

- [ ] **Step 3: Implement a small local URL guard or reuse an existing one**

Use `safeCmsHref`, `isAppRelativeCmsHref`, and `externalCmsLinkProps` from `@/libs/mit-sailing/cmsHref`. For internal paths, render the project `Link`. For external links, render `<a>` with `externalCmsLinkProps`. Render unsafe values as plain text or omit the CTA.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test -- src/components/mit-sailing/admin/catalog/AdminCatalogListCell.test.tsx
```

Expected: PASS.

### Task 3: Fix Async JSX Event Handlers and Hook Dependencies

**Files:**
- Modify: `src/app/[locale]/(auth)/(center)/login/SignInForm.tsx`
- Modify: `src/app/[locale]/(auth)/(center)/reset-password/ResetPasswordForm.tsx`
- Modify: `src/app/[locale]/(auth)/(center)/verify-email/VerifyEmailForm.tsx`
- Modify: `src/components/mit-sailing/admin/catalog/AdminCmsMediaControls.tsx`
- Modify: `src/components/mit-sailing/site/SiteAlertsBanner.tsx`

- [ ] **Step 1: Inspect existing tests and behavior**

Run existing focused tests for these components before changing code:

```bash
npm run test -- src/app/[locale]/(auth)/(center)/login src/app/[locale]/(auth)/(center)/reset-password src/app/[locale]/(auth)/(center)/verify-email src/components/mit-sailing/site/SiteAlertsBanner
```

Expected: current tests pass or reveal unrelated existing failures to record before editing.

- [ ] **Step 2: Convert async JSX props to sync wrappers**

For every JSX prop like `onSubmit={onSubmit}` where `onSubmit` returns a promise, keep the async logic in a named helper and attach a sync wrapper. Use the local lint-accepted pattern:

```tsx
<form
  className="flex flex-col gap-4"
  onSubmit={(event) => {
    // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the form promise.
    void onSubmit(event);
  }}
>
```

For inline async `onChange`, wrap the async call:

```tsx
onChange={(event) => {
  // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the picker promise.
  void handleSelectedFileChange(event);
}}
```

If the async body has no named function, extract one in the same component file.

- [ ] **Step 3: Fix effect dependencies without memoization**

For effects that use an internal helper only to update timer state, either move the helper inside the effect or use the state setter directly. Do not add `useCallback` unless the effect synchronizes with an external subscription and needs stable identity.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test -- src/app/[locale]/(auth)/(center)/login src/app/[locale]/(auth)/(center)/reset-password src/app/[locale]/(auth)/(center)/verify-email src/components/mit-sailing/site/SiteAlertsBanner
```

Expected: PASS.

### Task 4: Fix Valid JSX Accessibility Findings

**Files:**
- Modify: `src/components/auth/ImpersonationBanner.tsx`
- Modify: `src/components/auth/profile/ProfileSideNav.tsx`
- Modify: `src/components/mit-sailing/admin/AdminSideNav.tsx`
- Modify: `src/components/mit-sailing/alerts/SiteAlertsListView.tsx`
- Modify: `src/components/mit-sailing/site/FooterSocialStrip.tsx`
- Modify: `src/components/mit-sailing/site/SiteAlertsBanner.tsx`
- Modify: `src/components/mit-sailing/events/EventsListView.tsx`
- Modify: `src/components/mit-sailing/admin/events/AdminEventsListView.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/pavilion-reservations/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/pavilion-reservations/[id]/page.tsx`

- [ ] **Step 1: Write or update accessibility tests where behavior is user-visible**

For form labels, add tests that find controls by label:

```tsx
expect(screen.getByLabelText(/search/i)).toBeInTheDocument();
```

For landmark or list changes, rely on snapshots only if existing tests already cover the component; otherwise prefer role queries:

```tsx
expect(screen.getByRole('list')).toBeInTheDocument();
```

- [ ] **Step 2: Run tests to verify failures where labels are broken**

Run:

```bash
npm run test -- src/components/auth/ImpersonationBanner.test.tsx src/components/auth/profile/ProfileSideNav.test.tsx src/components/mit-sailing/site/SiteAlertsBanner.test.tsx
```

Expected: existing tests pass before semantic-only cleanup; add a new test only when a user-visible role or label is otherwise untested.

- [ ] **Step 3: Apply semantic fixes**

Use these narrow transformations:

```tsx
// Redundant role on a real list
<ul className="...">

// Region role on a section
<section aria-label={...} className="...">

// Label wrapping non-label content
<div className="...">
  <span className="...">{labelText}</span>
  <input id={id} aria-label={labelText} ... />
</div>

// Group role with controls
<fieldset className="...">
  <legend className="sr-only">{legendText}</legend>
  ...
</fieldset>
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test -- src/components/auth/ImpersonationBanner.test.tsx src/components/auth/profile/ProfileSideNav.test.tsx src/components/mit-sailing/site/SiteAlertsBanner.test.tsx
```

Expected: PASS.

### Task 5: Verification and Codacy Recheck

**Files:**
- No planned source edits.

- [ ] **Step 1: Run required local gates**

Run:

```bash
npm run lint
npm run check:types
npm run test
```

Expected: PASS.

- [ ] **Step 2: Re-query Codacy MCP for fixed categories**

Use Codacy MCP on branch `feature/stripe-event-payments-v1` and check:

```text
levels: ["Error"]
levels: ["High"]
```

Expected: sanitizer, React event/hook, and JSX accessibility findings are absent after Codacy reanalyzes the pushed commit. Local MCP results may remain stale until Codacy processes the new commit.

## Self-Review

- Spec coverage: covers React/Next-valid Codacy findings, Context7 React/Next validation, TDD, focused tests, and subagent-friendly slices.
- Placeholder scan: no placeholder commands remain; every command names concrete files or repo scripts.
- Type consistency: new sanitizer tests use existing exported functions; React wrappers preserve existing handler APIs.
