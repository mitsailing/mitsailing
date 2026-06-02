# React Email Admin Editor Design

Last updated: 2026-06-02

## Goal

Let admins preview and edit the operational email copy that currently lives in `src/locales/en.json`, using the current React Email editor stack, while keeping the existing typed React Email layouts and send paths.

## Current Docs Baseline

Use the June 2026 React Email 6 docs and package registry state for implementation:

- `react-email` is the package for components, render utilities, and the CLI preview server.
- `@react-email/ui` is a separate package and already exists in this repo as `6.5.0`.
- `@react-email/editor` is a separate package. Current npm version is `1.5.3`.
- The current `EmailEditor` import is `import { EmailEditor, type EmailEditorRef } from '@react-email/editor';`.
- `EmailEditor` accepts an HTML string or TipTap JSON as `content` and exposes `getEmail()`, `getEmailHTML()`, `getEmailText()`, `getJSON()`, and the underlying `editor`.
- Use `editor.getHTML()` for the editable body fragment that will be inserted into MIT Sailing's existing typed layouts. Use `getEmail()` only for editor-local preview/export checks, because it returns a full email document.
- `composeReactEmail` is available from `@react-email/editor/core` for lower-level export.
- The editor is TipTap/ProseMirror-backed. Treat package API validation as the first implementation task, not a later cleanup.

Source URLs:

- https://react.email/docs/editor/api-reference/email-editor
- https://react.email/docs/editor/features/email-export
- https://react.email/docs/getting-started/updating-react-email

## Actor Workflow

Actor: an admin maintaining MIT Sailing operational messaging, usually in the admin area, checking exact copy before it goes to real people.

Object: an email template or newsletter broadcast, not a code component.

Starting point: `/admin`, then the existing newsletter/email navigation. The new surface should sit with newsletter broadcast/template tools because `NEWSLETTER_MANAGE` is already the narrow admin-only permission for email send administration. Do not put this behind broad `ADMIN_VIEW`.

## UX Design

Add an admin email template surface at `/admin/email-templates`.

The list shows:

- template name;
- family, such as newsletter, Pavilion, event payment, or membership payment;
- published revision timestamp;
- draft indicator;
- preview/edit action.

The detail page is the work surface:

- subject and preview text fields;
- a constrained React Email editor pane;
- a rendered email preview iframe;
- scenario selector for templates that need sample data;
- save draft, preview, publish, and send test controls;
- visible validation state before publishing.

Use existing admin components and token vocabulary. Keep it a dense product UI: no hero, no decorative cards, no invented controls, no raw colors, and no hard-coded visible strings.

Protect unfinished edits. The editor page is a form-like admin workflow with unsaved text. Preserve drafts locally during same-tab navigation and clear them only after save or publish.

## Template Coverage

V1 covers the email families the user asked for:

- newsletter broadcasts;
- Pavilion reservation submitted and status emails;
- event payment request, reminder, receipt, and admin digest emails;
- membership payment reminder emails.

Auth and security emails stay code-owned in V1, with preview coverage only if it is cheap. These templates are coupled to Better Auth and account-security wording, so moving them into admin-editable content is a separate product/security decision.

Ship this work as one pull request. Keep the implementation disciplined enough to stay under repository PR limits rather than splitting by subsystem.

## Data Boundary

Create an email-template revision model instead of repurposing `NewsletterTemplate`.

Reason: the existing `NewsletterTemplate` row is a newsletter layout selector. Admin-editable transactional content needs revision history, publish state, validation, sample scenarios, and send safety. That is a real lifecycle and audit boundary, not a generic table invented for convenience.

Keep the existing React Email TSX components as layouts. Admins edit the subject, preview text, plaintext, and sanitized editor body fragment that is inserted into those layouts. Do not build a code-template editor and do not ask AI to produce TSX inside the product UI.

## Send Safety

Published template revisions must be validated before send:

- required tokens are present or intentionally provided by the typed layout;
- unknown tokens are rejected;
- subject, preview text, body HTML, and plaintext are non-empty within limits;
- body HTML is sanitized before it enters a React Email layout;
- rendered HTML is generated before calling `sendTransactionalEmail`.

If a published revision becomes invalid, the send must fail closed before an email leaves the app. Capture the error in Sentry with template key, revision id, email category, and scenario context. Do not silently fall back to stale code copy after a bad published revision.

During rollout only, if no database template row or published revision exists for a template key, the existing code-owned defaults may seed or render the initial value. That is bootstrap behavior, not an error fallback.

## Newsletter Direction

Newsletters continue to send through the transactional email path in this repo. The editor replaces the plain body textarea for broadcast composition and stores editor body HTML/plaintext data with the broadcast. It does not introduce a separate marketing provider workflow.

## Non-Goals

- Do not replace the React Email layout components.
- Do not add a generic CMS/editor framework.
- Do not add a new permission unless the existing role map proves `NEWSLETTER_MANAGE` is insufficient.
- Do not make admins edit executable code.
- Do not move account-security/auth email copy to the database in V1.
- Do not add image upload until storage, moderation, and email-client safety are scoped.
- Do not resolve every old `en.json` email key in the first PR if it would make the PR too large; keep code-owned difficult templates documented.

## Testing

Cover:

- package/API validation for `@react-email/editor`;
- schema and publish-state helpers;
- token interpolation and unknown-token rejection;
- sanitization of editor body HTML;
- render output for Pavilion, event payment, membership payment, and newsletter scenarios;
- Sentry capture and fail-closed behavior when a published revision is invalid;
- admin permission gating;
- editor draft save/publish flows;
- newsletter composer migration from textarea to editor-backed body;
- README directions for `npm run email:dev` and the admin email template workflow.

## Approval

Approved direction in chat on 2026-06-02: use React Email editor, keep typed layouts, make admin-editable DB revisions for newsletters plus Pavilion/event/payment families, and keep difficult account/security templates code-owned for now.
