# React Email Admin Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a current React Email admin workflow that lets admins preview, edit, validate, and publish DB-backed email copy for newsletters, Pavilion reservation emails, event payment emails, and membership payment reminders without replacing the existing typed React Email layouts.

**Architecture:** Keep React Email TSX components as code-owned layouts. Store editable copy and editor body fragments in new email template/revision rows, render those revisions through a small registry of template keys and sample scenarios, then call the existing `sendTransactionalEmail` only after rendering succeeds. Use `/admin/email-templates` and the existing `NEWSLETTER_MANAGE` permission for the admin surface. Newsletter broadcasts keep their existing send pipeline but replace the plain body textarea with the same React Email editor wrapper.

**Tech Stack:** Next.js 16 App Router, React 19, React Email 6.5, `@react-email/ui` 6.5, `@react-email/editor` 1.5, TipTap 3, Server Actions, ZenStack/Prisma 7, PostgreSQL, next-intl, Sentry, Vitest, Playwright.

---

## Required Current Docs

Treat these June 2026 docs and registry checks as implementation inputs:

- React Email editor API: https://react.email/docs/editor/api-reference/email-editor
- React Email editor export API: https://react.email/docs/editor/features/email-export
- React Email 6 package split: https://react.email/docs/getting-started/updating-react-email
- Local registry check: `npm view @react-email/editor version peerDependencies dependencies --json`
- Local registry check: `npm view @react-email/ui version peerDependencies dependencies --json`
- ZenStack schema generation: `npx zen check --schema zenstack/schema.zmodel` and `npx zen generate --schema zenstack/schema.zmodel`

Use Context7 for any React Email, Next.js, TipTap, Prisma, or Sentry API question during implementation. If docs and installed types disagree, stop and adjust the plan before coding against guesses.

## Scope And PR Budget

Ship this work as one PR. Keep the implementation disciplined enough to stay under repository PR limits, and stop only if a hard technical limit makes one PR impossible.

The one-PR scope is still reasonable because existing email layouts, transactional senders, newsletter admin pages, and `sendTransactionalEmail` already exist.

## File Map

Package and docs:

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`

Schema and generated files:

- Modify: `zenstack/schema.zmodel`
- Generated: `prisma/schema.prisma`
- Add: `prisma/migrations/20260602120000_email_template_revisions/migration.sql`

Email template domain:

- Create: `src/libs/email-templates/emailTemplateKeys.ts`
- Create: `src/libs/email-templates/emailTemplateRegistry.ts`
- Create: `src/libs/email-templates/emailTemplateTokens.ts`
- Create: `src/libs/email-templates/emailTemplateBodyHtml.tsx`
- Create: `src/libs/email-templates/emailTemplateRendering.ts`
- Create: `src/libs/email-templates/emailTemplateRendering.test.ts`
- Create: `src/libs/email-templates/emailTemplatePublishing.ts`
- Create: `src/libs/email-templates/emailTemplatePublishing.test.ts`
- Create: `src/libs/email-templates/emailTemplateSeedDefaults.ts`
- Create: `src/libs/email-templates/emailTemplateSeedDefaults.test.ts`

Admin editor UI:

- Create: `src/components/mit-sailing/admin/email-templates/AdminEmailTemplateEditor.tsx`
- Create: `src/components/mit-sailing/admin/email-templates/AdminEmailTemplateEditor.test.tsx`
- Create: `src/components/mit-sailing/admin/email-templates/AdminEmailTemplateList.tsx`
- Create: `src/libs/email-templates/emailTemplateAdminActions.ts`
- Create: `src/libs/email-templates/emailTemplateAdminActions.test.ts`
- Create: `src/libs/email-templates/emailTemplateAdminQueries.ts`
- Create: `src/libs/email-templates/emailTemplateAdminQueries.test.ts`
- Create: `src/app/[locale]/(marketing)/(site)/admin/email-templates/page.tsx`
- Create: `src/app/[locale]/(marketing)/(site)/admin/email-templates/[key]/page.tsx`
- Modify: `src/libs/admin/adminNavigation.ts`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/adminLayout.test.tsx`

Newsletter composer:

- Create: `src/components/mit-sailing/admin/newsletters/AdminNewsletterBroadcastEditor.tsx`
- Create: `src/components/mit-sailing/admin/newsletters/AdminNewsletterBroadcastEditor.test.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/newsletter-broadcasts/new/page.tsx`
- Modify: `src/libs/newsletter/newsletterValidation.ts`
- Modify: `src/libs/newsletter/newsletterValidation.test.ts`
- Modify: `src/libs/newsletter/newsletterEmail.ts`
- Modify: `src/libs/newsletter/newsletterEmail.test.ts`
- Modify: `emails/newsletter-broadcast.tsx`

Transactional email conversions:

- Modify: `src/libs/email/event-payment-emails.ts`
- Modify: `src/libs/email/event-payment-emails.test.ts`
- Modify: `src/libs/email/pavilion-reservation-emails.ts`
- Modify: `src/libs/email/pavilion-reservation-emails.test.ts`
- Modify: `src/libs/email/membership-payment-emails.ts`
- Add: `src/libs/email/membership-payment-emails.test.ts`
- Modify: `emails/event-payment-shared.tsx`
- Modify: `emails/event-payment-request.tsx`
- Modify: `emails/event-payment-reminder.tsx`
- Modify: `emails/event-payment-receipt.tsx`
- Modify: `emails/event-payment-admin-digest.tsx`
- Modify: `emails/pavilion-reservation.tsx`
- Modify: `emails/membership-payment-reminder.tsx`

Translations and e2e:

- Modify: `src/locales/en.json`
- Add: `tests/e2e/AdminEmailTemplates.e2e.ts`

## Task 0: Verify Branch, Docs, And Package API

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/libs/email-templates/emailEditorApiProbe.test.ts`

- [ ] **Step 1: Confirm isolated feature branch**

Run:

```shell
git status --short --branch
git rev-parse --abbrev-ref HEAD
git merge-base HEAD origin/main
git rev-parse origin/main
```

Expected: branch is `feature/react-email-admin-editor`; merge-base equals `origin/main`.

- [ ] **Step 2: Confirm current package registry state**

Run:

```shell
npm view @react-email/editor version peerDependencies dependencies --json
npm view @react-email/ui version peerDependencies dependencies --json
```

Expected:

- `@react-email/editor` current version is compatible with React 19 and depends on React Email 6.
- `@react-email/ui` current version matches the repo's React Email 6 package family.

- [ ] **Step 3: Install editor package**

Run:

```shell
npm install @react-email/editor@latest
```

Expected: `package.json` and `package-lock.json` add `@react-email/editor`; `react-email` and `@react-email/ui` remain in the React Email 6 family.

- [ ] **Step 4: Add API probe**

Create `src/libs/email-templates/emailEditorApiProbe.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('React Email editor package', () => {
  it('keeps the documented editor exports available', async () => {
    const editor = await import('@react-email/editor');
    const core = await import('@react-email/editor/core');

    expect(editor.EmailEditor).toBeDefined();
    expect(typeof core.composeReactEmail).toBe('function');
  });
});
```

- [ ] **Step 5: Run the API probe**

Run:

```shell
npm run test -- src/libs/email-templates/emailEditorApiProbe.test.ts
```

Expected: PASS. If Vitest cannot load the package in Node because the editor is browser-only, replace this runtime probe with a type-only probe imported by `npm run check:types`, then remove the failing test file.

- [ ] **Step 6: Commit package validation**

Run:

```shell
git add package.json package-lock.json src/libs/email-templates/emailEditorApiProbe.test.ts
git commit -m "build: add react email editor package"
```

## Task 1: Add Email Template Revision Schema

**Files:**
- Modify: `zenstack/schema.zmodel`
- Generated: `prisma/schema.prisma`
- Add: `prisma/migrations/20260602120000_email_template_revisions/migration.sql`
- Create: `src/libs/email-templates/emailTemplateKeys.ts`
- Create: `src/libs/email-templates/emailTemplatePublishing.ts`
- Create: `src/libs/email-templates/emailTemplatePublishing.test.ts`

- [ ] **Step 1: Write failing publish-state tests**

Create `src/libs/email-templates/emailTemplatePublishing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  choosePublishedRevision,
  isEditableEmailTemplateKey,
} from '@/libs/email-templates/emailTemplatePublishing';

describe('email template publishing', () => {
  it('recognizes editable V1 template keys', () => {
    expect(isEditableEmailTemplateKey('pavilion_reservation_submitted')).toBe(
      true
    );
    expect(isEditableEmailTemplateKey('auth_sign_in_otp')).toBe(false);
  });

  it('chooses the newest published revision', () => {
    const older = {
      id: 'old',
      publishedAt: new Date('2026-05-01T12:00:00.000Z'),
      status: 'published',
    };
    const newer = {
      id: 'new',
      publishedAt: new Date('2026-06-01T12:00:00.000Z'),
      status: 'published',
    };

    expect(choosePublishedRevision([older, newer])?.id).toBe('new');
  });

  it('returns null when no revision is published', () => {
    expect(
      choosePublishedRevision([
        {
          id: 'draft',
          publishedAt: null,
          status: 'draft',
        },
      ])
    ).toBeNull();
  });
});
```

Run:

```shell
npm run test -- src/libs/email-templates/emailTemplatePublishing.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Add template key constants**

Create `src/libs/email-templates/emailTemplateKeys.ts`:

```ts
export const editableEmailTemplateKeys = [
  'newsletter_broadcast',
  'pavilion_reservation_submitted',
  'pavilion_reservation_status',
  'event_payment_request',
  'event_payment_reminder',
  'event_payment_receipt',
  'event_payment_admin_digest',
  'membership_payment_reminder',
] as const;

export type EditableEmailTemplateKey =
  (typeof editableEmailTemplateKeys)[number];
```

- [ ] **Step 3: Add publish helper implementation**

Create `src/libs/email-templates/emailTemplatePublishing.ts`:

```ts
import { editableEmailTemplateKeys } from '@/libs/email-templates/emailTemplateKeys';
import type { EditableEmailTemplateKey } from '@/libs/email-templates/emailTemplateKeys';

type RevisionStatus = 'archived' | 'draft' | 'published';

type PublishableRevision = Readonly<{
  id: string;
  publishedAt: Date | null;
  status: RevisionStatus;
}>;

export function isEditableEmailTemplateKey(
  value: string
): value is EditableEmailTemplateKey {
  return editableEmailTemplateKeys.includes(value as EditableEmailTemplateKey);
}

export function choosePublishedRevision<TRevision extends PublishableRevision>(
  revisions: readonly TRevision[]
): TRevision | null {
  const published = revisions.filter(
    (revision) =>
      revision.status === 'published' && revision.publishedAt !== null
  );
  return (
    published.toSorted(
      (left, right) => right.publishedAt.getTime() - left.publishedAt.getTime()
    )[0] ?? null
  );
}
```

- [ ] **Step 4: Add ZenStack models**

Modify `zenstack/schema.zmodel`.

Add enums near the newsletter/email models:

```prisma
enum EmailTemplateFamily {
  newsletter
  pavilion_reservation
  event_payment
  membership_payment

  @@map("email_template_family")
}

enum EmailTemplateRevisionStatus {
  draft
  published
  archived

  @@map("email_template_revision_status")
}
```

Add models after `NewsletterTemplate`:

```prisma
model EmailTemplate {
  id          String              @id @default(cuid())
  key         String              @unique
  family      EmailTemplateFamily
  name        String
  description String?             @db.Text
  createdAt   DateTime            @default(now()) @map("created_at")
  updatedAt   DateTime            @updatedAt @map("updated_at")

  revisions EmailTemplateRevision[]

  @@allow('read', auth() != null && auth().appRole == 'admin')
  @@allow('all', auth() != null && auth().appRole == 'admin')
  @@index([family, name])
  @@map("email_templates")
}

model EmailTemplateRevision {
  id                String                      @id @default(cuid())
  templateId        String                      @map("template_id")
  status            EmailTemplateRevisionStatus @default(draft)
  subject           String
  previewText       String                      @map("preview_text")
  editorJson        Json?                       @map("editor_json")
  editorBodyHtml    String                      @map("editor_body_html") @db.Text
  renderedText      String                      @map("rendered_text") @db.Text
  renderHash        String                      @map("render_hash")
  createdByUserId   String?                     @map("created_by_user_id")
  publishedByUserId String?                     @map("published_by_user_id")
  publishedAt       DateTime?                   @map("published_at")
  createdAt         DateTime                    @default(now()) @map("created_at")
  updatedAt         DateTime                    @updatedAt @map("updated_at")

  template    EmailTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  createdBy   User?         @relation("EmailTemplateRevisionCreatedBy", fields: [createdByUserId], references: [id], onDelete: SetNull)
  publishedBy User?         @relation("EmailTemplateRevisionPublishedBy", fields: [publishedByUserId], references: [id], onDelete: SetNull)

  @@allow('read', auth() != null && auth().appRole == 'admin')
  @@allow('all', auth() != null && auth().appRole == 'admin')
  @@index([templateId, status, publishedAt])
  @@index([createdByUserId])
  @@index([publishedByUserId])
  @@map("email_template_revisions")
}
```

If ZenStack requires the matching relation fields on `User`, add:

```prisma
emailTemplateRevisionsCreated EmailTemplateRevision[] @relation("EmailTemplateRevisionCreatedBy")
emailTemplateRevisionsPublished EmailTemplateRevision[] @relation("EmailTemplateRevisionPublishedBy")
```

- [ ] **Step 5: Generate Prisma and create migration**

Run:

```shell
npx zen check --schema zenstack/schema.zmodel
npx zen generate --schema zenstack/schema.zmodel
npx prisma generate
```

Expected: generated Prisma and ZenStack files are updated. Then create a migration under `prisma/migrations/*_email_template_revisions/`.

If `prisma migrate dev` reports local database drift, do not reset the database. Generate the migration from schema diff instead:

```shell
git show origin/main:prisma/schema.prisma > /tmp/mitsailing-origin-main-schema.prisma
npx prisma migrate diff --from-schema /tmp/mitsailing-origin-main-schema.prisma --to-schema prisma/schema.prisma --script
```

Create `prisma/migrations/20260602145500_email_template_revisions/migration.sql` from that SQL.

- [ ] **Step 6: Run schema tests**

Run:

```shell
npm run test -- src/libs/email-templates/emailTemplatePublishing.test.ts
npm run check:types
```

Expected: PASS.

- [ ] **Step 7: Commit schema**

Run:

```shell
git add zenstack/schema.zmodel zenstack/schema.ts zenstack/models.ts zenstack/input.ts prisma/schema.prisma prisma/migrations src/libs/email-templates/emailTemplateKeys.ts src/libs/email-templates/emailTemplatePublishing.ts src/libs/email-templates/emailTemplatePublishing.test.ts
git commit -m "feat: add email template revision schema"
```

## Task 2: Add Template Registry, Tokens, Sanitization, Rendering, And Sentry

**Files:**
- Create: `src/libs/email-templates/emailTemplateRegistry.ts`
- Create: `src/libs/email-templates/emailTemplateTokens.ts`
- Create: `src/libs/email-templates/emailTemplateBodyHtml.tsx`
- Create: `src/libs/email-templates/emailTemplateRendering.ts`
- Create: `src/libs/email-templates/emailTemplateRendering.test.ts`
- Modify: `emails/event-payment-shared.tsx`
- Modify: `emails/event-payment-request.tsx`
- Modify: `emails/event-payment-reminder.tsx`
- Modify: `emails/event-payment-receipt.tsx`
- Modify: `emails/event-payment-admin-digest.tsx`
- Modify: `emails/pavilion-reservation.tsx`
- Modify: `emails/membership-payment-reminder.tsx`

- [ ] **Step 1: Write failing token, sanitization, and rendering tests**

Create `src/libs/email-templates/emailTemplateRendering.test.ts`:

```ts
import * as Sentry from '@sentry/nextjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EmailTemplateRenderError,
  renderEditableEmailTemplate,
  sanitizeEmailTemplateBodyHtml,
} from '@/libs/email-templates/emailTemplateRendering';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

const revision = {
  editorBodyHtml: '<p>Hello {eventName}</p>',
  id: 'revision-1',
  previewText: 'Preview for {eventName}',
  renderedText: 'Hello {eventName}',
  subject: 'Subject for {eventName}',
  template: {
    key: 'event_payment_request',
  },
};

describe('sanitizeEmailTemplateBodyHtml', () => {
  it('removes script tags from editor body html', () => {
    expect(
      sanitizeEmailTemplateBodyHtml('<p>Hello</p><script>alert(1)</script>')
    ).toBe('<p>Hello</p>');
  });
});

describe('renderEditableEmailTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('interpolates known tokens before rendering', async () => {
    const rendered = await renderEditableEmailTemplate({
      revision,
      values: {
        amount: '$25.00',
        checkoutUrl: 'https://example.com/pay',
        deadline: 'June 15, 2026',
        eventAddress: '134 Memorial Drive',
        eventAddressUrl: null,
        eventName: 'Moonlight sail',
        recipientName: 'Avery Sailor',
        selectedFeeDescription: 'Guest fee',
      },
    });

    expect(rendered.subject).toBe('Subject for Moonlight sail');
    expect(rendered.previewText).toBe('Preview for Moonlight sail');
    expect(rendered.text).toContain('Hello Moonlight sail');
    expect(rendered.html).toContain('Moonlight sail');
  });

  it('captures Sentry and throws before send when an unknown token exists', async () => {
    await expect(
      renderEditableEmailTemplate({
        revision: {
          ...revision,
          editorBodyHtml: '<p>Hello {badToken}</p>',
        },
        values: {
          amount: '$25.00',
          checkoutUrl: 'https://example.com/pay',
          deadline: 'June 15, 2026',
          eventAddress: null,
          eventAddressUrl: null,
          eventName: 'Moonlight sail',
          recipientName: 'Avery Sailor',
          selectedFeeDescription: 'Guest fee',
        },
      })
    ).rejects.toBeInstanceOf(EmailTemplateRenderError);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(EmailTemplateRenderError),
      expect.objectContaining({
        tags: expect.objectContaining({
          emailTemplateKey: 'event_payment_request',
          emailTemplateRevisionId: 'revision-1',
        }),
      })
    );
  });
});
```

Run:

```shell
npm run test -- src/libs/email-templates/emailTemplateRendering.test.ts
```

Expected: FAIL because the renderer does not exist.

- [ ] **Step 2: Add token helpers**

Create `src/libs/email-templates/emailTemplateTokens.ts`:

```ts
const TOKEN_PATTERN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

export function tokensInTemplate(value: string): string[] {
  const tokens = new Set<string>();
  for (const match of value.matchAll(TOKEN_PATTERN)) {
    if (match[1]) {
      tokens.add(match[1]);
    }
  }
  return [...tokens].toSorted();
}

export function interpolateTemplateTokens(
  value: string,
  replacements: Readonly<Record<string, string | null | undefined>>
): string {
  return value.replaceAll(TOKEN_PATTERN, (token, key: string) => {
    if (!Object.hasOwn(replacements, key)) {
      return token;
    }
    return replacements[key] ?? '';
  });
}

export function unknownTemplateTokens(
  value: string,
  allowedTokens: readonly string[]
): string[] {
  const allowed = new Set(allowedTokens);
  return tokensInTemplate(value).filter((token) => !allowed.has(token));
}
```

- [ ] **Step 3: Add registry**

Create `src/libs/email-templates/emailTemplateRegistry.ts` with the exact V1 entries and allowed tokens:

```ts
import type { EditableEmailTemplateKey } from '@/libs/email-templates/emailTemplateKeys';

export type EmailTemplateFamily =
  | 'event_payment'
  | 'membership_payment'
  | 'newsletter'
  | 'pavilion_reservation';

type EmailTemplateRegistryEntry = Readonly<{
  allowedTokens: readonly string[];
  family: EmailTemplateFamily;
  key: EditableEmailTemplateKey;
  nameKey: string;
}>;

const eventPaymentTokens = [
  'amount',
  'checkoutUrl',
  'deadline',
  'eventAddress',
  'eventAddressUrl',
  'eventName',
  'receiptUrl',
  'recipientName',
  'selectedFeeDescription',
] as const;

export const emailTemplateRegistry = [
  {
    allowedTokens: ['body', 'listName', 'manageUrl', 'postalAddress', 'subject', 'unsubscribeUrl'],
    family: 'newsletter',
    key: 'newsletter_broadcast',
    nameKey: 'template_newsletter_broadcast',
  },
  {
    allowedTokens: ['eventName', 'referenceCode'],
    family: 'pavilion_reservation',
    key: 'pavilion_reservation_submitted',
    nameKey: 'template_pavilion_reservation_submitted',
  },
  {
    allowedTokens: ['eventName', 'referenceCode', 'status'],
    family: 'pavilion_reservation',
    key: 'pavilion_reservation_status',
    nameKey: 'template_pavilion_reservation_status',
  },
  {
    allowedTokens: eventPaymentTokens,
    family: 'event_payment',
    key: 'event_payment_request',
    nameKey: 'template_event_payment_request',
  },
  {
    allowedTokens: eventPaymentTokens,
    family: 'event_payment',
    key: 'event_payment_reminder',
    nameKey: 'template_event_payment_reminder',
  },
  {
    allowedTokens: eventPaymentTokens,
    family: 'event_payment',
    key: 'event_payment_receipt',
    nameKey: 'template_event_payment_receipt',
  },
  {
    allowedTokens: ['deadline', 'eventName'],
    family: 'event_payment',
    key: 'event_payment_admin_digest',
    nameKey: 'template_event_payment_admin_digest',
  },
  {
    allowedTokens: ['amount', 'cardType', 'cardYear', 'onboardingUrl'],
    family: 'membership_payment',
    key: 'membership_payment_reminder',
    nameKey: 'template_membership_payment_reminder',
  },
] as const satisfies readonly EmailTemplateRegistryEntry[];

export function emailTemplateRegistryEntry(key: EditableEmailTemplateKey) {
  return emailTemplateRegistry.find((entry) => entry.key === key) ?? null;
}
```

- [ ] **Step 4: Add sanitized body helper**

Create `src/libs/email-templates/emailTemplateBodyHtml.tsx`:

```tsx
import sanitizeHtml from 'sanitize-html';

const allowedTags = [
  'a',
  'blockquote',
  'br',
  'em',
  'h2',
  'h3',
  'li',
  'ol',
  'p',
  'strong',
  'ul',
] as const;

const allowedAttributes = {
  a: ['href', 'rel', 'target'],
} as const;

export function sanitizeEmailTemplateBodyHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedAttributes,
    allowedTags: [...allowedTags],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'noopener noreferrer',
        target: '_blank',
      }),
    },
  }).trim();
}

export function SafeEmailTemplateBodyHtml(props: { html: string }) {
  const sanitized = sanitizeEmailTemplateBodyHtml(props.html);
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

This is the only allowed `dangerouslySetInnerHTML` in this PR, and it is always fed through `sanitizeEmailTemplateBodyHtml`.

- [ ] **Step 5: Add renderer**

Create `src/libs/email-templates/emailTemplateRendering.ts`:

```ts
import * as Sentry from '@sentry/nextjs';
import { render } from 'react-email';
import { EventPaymentAdminDigestTemplate } from '@/../emails/event-payment-admin-digest';
import { EventPaymentReceiptTemplate } from '@/../emails/event-payment-receipt';
import { EventPaymentReminderTemplate } from '@/../emails/event-payment-reminder';
import { EventPaymentRequestTemplate } from '@/../emails/event-payment-request';
import { MembershipPaymentReminderTemplate } from '@/../emails/membership-payment-reminder';
import { NewsletterBroadcastTemplate } from '@/../emails/newsletter-broadcast';
import { PavilionReservationEmailTemplate } from '@/../emails/pavilion-reservation';
import { emailTemplateRegistryEntry } from '@/libs/email-templates/emailTemplateRegistry';
import { sanitizeEmailTemplateBodyHtml } from '@/libs/email-templates/emailTemplateBodyHtml';
import {
  interpolateTemplateTokens,
  unknownTemplateTokens,
} from '@/libs/email-templates/emailTemplateTokens';
import enMessages from '@/locales/en.json';
import type { EditableEmailTemplateKey } from '@/libs/email-templates/emailTemplateKeys';

type RevisionLike = Readonly<{
  editorBodyHtml: string;
  id: string;
  previewText: string;
  renderedText: string;
  subject: string;
  template: Readonly<{ key: EditableEmailTemplateKey }>;
}>;

type RenderParams = Readonly<{
  revision: RevisionLike;
  values: Readonly<Record<string, string | null | undefined>>;
}>;

export { sanitizeEmailTemplateBodyHtml };

export class EmailTemplateRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailTemplateRenderError';
  }
}

function assertKnownTokens(params: {
  allowedTokens: readonly string[];
  key: string;
  revisionId: string;
  values: readonly string[];
}) {
  const unknown = params.values.flatMap((value) =>
    unknownTemplateTokens(value, params.allowedTokens)
  );
  if (unknown.length === 0) {
    return;
  }
  throw new EmailTemplateRenderError(
    `Email template ${params.key} revision ${params.revisionId} contains unknown token(s): ${[...new Set(unknown)].join(', ')}`
  );
}

function interpolated(
  value: string,
  replacements: RenderParams['values']
): string {
  return interpolateTemplateTokens(value, replacements).trim();
}

function valueFor(
  values: RenderParams['values'],
  key: string,
  fallback = ''
): string {
  return values[key] ?? fallback;
}

async function renderTemplateHtml(params: {
  bodyHtml: string;
  key: EditableEmailTemplateKey;
  previewText: string;
  text: string;
  subject: string;
  values: RenderParams['values'];
}) {
  const eventCopy = enMessages.EventPaymentEmails;
  const pavilionCopy = enMessages.PavilionReservationEmails;
  const membershipCopy = enMessages.MembershipPaymentEmails;
  switch (params.key) {
    case 'event_payment_request':
      return render(
        EventPaymentRequestTemplate({
          actionLabel: eventCopy.action_pay,
          amount: valueFor(params.values, 'amount'),
          body: params.text,
          bodyHtml: params.bodyHtml,
          checkoutUrl: valueFor(params.values, 'checkoutUrl'),
          deadline: valueFor(params.values, 'deadline'),
          eventAddress: valueFor(params.values, 'eventAddress') || null,
          eventAddressUrl: valueFor(params.values, 'eventAddressUrl') || null,
          eventName: valueFor(params.values, 'eventName'),
          feeDescription: valueFor(params.values, 'selectedFeeDescription'),
          fieldAddress: eventCopy.field_address,
          fieldAmount: eventCopy.field_amount,
          fieldDeadline: eventCopy.field_deadline,
          fieldEvent: eventCopy.field_event,
          fieldFee: eventCopy.field_fee,
          previewText: params.previewText,
          title: params.subject,
        })
      );
    case 'event_payment_reminder':
      return render(
        EventPaymentReminderTemplate({
          actionLabel: eventCopy.action_pay,
          amount: valueFor(params.values, 'amount'),
          body: params.text,
          bodyHtml: params.bodyHtml,
          checkoutUrl: valueFor(params.values, 'checkoutUrl'),
          deadline: valueFor(params.values, 'deadline'),
          eventAddress: valueFor(params.values, 'eventAddress') || null,
          eventAddressUrl: valueFor(params.values, 'eventAddressUrl') || null,
          eventName: valueFor(params.values, 'eventName'),
          feeDescription: valueFor(params.values, 'selectedFeeDescription'),
          fieldAddress: eventCopy.field_address,
          fieldAmount: eventCopy.field_amount,
          fieldDeadline: eventCopy.field_deadline,
          fieldEvent: eventCopy.field_event,
          fieldFee: eventCopy.field_fee,
          previewText: params.previewText,
          title: params.subject,
        })
      );
    case 'event_payment_receipt':
      return render(
        EventPaymentReceiptTemplate({
          actionLabel: eventCopy.action_receipt,
          amount: valueFor(params.values, 'amount'),
          body: params.text,
          bodyHtml: params.bodyHtml,
          eventAddress: valueFor(params.values, 'eventAddress') || null,
          eventAddressUrl: valueFor(params.values, 'eventAddressUrl') || null,
          eventName: valueFor(params.values, 'eventName'),
          feeDescription: valueFor(params.values, 'selectedFeeDescription'),
          fieldAddress: eventCopy.field_address,
          fieldAmount: eventCopy.field_amount,
          fieldEvent: eventCopy.field_event,
          fieldFee: eventCopy.field_fee,
          previewText: params.previewText,
          receiptUrl: valueFor(params.values, 'receiptUrl') || null,
          title: params.subject,
        })
      );
    case 'event_payment_admin_digest':
      return render(
        EventPaymentAdminDigestTemplate({
          body: params.text,
          bodyHtml: params.bodyHtml,
          deadline: valueFor(params.values, 'deadline'),
          eventName: valueFor(params.values, 'eventName'),
          fieldDeadline: eventCopy.field_deadline,
          overduePayments: [],
          previewText: params.previewText,
          title: params.subject,
        })
      );
    case 'pavilion_reservation_submitted':
      return render(
        PavilionReservationEmailTemplate({
          body: params.text,
          bodyHtml: params.bodyHtml,
          copy: pavilionCopy,
          eventName: valueFor(params.values, 'eventName'),
          previewText: params.previewText,
          referenceCode: valueFor(params.values, 'referenceCode'),
          scheduleLines: [],
          title: params.subject,
        })
      );
    case 'pavilion_reservation_status':
      return render(
        PavilionReservationEmailTemplate({
          body: params.text,
          bodyHtml: params.bodyHtml,
          copy: pavilionCopy,
          eventName: valueFor(params.values, 'eventName'),
          previewText: params.previewText,
          referenceCode: valueFor(params.values, 'referenceCode'),
          scheduleLines: [],
          statusLabel: valueFor(params.values, 'status'),
          title: params.subject,
        })
      );
    case 'membership_payment_reminder':
      return render(
        MembershipPaymentReminderTemplate({
          actionLabel: membershipCopy.action_finish,
          amount: valueFor(params.values, 'amount'),
          body: params.text,
          bodyHtml: params.bodyHtml,
          cardType: valueFor(params.values, 'cardType'),
          cardYear: valueFor(params.values, 'cardYear'),
          fieldAmount: membershipCopy.field_amount,
          fieldCard: membershipCopy.field_card,
          fieldYear: membershipCopy.field_year,
          onboardingUrl: valueFor(params.values, 'onboardingUrl'),
          previewText: params.previewText,
          title: params.subject,
        })
      );
    case 'newsletter_broadcast':
      return render(
        NewsletterBroadcastTemplate({
          body: params.bodyHtml,
          listName: valueFor(params.values, 'listName', 'General'),
          manageUrl: valueFor(params.values, 'manageUrl', 'https://mitsailing.com/newsletter'),
          postalAddress: valueFor(params.values, 'postalAddress'),
          previewText: params.previewText,
          subject: params.subject,
          unsubscribeUrl: valueFor(params.values, 'unsubscribeUrl', 'https://mitsailing.com/newsletter'),
        })
      );
  }
}

export async function renderEditableEmailTemplate(params: RenderParams) {
  const key = params.revision.template.key;
  const entry = emailTemplateRegistryEntry(key);
  if (!entry) {
    throw new EmailTemplateRenderError(`Unknown email template key: ${key}`);
  }

  try {
    assertKnownTokens({
      allowedTokens: entry.allowedTokens,
      key,
      revisionId: params.revision.id,
      values: [
        params.revision.editorBodyHtml,
        params.revision.previewText,
        params.revision.renderedText,
        params.revision.subject,
      ],
    });

    const subject = interpolated(params.revision.subject, params.values);
    const previewText = interpolated(params.revision.previewText, params.values);
    const bodyHtml = sanitizeEmailTemplateBodyHtml(
      interpolated(params.revision.editorBodyHtml, params.values)
    );
    const text = interpolated(params.revision.renderedText, params.values);
    if (!subject || !previewText || !bodyHtml || !text) {
      throw new EmailTemplateRenderError(
        `Email template ${key} revision ${params.revision.id} rendered empty content`
      );
    }

    const html = await renderTemplateHtml({
      bodyHtml,
      key,
      previewText,
      subject,
      text,
      values: params.values,
    });
    return { bodyHtml, html, previewText, subject, text };
  } catch (error) {
    const renderError =
      error instanceof EmailTemplateRenderError
        ? error
        : new EmailTemplateRenderError(String(error));
    Sentry.captureException(renderError, {
      tags: {
        emailTemplateKey: key,
        emailTemplateRevisionId: params.revision.id,
      },
    });
    throw renderError;
  }
}
```

- [ ] **Step 6: Add `bodyHtml` props to existing layouts**

Modify the email layout wrappers so each accepts optional `bodyHtml?: string` and passes it to the template that renders the body:

- `emails/event-payment-shared.tsx`;
- `emails/event-payment-request.tsx`;
- `emails/event-payment-reminder.tsx`;
- `emails/event-payment-receipt.tsx`;
- `emails/event-payment-admin-digest.tsx`;
- `emails/pavilion-reservation.tsx`;
- `emails/membership-payment-reminder.tsx`.

Render `SafeEmailTemplateBodyHtml` when `bodyHtml` is present; otherwise keep the current `<Text>{props.body}</Text>` path.

- [ ] **Step 7: Run renderer tests and type checks**

Run:

```shell
npm run test -- src/libs/email-templates/emailTemplateRendering.test.ts
npm run check:types
```

Expected: PASS.

- [ ] **Step 8: Commit renderer**

Run:

```shell
git add src/libs/email-templates emails/event-payment-shared.tsx emails/pavilion-reservation.tsx emails/membership-payment-reminder.tsx
git commit -m "feat: add email template rendering registry"
```

## Task 3: Seed Code-Owned Defaults Into Editable Revisions

**Files:**
- Create: `src/libs/email-templates/emailTemplateSeedDefaults.ts`
- Create: `src/libs/email-templates/emailTemplateSeedDefaults.test.ts`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Write failing seed-default tests**

Create `src/libs/email-templates/emailTemplateSeedDefaults.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultEmailTemplateRevisions } from '@/libs/email-templates/emailTemplateSeedDefaults';
import { editableEmailTemplateKeys } from '@/libs/email-templates/emailTemplateKeys';

describe('defaultEmailTemplateRevisions', () => {
  it('provides one default for every editable V1 template', () => {
    expect(
      defaultEmailTemplateRevisions.map((item) => item.key).toSorted()
    ).toEqual([...editableEmailTemplateKeys].toSorted());
  });

  it('keeps each default publishable', () => {
    for (const item of defaultEmailTemplateRevisions) {
      expect(item.subject.length).toBeGreaterThan(0);
      expect(item.previewText.length).toBeGreaterThan(0);
      expect(item.editorBodyHtml.length).toBeGreaterThan(0);
      expect(item.renderedText.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Add defaults from current locale email copy**

Create `src/libs/email-templates/emailTemplateSeedDefaults.ts` using `src/locales/en.json` values for:

- `PavilionReservationEmails.submitted_*`;
- `PavilionReservationEmails.status_*`;
- `EventPaymentEmails.request_*`;
- `EventPaymentEmails.reminder_*`;
- `EventPaymentEmails.receipt_*`;
- `EventPaymentEmails.admin_digest_*`;
- `MembershipPaymentEmails.reminder_*`;
- a blank starter for `newsletter_broadcast`.

The fields are `key`, `family`, `name`, `subject`, `previewText`, `editorBodyHtml`, and `renderedText`.

- [ ] **Step 3: Keep static field labels in locale**

Do not remove field labels such as `field_event`, `field_amount`, `field_schedule`, or action labels from `src/locales/en.json` in this task. Those labels are part of the typed layout and are not free-form admin body copy.

- [ ] **Step 4: Run default tests**

Run:

```shell
npm run test -- src/libs/email-templates/emailTemplateSeedDefaults.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit defaults**

Run:

```shell
git add src/libs/email-templates/emailTemplateSeedDefaults.ts src/libs/email-templates/emailTemplateSeedDefaults.test.ts
git commit -m "feat: seed editable email template defaults"
```

## Task 4: Convert Transactional Email Families To Published Revisions

**Files:**
- Modify: `src/libs/email/event-payment-emails.ts`
- Modify: `src/libs/email/event-payment-emails.test.ts`
- Modify: `src/libs/email/pavilion-reservation-emails.ts`
- Modify: `src/libs/email/pavilion-reservation-emails.test.ts`
- Modify: `src/libs/email/membership-payment-emails.ts`
- Add: `src/libs/email/membership-payment-emails.test.ts`

- [x] **Step 1: Write failing send-path tests**

Update or add tests asserting each send function:

- uses the published revision when present;
- records `emailTemplateKey` and `emailTemplateRevisionId` in `sendTransactionalEmail` metadata;
- does not call `sendTransactionalEmail` when rendering throws `EmailTemplateRenderError`.

Use this pattern in each test file:

```ts
it('does not send when the published template render fails', async () => {
  const error = new Error('bad template');
  vi.mocked(renderPublishedEmailTemplateForSend).mockRejectedValue(error);

  await expect(sendEventPaymentRequestEmail(validParams)).rejects.toBe(error);

  expect(sendTransactionalEmail).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Add a published-revision loader**

Add `renderPublishedEmailTemplateForSend` in `src/libs/email-templates/emailTemplateRendering.ts`. It loads the template by key, chooses the newest published revision, returns `null` when no published revision exists, and throws on invalid published content.

- [x] **Step 3: Convert each sender conservatively**

For each covered sender:

1. call `renderPublishedEmailTemplateForSend` with its template key and values;
2. if it returns a rendered result, use that result's `html`, `text`, `subject`, and metadata;
3. if it returns `null`, keep the existing code-owned default path;
4. if it throws, let it throw before `sendTransactionalEmail`.

Do not catch render errors in the sender.

- [x] **Step 4: Run send-path tests**

Run:

```shell
npm run test -- src/libs/email/event-payment-emails.test.ts src/libs/email/pavilion-reservation-emails.test.ts src/libs/email/membership-payment-emails.test.ts
npm run check:types
```

Expected: PASS.

- [ ] **Step 5: Commit transactional conversion**

Run:

```shell
git add src/libs/email src/libs/email-templates emails
git commit -m "feat: render transactional emails from published revisions"
```

## Task 5: Build Admin Email Template List, Editor, Preview, And Publish Actions

**Files:**
- Create: `src/components/mit-sailing/admin/email-templates/AdminEmailTemplateEditor.tsx`
- Create: `src/components/mit-sailing/admin/email-templates/AdminEmailTemplateEditor.test.tsx`
- Create: `src/components/mit-sailing/admin/email-templates/AdminEmailTemplateList.tsx`
- Create: `src/libs/email-templates/emailTemplateAdminActions.ts`
- Create: `src/libs/email-templates/emailTemplateAdminActions.test.ts`
- Create: `src/libs/email-templates/emailTemplateAdminQueries.ts`
- Create: `src/libs/email-templates/emailTemplateAdminQueries.test.ts`
- Create: `src/app/[locale]/(marketing)/(site)/admin/email-templates/page.tsx`
- Create: `src/app/[locale]/(marketing)/(site)/admin/email-templates/[key]/page.tsx`
- Modify: `src/libs/admin/adminNavigation.ts`
- Modify: `src/locales/en.json`

- [x] **Step 1: Write admin action tests**

Create `src/libs/email-templates/emailTemplateAdminActions.test.ts` with tests that:

- require `Permission.NEWSLETTER_MANAGE`;
- save a draft revision from `subject`, `previewText`, `editorBodyHtml`, `renderedText`, and `editorJson`;
- publish only after `renderEditableEmailTemplate` succeeds;
- redirect with `render_failed` when publishing fails.

Use existing `newsletterAdminActions.test.ts` mocking style for `requirePermission`, `redirect`, and `revalidatePath`.

- [x] **Step 2: Write editor component tests**

Create `src/components/mit-sailing/admin/email-templates/AdminEmailTemplateEditor.test.tsx` with Testing Library tests that:

- renders subject and preview inputs;
- renders hidden `editorBodyHtml`, `renderedText`, and `editorJson` inputs for Server Action submission;
- calls `EmailEditorRef.editor.getHTML()`, `getEmailText()`, and `getJSON()` before submit;
- preserves draft content through local storage key `admin-email-template-draft:${templateKey}`.

Mock `@react-email/editor`:

```ts
vi.mock('@react-email/editor', () => ({
  EmailEditor: vi.fn((props) => (
    <textarea
      aria-label="Email body"
      defaultValue={typeof props.content === 'string' ? props.content : ''}
    />
  )),
}));
```

- [x] **Step 3: Implement admin actions**

Create `src/libs/email-templates/emailTemplateAdminActions.ts`:

- `saveEmailTemplateDraftAction(locale, key, formData)`;
- `publishEmailTemplateRevisionAction(locale, key, revisionId)`;
- `sendEmailTemplateTestAction(locale, key, formData)`.

Each action must:

- call `requirePermission(Permission.NEWSLETTER_MANAGE, locale)`;
- validate the key with `isEditableEmailTemplateKey`;
- use `getI18nPath` for redirects;
- call `revalidatePath` after writes.

- [x] **Step 4: Implement admin queries**

Create `src/libs/email-templates/emailTemplateAdminQueries.ts`:

- `getAdminEmailTemplateList()`;
- `getAdminEmailTemplateDetail(key)`;
- `ensureEditableEmailTemplateDefaults()`.

`ensureEditableEmailTemplateDefaults` creates missing template rows and one draft revision from `defaultEmailTemplateRevisions`. Do not create a published row automatically unless the migration/seed policy requires it.

- [x] **Step 5: Implement editor component**

Create `src/components/mit-sailing/admin/email-templates/AdminEmailTemplateEditor.tsx` as a client component. It must use:

```tsx
'use client';

import { EmailEditor, type EmailEditorRef } from '@react-email/editor';
import { useRef } from 'react';

export function AdminEmailTemplateEditor(props: {
  action: (formData: FormData) => void;
  content: string;
  previewText: string;
  subject: string;
  templateKey: string;
}) {
  const editorRef = useRef<EmailEditorRef>(null);

  return (
    <form
      action={async (formData) => {
        const bodyHtml = editorRef.current?.editor?.getHTML() ?? '';
        const text = (await editorRef.current?.getEmailText()) ?? '';
        const json = editorRef.current?.getJSON();
        formData.set('editorBodyHtml', bodyHtml);
        formData.set('renderedText', text);
        formData.set('editorJson', JSON.stringify(json ?? null));
        props.action(formData);
      }}
    >
      <EmailEditor ref={editorRef} content={props.content} theme="basic" />
    </form>
  );
}
```

Then replace the sketch with the repo's actual `Input`, `Label`, `Button`, status messages, hidden fields, local draft preservation, and i18n strings.

- [x] **Step 6: Implement pages and navigation**

Add `/admin/email-templates` and `/admin/email-templates/[key]` pages. Use:

- `await connection()`;
- `setRequestLocale(locale)`;
- `requirePermission(Permission.NEWSLETTER_MANAGE, locale)`;
- `AdminPageHeader`;
- existing admin card/table styles.

Add nav item:

```ts
{
  href: '/admin/email-templates',
  labelKey: 'nav_email_templates',
  match: 'prefix',
  permissions: [Permission.NEWSLETTER_MANAGE],
}
```

Add `AdminSideNav.nav_email_templates` and `AdminEmailTemplates` strings in `src/locales/en.json`.

- [x] **Step 7: Run admin tests**

Run:

```shell
npm run test -- src/libs/email-templates/emailTemplateAdminActions.test.ts src/libs/email-templates/emailTemplateAdminQueries.test.ts src/components/mit-sailing/admin/email-templates/AdminEmailTemplateEditor.test.tsx src/app/[locale]/(marketing)/(site)/admin/adminLayout.test.tsx
npm run check:i18n
npm run check:types
```

Expected: PASS.

- [ ] **Step 8: Commit admin editor**

Run:

```shell
git add src/app src/components/mit-sailing/admin/email-templates src/libs/email-templates src/libs/admin/adminNavigation.ts src/locales/en.json
git commit -m "feat: add admin email template editor"
```

## Task 6: Replace Newsletter Body Textarea With React Email Editor

**Files:**
- Create: `src/components/mit-sailing/admin/newsletters/AdminNewsletterBroadcastEditor.tsx`
- Create: `src/components/mit-sailing/admin/newsletters/AdminNewsletterBroadcastEditor.test.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/newsletter-broadcasts/new/page.tsx`
- Modify: `src/libs/newsletter/newsletterValidation.ts`
- Modify: `src/libs/newsletter/newsletterValidation.test.ts`
- Modify: `src/libs/newsletter/newsletterEmail.ts`
- Modify: `src/libs/newsletter/newsletterEmail.test.ts`
- Modify: `emails/newsletter-broadcast.tsx`

- [x] **Step 1: Write failing newsletter editor tests**

Create `src/components/mit-sailing/admin/newsletters/AdminNewsletterBroadcastEditor.test.tsx` asserting:

- body editor renders;
- hidden `body`, `bodyText`, and `bodyJson` values are populated before submit;
- `body` comes from `editorRef.current.editor.getHTML()`;
- `bodyText` comes from `editorRef.current.getEmailText()`;
- draft persists in same-tab storage and clears after successful submit.

- [x] **Step 2: Preserve validation contract**

Modify `src/libs/newsletter/newsletterValidation.ts` so `body` accepts editor body HTML, not only plain paragraphs. Keep existing min and max length limits.

Add tests for:

```ts
it('accepts editor html body content', () => {
  const formData = new FormData();
  formData.set('subject', 'Subject');
  formData.set('previewText', 'Preview');
  formData.set('templateId', 'template_1');
  formData.set('listId', 'list_1');
  formData.set('body', '<p>Hello sailors</p>');

  expect(validateNewsletterBroadcastFormData(formData)).toMatchObject({
    ok: true,
  });
});
```

- [x] **Step 3: Render newsletter body safely**

Modify `emails/newsletter-broadcast.tsx` to render sanitized editor body HTML through `SafeEmailTemplateBodyHtml`. Keep plaintext fallback for old broadcasts whose body is plain text.

- [x] **Step 4: Replace textarea on new broadcast page**

In `src/app/[locale]/(marketing)/(site)/admin/newsletter-broadcasts/new/page.tsx`, replace `Textarea` for `body` with `AdminNewsletterBroadcastEditor`.

Keep the same Server Action, fields, labels, button names, and queue/draft intents.

- [x] **Step 5: Run newsletter tests**

Run:

```shell
npm run test -- src/components/mit-sailing/admin/newsletters/AdminNewsletterBroadcastEditor.test.tsx src/libs/newsletter/newsletterValidation.test.ts src/libs/newsletter/newsletterEmail.test.ts
npm run check:i18n
npm run check:types
```

Expected: PASS.

- [ ] **Step 6: Commit newsletter editor**

Run:

```shell
git add src/components/mit-sailing/admin/newsletters src/app/[locale]/(marketing)/(site)/admin/newsletter-broadcasts/new/page.tsx src/libs/newsletter emails/newsletter-broadcast.tsx src/locales/en.json
git commit -m "feat: use react email editor for newsletter broadcasts"
```

## Task 7: README Directions And Local Verification

**Files:**
- Modify: `README.md`
- Add: `tests/e2e/AdminEmailTemplates.e2e.ts`

- [ ] **Step 1: Add README directions**

Modify `README.md` after the local admin login instructions with:

```markdown
## Email Templates

React Email templates live in `emails/` and can be previewed locally with:

```shell
npm run email:dev
```

The React Email preview server uses the `react-email` CLI and `@react-email/ui`. Admin-editable email content is managed at `/admin/email-templates` after logging in as an admin. The admin editor stores subject, preview text, editor JSON, sanitized editor body HTML, and plaintext revisions in the database; the TypeScript React Email files remain the code-owned layouts.

Use the admin editor for newsletter broadcasts, Pavilion reservation emails, event payment emails, and membership payment reminders. Keep account-security/auth emails code-owned unless a later product/security review explicitly moves them into editable revisions.
```

- [ ] **Step 2: Add e2e smoke**

Create `tests/e2e/AdminEmailTemplates.e2e.ts` based on the existing admin auth helper. The test should:

- sign in as seeded admin;
- open `/admin/email-templates`;
- open one template detail page;
- verify subject, preview, editor area, and preview iframe are visible;
- save a draft with changed text;
- verify the draft indicator appears.

- [ ] **Step 3: Run local checks**

Run:

```shell
npm run lint
npm run check:types
npm run check:i18n
npm run test
npm run test:e2e -- tests/e2e/AdminEmailTemplates.e2e.ts
npm run build-local
```

Expected: PASS. If the e2e script does not accept a file argument, run:

```shell
npm run e2e -- tests/e2e/AdminEmailTemplates.e2e.ts
```

- [ ] **Step 4: Commit docs and verification**

Run:

```shell
git add README.md tests/e2e/AdminEmailTemplates.e2e.ts
git commit -m "docs: document react email admin workflow"
```

## Task 8: Push, PR, And Finish With Context7

**Files:**
- No feature files unless final checks find issues.

- [ ] **Step 1: Confirm file budget and branch history**

Run:

```shell
git diff --name-only origin/main...HEAD | wc -l
git log --oneline --decorate --max-count=12
```

Expected: changed files below 100; branch history is rooted at current `origin/main`.

- [ ] **Step 2: Push**

Run:

```shell
git push -u origin feature/react-email-admin-editor
```

- [ ] **Step 3: Create PR**

Use GitHub CLI or app tooling. Title:

```text
feat: add admin react email editor
```

PR body must include:

- current React Email docs checked;
- template families covered;
- templates intentionally left code-owned;
- local checks run;
- note that `NEWSLETTER_MANAGE` gates `/admin/email-templates`.

- [ ] **Step 4: Finish PR with the requested skill**

Use `finish-pr-context7`:

1. inspect failing checks first;
2. fix checks before review comments;
3. inspect unresolved actionable GitHub comments only after checks are not failing;
4. use three targeted Context7 documentation passes for each library/API fix cluster;
5. commit and push fixes;
6. merge only after checks and actionable comments are clear.

Required local checks before merge:

```shell
npm run lint
npm run check:types
npm run check:i18n
npm run test
npm run build-local
```

Run e2e when admin editor UI changed:

```shell
npm run test:e2e -- tests/e2e/AdminEmailTemplates.e2e.ts
```

## Self-Review

- Spec coverage: plan covers React Email current docs, `@react-email/ui`, `@react-email/editor`, admin preview/editing, TipTap/editor export, DB-owned revisions, newsletter transactional send path, Pavilion/event/payment email families, Sentry fail-closed behavior, README directions, PR finish workflow, and intentionally code-owned account/security templates.
- Placeholder scan: no task says to add vague validation without concrete behavior; where exact implementation depends on installed package types, Task 0 makes package/API validation a hard gate.
- Type consistency: template keys are defined once in `emailTemplateKeys.ts`; registry, rendering, admin pages, and senders refer to those keys. Editor body HTML means the TipTap body fragment from `editor.getHTML()`, not the full React Email `getEmailHTML()` document.
