# Public Slug History And Legacy Redirects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add FriendlyId-style history for public app resource slugs and admin-managed legacy PHP/HTML redirects for selected old-site URLs.

**Architecture:** Keep canonical public URLs on their owning resources, store aliases in `public_slugs`, and resolve aliases only after the current resource lookup misses. Store one-off old-site redirects in `legacy_redirects`, manage them from the admin catalog, and resolve `.php`/`.html` requests through a narrow proxy path before next-intl routing. The main agent acts as project manager: dispatch one fresh worker per task, update this document as the source of status, review each worker diff, and run phase gates before continuing.

**Tech Stack:** Next.js App Router and Proxy, next-intl, TypeScript, Prisma 7 generated client, ZenStack ZModel, PostgreSQL, Vitest, Playwright, MIT Sailing catalog admin.

---

## Project Management Rules

- The main agent owns this plan document and updates the checkboxes/status notes after each worker returns.
- The main agent should not post routine status updates to the chat during execution; durable status goes in this document.
- Use one fresh worker per task. Give the worker only the task text, the repo path `/Users/andrewkelley/GitHub/mitsailing-public-slug-redirects`, and the relevant AGENTS rule paths.
- Workers edit files directly in the worktree and report changed paths plus commands run.
- After each phase, the main agent performs a code review pass before running the phase gate.
- Phase gates use the local `requesting-code-review` skill: dispatch a bounded reviewer subagent for the phase diff, fix Critical/Important findings before advancing, and record the review result here.
- Do not advance to the next phase until the phase review has no blocking findings and the listed tests pass.
- If a worker finds the plan conflicts with the codebase, stop that task and update the "Open Decisions" section rather than widening scope silently.

## Open Decisions

- None. For legacy dotted URLs, use the admin-managed `legacy_redirects` table and a narrow proxy matcher for `.php`, `.html`, and `.htm` paths. `/calendar.php -> /calendar` is a representative admin-created row, not a hard-coded redirect.

## Phase Status

- [x] Phase 1: Data model, permissions, and normalization helpers
  - Status: Task 1 complete (`4963ced`); Task 2 complete (`5c0f726`); review gate found blocking admin handler visibility issue; fix committed (`9fb0dcd`); re-review passed with no Critical/Important findings.
- [x] Phase 2: Automatic public slug history writes
  - Status: Task 3 complete; Task 4 complete (`413abe5`); review gate found Important test gaps; fixed in `54f4593`; lint cleanup `ca4c353`; re-review passed with no Critical/Important findings.
- [x] Phase 3: Public alias resolution in app routes
  - Status: Task 5 complete; Task 6 complete (`2e791de`); review gate found Important register-route intent bug; fixed in `d6dd355`; re-review passed.
- [x] Phase 4: Admin-managed legacy redirects and proxy resolution
  - Status: Task 7 complete; Task 8 complete (`dcedc82`); review gate found Important target query/hash validation gap; fixed in `e05ecb9`; re-review passed.
- [x] Phase 5: E2E smoke and final hardening
  - Status: Task 9 complete; final code review found a stale alias cleanup bug, fixed in `58f7405`; re-review passed; full gates passed. A default-worker E2E run reached the new redirect tests and both passed, then failed once in the existing `/reserve` test; the same full `npm run test:e2e` gate passed with `PLAYWRIGHT_WORKERS=1` (80 passed, 2 skipped).

## File Structure

- `zenstack/schema.zmodel`: source schema for `PublicSlug`, `LegacyRedirect`, and source enums.
- `prisma/schema.prisma`: generated Prisma schema after ZenStack generation; review generated diffs.
- `prisma/migrations/20260520090000_public_slugs_legacy_redirects/migration.sql`: SQL migration for tables, enums, indexes, and constraints.
- `src/libs/auth/appPermissions.ts`: adds `PUBLIC_REDIRECTS_MANAGE` for `ADMIN`, `DOCK_STAFF`, and `DOCK_MASTER`.
- `src/libs/admin/catalog/catalogPermissions.ts`: maps `public_slugs` and `legacy_redirects` to the new permission.
- `src/libs/admin/catalog/catalogDefinitions.ts`: adds read-only `public_slugs` list and editable `legacy_redirects` admin resource.
- `src/libs/admin/catalog/catalogServerRegistry.ts`: registers handlers for both new resources.
- `src/libs/admin/catalog/publicSlugCatalogHandlers.ts`: read-only list/delete handler for automatic history rows.
- `src/libs/admin/catalog/legacyRedirectCatalogHandlers.ts`: create/update/delete handlers for admin legacy redirects.
- `src/libs/admin/catalog/legacyRedirectSchemas.ts`: Zod validation for source/target paths and source provenance.
- `src/libs/mit-sailing/publicSlugHistory.ts`: history write helpers used by admin mutations.
- `src/libs/mit-sailing/publicSlugRedirects.ts`: public alias lookup and canonical target helpers.
- `src/libs/mit-sailing/legacyRedirects.ts`: path normalization, admin validation, and runtime redirect lookup.
- `src/libs/admin/events/eventAdminActions.ts`: records event slug history on event slug changes and cleanup on delete.
- `src/libs/admin/catalog/cmsCatalogHandlers.ts`: records CMS path history on path changes and cleanup on delete.
- `src/libs/admin/catalog/sailingClassesHandlers.ts`: records class slug history on slug changes and cleanup on delete.
- `src/libs/admin/catalog/fleetCatalogHandlers.ts`: records fleet slug history on slug changes and cleanup on delete.
- `src/app/[locale]/(marketing)/(site)/[...cmsPath]/page.tsx`: redirects old CMS paths after current path lookup misses.
- `src/app/[locale]/(marketing)/(site)/events/[slug]/page.tsx`: redirects old event slugs after current lookup misses.
- `src/app/[locale]/(marketing)/(site)/events/[slug]/register/page.tsx`: redirects old event slugs before auth/login callback handling.
- `src/app/[locale]/(marketing)/(site)/classes/[slug]/page.tsx`: redirects old class slugs after current lookup misses.
- `src/app/[locale]/(marketing)/(site)/fleet/[slug]/page.tsx`: redirects old fleet slugs after current lookup misses.
- `src/proxy.ts`: resolves dotted legacy redirects before next-intl, using a matcher that still excludes unrelated static assets.
- `src/locales/en.json`: labels and errors for the new admin resources.
- Tests are co-located with the implementation files or in `tests/e2e/MitSailingCatalog.e2e.ts`.

---

## Phase 1: Data Model, Permissions, And Normalization

### Task 1: Add Schema And Migration

**Files:**
- Modify: `zenstack/schema.zmodel`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260520090000_public_slugs_legacy_redirects/migration.sql`
- Test: `src/libs/mit-sailing/publicSlugSchemaContract.test.ts`

- [x] **Step 1: Write the failing schema contract test**

Create `src/libs/mit-sailing/publicSlugSchemaContract.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('public slug and legacy redirect schema', () => {
  it('defines public slug history and legacy redirect tables', () => {
    const schema = readRepoFile('prisma/schema.prisma');

    expect(schema).toContain('model PublicSlug');
    expect(schema).toContain('model LegacyRedirect');
    expect(schema).toContain('@@unique([slug, sluggableType, scope])');
    expect(schema).toContain('@@index([sluggableType, sluggableId])');
    expect(schema).toContain('sourcePath String @unique() @map("source_path")');
    expect(schema).toContain('@@map("public_slugs")');
    expect(schema).toContain('@@map("legacy_redirects")');
  });
});
```

- [x] **Step 2: Run the failing schema contract test**

Run: `npm run test -- src/libs/mit-sailing/publicSlugSchemaContract.test.ts`

Expected: FAIL because `PublicSlug` and `LegacyRedirect` do not exist.

- [x] **Step 3: Add enums and models to `zenstack/schema.zmodel`**

Insert this near the CMS/public catalog models:

```prisma
enum PublicSlugSource {
  automatic
  migration
  manual

  @@map("public_slug_source")
}

enum LegacyRedirectSource {
  ai_migration
  manual

  @@map("legacy_redirect_source")
}

model PublicSlug {
  id             String           @id @default(cuid())
  slug           String
  sluggableType  String           @map("sluggable_type")
  sluggableId    String           @map("sluggable_id")
  scope          String
  source         PublicSlugSource @default(automatic)
  createdAt      DateTime         @default(now()) @map("created_at")

  @@unique([slug, sluggableType, scope])
  @@index([sluggableType, sluggableId])
  @@index([scope, slug])
  @@allow('read,create,update,delete', auth() != null && (
    auth().appRole == 'admin' ||
    auth().appRole == 'dock_staff' ||
    auth().appRole == 'dock_master'
  ))
  @@map("public_slugs")
}

model LegacyRedirect {
  id         String               @id @default(cuid())
  sourcePath String               @unique @map("source_path")
  targetPath String               @map("target_path")
  source     LegacyRedirectSource @default(manual)
  createdAt  DateTime             @default(now()) @map("created_at")

  @@index([source])
  @@allow('read,create,update,delete', auth() != null && (
    auth().appRole == 'admin' ||
    auth().appRole == 'dock_staff' ||
    auth().appRole == 'dock_master'
  ))
  @@map("legacy_redirects")
}
```

- [x] **Step 4: Generate and review schema artifacts**

Run:

```bash
npx zen check --schema zenstack/schema.zmodel
npx zen generate --schema zenstack/schema.zmodel
npx prisma generate
```

Expected: ZenStack check passes; generated `prisma/schema.prisma` contains the models from Step 3.

- [x] **Step 5: Add the SQL migration**

Create `prisma/migrations/20260520090000_public_slugs_legacy_redirects/migration.sql`:

```sql
CREATE TYPE "public_slug_source" AS ENUM ('automatic', 'migration', 'manual');

CREATE TYPE "legacy_redirect_source" AS ENUM ('ai_migration', 'manual');

CREATE TABLE "public_slugs" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "sluggable_type" TEXT NOT NULL,
  "sluggable_id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "source" "public_slug_source" NOT NULL DEFAULT 'automatic',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "public_slugs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legacy_redirects" (
  "id" TEXT NOT NULL,
  "source_path" TEXT NOT NULL,
  "target_path" TEXT NOT NULL,
  "source" "legacy_redirect_source" NOT NULL DEFAULT 'manual',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legacy_redirects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "public_slugs_slug_sluggable_type_scope_key"
  ON "public_slugs"("slug", "sluggable_type", "scope");

CREATE INDEX "public_slugs_sluggable_type_sluggable_id_idx"
  ON "public_slugs"("sluggable_type", "sluggable_id");

CREATE INDEX "public_slugs_scope_slug_idx"
  ON "public_slugs"("scope", "slug");

CREATE UNIQUE INDEX "legacy_redirects_source_path_key"
  ON "legacy_redirects"("source_path");

CREATE INDEX "legacy_redirects_source_idx"
  ON "legacy_redirects"("source");
```

- [x] **Step 6: Run the schema contract test**

Run: `npm run test -- src/libs/mit-sailing/publicSlugSchemaContract.test.ts`

Expected: PASS.

- [x] **Step 7: Commit Phase 1 schema work**

```bash
git add zenstack/schema.zmodel prisma/schema.prisma prisma/migrations/20260520090000_public_slugs_legacy_redirects/migration.sql src/libs/mit-sailing/publicSlugSchemaContract.test.ts
git commit -m "feat: add public slug and legacy redirect schema"
```

### Task 2: Add Permissions And Admin Catalog Definitions

**Files:**
- Modify: `src/libs/auth/appPermissions.ts`
- Modify: `src/libs/auth/appPermissions.test.ts`
- Modify: `src/libs/admin/catalog/catalogPermissions.ts`
- Modify: `src/libs/admin/catalog/catalogPermissions.test.ts`
- Modify: `src/libs/admin/catalog/catalogDefinitions.ts`
- Modify: `src/libs/admin/catalog/catalogDefinitions.test.ts`
- Modify: `src/locales/en.json`

- [x] **Step 1: Write failing permission tests**

Add to `src/libs/auth/appPermissions.test.ts`:

```ts
it('allows dock staff and dock masters to manage public redirects', () => {
  expect(
    hasPermission(
      getAppRolePermissions(Role.DOCK_STAFF),
      Permission.PUBLIC_REDIRECTS_MANAGE
    )
  ).toBe(true);
  expect(
    hasPermission(
      getAppRolePermissions(Role.DOCK_MASTER),
      Permission.PUBLIC_REDIRECTS_MANAGE
    )
  ).toBe(true);
  expect(
    hasPermission(
      getAppRolePermissions(Role.ADMIN),
      Permission.PUBLIC_REDIRECTS_MANAGE
    )
  ).toBe(true);
});
```

Add to `src/libs/admin/catalog/catalogPermissions.test.ts`:

```ts
it('maps redirect resources to the public redirects permission', () => {
  expect(
    catalogPermissionForOperation({
      operation: 'view',
      resourceId: 'legacy_redirects',
    })
  ).toBe(Permission.PUBLIC_REDIRECTS_MANAGE);
  expect(
    catalogPermissionForOperation({
      operation: 'delete',
      resourceId: 'public_slugs',
    })
  ).toBe(Permission.PUBLIC_REDIRECTS_MANAGE);
});
```

- [x] **Step 2: Run the failing permission tests**

Run: `npm run test -- src/libs/auth/appPermissions.test.ts src/libs/admin/catalog/catalogPermissions.test.ts`

Expected: FAIL because `PUBLIC_REDIRECTS_MANAGE`, `public_slugs`, and `legacy_redirects` are not registered.

- [x] **Step 3: Add `PUBLIC_REDIRECTS_MANAGE`**

In `src/libs/auth/appPermissions.ts`, add:

```ts
PUBLIC_REDIRECTS_MANAGE: 'publicRedirects.manage',
```

Then include it in `Role.DOCK_STAFF`, `Role.DOCK_MASTER`, and `Role.ADMIN` gets it through `ALL_PERMISSIONS`.

- [x] **Step 4: Add catalog resource ids and definitions**

In `src/libs/admin/catalog/catalogDefinitions.ts`, add definitions:

```ts
const publicSlugsDefinition = {
  id: 'public_slugs',
  titleKey: 'title_admin_public_slugs',
  metaTitleKey: 'meta_title_admin_public_slugs',
  hubLabelKey: 'hub_label_public_slugs',
  listColumns: [
    { field: 'slug', kind: 'string', headerKey: 'column_slug_label' },
    { field: 'scope', kind: 'string', headerKey: 'column_scope' },
    {
      field: 'sluggableType',
      kind: 'string',
      headerKey: 'column_sluggable_type',
    },
    { field: 'targetPath', kind: 'url', headerKey: 'column_target_path' },
    { field: 'source', kind: 'string', headerKey: 'column_source' },
  ],
  formFields: [],
  capabilities: {
    create: false,
    update: false,
    delete: true,
    reorder: false,
  },
} as const satisfies CatalogResourceDefinition;

const legacyRedirectsDefinition = {
  id: 'legacy_redirects',
  titleKey: 'title_admin_legacy_redirects',
  metaTitleKey: 'meta_title_admin_legacy_redirects',
  hubLabelKey: 'hub_label_legacy_redirects',
  listColumns: [
    { field: 'sourcePath', kind: 'string', headerKey: 'column_source_path' },
    { field: 'targetPath', kind: 'url', headerKey: 'column_target_path' },
    { field: 'source', kind: 'string', headerKey: 'column_source' },
  ],
  formFields: [
    {
      field: 'sourcePath',
      kind: 'string',
      required: true,
      labelKey: 'field_source_path',
    },
    {
      field: 'targetPath',
      kind: 'string',
      required: true,
      labelKey: 'field_target_path',
    },
    {
      field: 'source',
      kind: 'select',
      required: true,
      labelKey: 'field_source',
      selectOptions: [
        { value: 'manual', labelKey: 'source_manual' },
        { value: 'ai_migration', labelKey: 'source_ai_migration' },
      ],
    },
  ],
  capabilities: {
    create: true,
    update: true,
    delete: true,
    reorder: false,
  },
} as const satisfies CatalogResourceDefinition;
```

Append both definitions to the exported catalog definitions array/map.

- [x] **Step 5: Add permission mapping**

In `src/libs/admin/catalog/catalogPermissions.ts`, include:

```ts
public_slugs: Permission.PUBLIC_REDIRECTS_MANAGE,
legacy_redirects: Permission.PUBLIC_REDIRECTS_MANAGE,
```

- [x] **Step 6: Add locale messages**

In `src/locales/en.json`, under `MitSailingRoutes` and `AdminCatalogResource`, add keys used above:

```json
"title_admin_public_slugs": "Public slug history",
"meta_title_admin_public_slugs": "Public slug history",
"title_admin_legacy_redirects": "Legacy redirects",
"meta_title_admin_legacy_redirects": "Legacy redirects",
"hub_label_public_slugs": "Public slug history",
"hub_label_legacy_redirects": "Legacy redirects",
"column_scope": "Scope",
"column_sluggable_type": "Resource type",
"column_target_path": "Target path",
"column_source": "Source",
"column_source_path": "Source path",
"field_source_path": "Source path",
"field_target_path": "Target path",
"field_source": "Source",
"source_manual": "Manual",
"source_ai_migration": "AI migration",
"form_error_duplicate_source_path": "A redirect with this source path already exists.",
"form_error_invalid_redirect_path": "Use an app path that starts with /."
```

- [x] **Step 7: Run permission and definition tests**

Run: `npm run test -- src/libs/auth/appPermissions.test.ts src/libs/admin/catalog/catalogPermissions.test.ts src/libs/admin/catalog/catalogDefinitions.test.ts`

Expected: PASS.

- [x] **Step 8: Commit Phase 1 admin scaffolding**

```bash
git add src/libs/auth/appPermissions.ts src/libs/auth/appPermissions.test.ts src/libs/admin/catalog/catalogPermissions.ts src/libs/admin/catalog/catalogPermissions.test.ts src/libs/admin/catalog/catalogDefinitions.ts src/libs/admin/catalog/catalogDefinitions.test.ts src/locales/en.json
git commit -m "feat: add redirect admin catalog permissions"
```

### Phase 1 Review Gate

- [x] **Step 1: Main-agent review** _(blocking finding fixed in `9fb0dcd`; reviewer re-check passed; ZenStack role checks documented as plan-required ZModel policy because app permissions are TypeScript-only)_

Run:

```bash
git diff origin/main...HEAD -- zenstack/schema.zmodel prisma/schema.prisma src/libs/auth/appPermissions.ts src/libs/admin/catalog/catalogDefinitions.ts src/libs/admin/catalog/catalogPermissions.ts
```

Review for:
- no duplicated role checks outside the named permission;
- generated schema matches ZModel;
- admin resources are registered with exact locale keys;
- `public_slugs` is not manually editable except delete cleanup.

- [x] **Step 2: Phase 1 tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/publicSlugSchemaContract.test.ts src/libs/auth/appPermissions.test.ts src/libs/admin/catalog/catalogPermissions.test.ts src/libs/admin/catalog/catalogDefinitions.test.ts
npm run check:i18n
```

Expected: PASS.

---

## Phase 2: Automatic Public Slug History Writes

### Task 3: Add History Helper Tests And Implementation

**Files:**
- Create: `src/libs/mit-sailing/publicSlugHistory.ts`
- Create: `src/libs/mit-sailing/publicSlugHistory.test.ts`

- [x] **Step 1: Write failing helper tests**

Create `src/libs/mit-sailing/publicSlugHistory.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMany = vi.fn();
const deleteMany = vi.fn();

vi.mock('@/libs/DB', () => ({
  prisma: {
    publicSlug: {
      createMany,
      deleteMany,
    },
  },
}));

describe('publicSlugHistory', () => {
  beforeEach(() => {
    createMany.mockReset();
    deleteMany.mockReset();
  });

  it('records previous aliases and removes aliases matching the new canonical value', async () => {
    const { recordPublicSlugHistory } = await import(
      '@/libs/mit-sailing/publicSlugHistory'
    );

    await recordPublicSlugHistory({
      currentSlug: 'new-path',
      previousSlug: 'old-path',
      scope: 'classes',
      sluggableId: 'class-1',
      sluggableType: 'SailingClass',
    });

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        scope: 'classes',
        slug: 'new-path',
        sluggableId: 'class-1',
        sluggableType: 'SailingClass',
      },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          scope: 'classes',
          slug: 'old-path',
          sluggableId: 'class-1',
          sluggableType: 'SailingClass',
          source: 'automatic',
        },
      ],
      skipDuplicates: true,
    });
  });

  it('does not create history when the public value is unchanged', async () => {
    const { recordPublicSlugHistory } = await import(
      '@/libs/mit-sailing/publicSlugHistory'
    );

    await recordPublicSlugHistory({
      currentSlug: 'same-path',
      previousSlug: 'same-path',
      scope: 'cms',
      sluggableId: 'page-1',
      sluggableType: 'CmsPage',
    });

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        scope: 'cms',
        slug: 'same-path',
        sluggableId: 'page-1',
        sluggableType: 'CmsPage',
      },
    });
    expect(createMany).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run the failing helper tests**

Run: `npm run test -- src/libs/mit-sailing/publicSlugHistory.test.ts`

Expected: FAIL because `publicSlugHistory.ts` does not exist.

- [x] **Step 3: Implement `publicSlugHistory.ts`**

```ts
import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/DB';

export type PublicSlugScope = 'classes' | 'cms' | 'events' | 'fleet';
export type PublicSluggableType =
  | 'CmsPage'
  | 'Event'
  | 'FleetBoat'
  | 'SailingClass';
export type PublicSlugSource = 'automatic' | 'manual' | 'migration';

type PublicSlugDb = typeof prisma | Prisma.TransactionClient;

type PublicSlugHistoryOptions = {
  currentSlug: string;
  db?: PublicSlugDb;
  previousSlug: string;
  scope: PublicSlugScope;
  sluggableId: string;
  sluggableType: PublicSluggableType;
  source?: PublicSlugSource;
};

export async function recordPublicSlugHistory(
  options: PublicSlugHistoryOptions
): Promise<void> {
  const db = options.db ?? prisma;
  await db.publicSlug.deleteMany({
    where: {
      scope: options.scope,
      slug: options.currentSlug,
      sluggableId: options.sluggableId,
      sluggableType: options.sluggableType,
    },
  });

  if (options.previousSlug === options.currentSlug) {
    return;
  }

  await db.publicSlug.createMany({
    data: [
      {
        scope: options.scope,
        slug: options.previousSlug,
        sluggableId: options.sluggableId,
        sluggableType: options.sluggableType,
        source: options.source ?? 'automatic',
      },
    ],
    skipDuplicates: true,
  });
}

export async function deletePublicSlugHistoryForTarget(options: {
  db?: PublicSlugDb;
  sluggableId: string;
  sluggableType: PublicSluggableType;
}): Promise<void> {
  const db = options.db ?? prisma;
  await db.publicSlug.deleteMany({
    where: {
      sluggableId: options.sluggableId,
      sluggableType: options.sluggableType,
    },
  });
}
```

- [x] **Step 4: Run the helper tests**

Run: `npm run test -- src/libs/mit-sailing/publicSlugHistory.test.ts`

Expected: PASS.

### Task 4: Record History From Catalog And Event Mutations

**Files:**
- Modify: `src/libs/admin/catalog/cmsCatalogHandlers.ts`
- Modify: `src/libs/admin/catalog/sailingClassesHandlers.ts`
- Modify: `src/libs/admin/catalog/fleetCatalogHandlers.ts`
- Modify: `src/libs/admin/events/eventAdminActions.ts`
- Modify: related tests for each changed handler/action

- [x] **Step 1: Write failing handler tests**

Add focused tests to existing handler/action test files. The expected calls should look like this after mocking `recordPublicSlugHistory`:

```ts
expect(recordPublicSlugHistory).toHaveBeenCalledWith({
  currentSlug: '/new-about',
  db: expect.anything(),
  previousSlug: '/old-about',
  scope: 'cms',
  sluggableId: 'page-1',
  sluggableType: 'CmsPage',
});
```

```ts
expect(recordPublicSlugHistory).toHaveBeenCalledWith({
  currentSlug: 'new-class',
  db: expect.anything(),
  previousSlug: 'old-class',
  scope: 'classes',
  sluggableId: 'class-1',
  sluggableType: 'SailingClass',
});
```

```ts
expect(recordPublicSlugHistory).toHaveBeenCalledWith({
  currentSlug: 'new-boat',
  db: expect.anything(),
  previousSlug: 'old-boat',
  scope: 'fleet',
  sluggableId: 'boat-1',
  sluggableType: 'FleetBoat',
});
```

```ts
expect(recordPublicSlugHistory).toHaveBeenCalledWith({
  currentSlug: 'new-event',
  db: expect.anything(),
  previousSlug: 'old-event',
  scope: 'events',
  sluggableId: 'event-1',
  sluggableType: 'Event',
});
```

- [x] **Step 2: Run the failing mutation tests**

Run:

```bash
npm run test -- src/libs/admin/catalog/cmsCatalogHandlers.test.ts src/libs/admin/catalog/catalogActions.test.ts src/libs/admin/events/eventAdminActions.test.ts
```

Expected: FAIL because slug history is not recorded yet.

- [x] **Step 3: Update CMS page update/delete**

In `cmsCatalogHandlers.ts`, import:

```ts
import {
  deletePublicSlugHistoryForTarget,
  recordPublicSlugHistory,
} from '@/libs/mit-sailing/publicSlugHistory';
```

Inside the CMS page update transaction, load the previous `path`, update the row, then call:

```ts
await recordPublicSlugHistory({
  currentSlug: data.path,
  db: tx,
  previousSlug: snapshot.page.path,
  scope: 'cms',
  sluggableId: id,
  sluggableType: 'CmsPage',
});
```

Inside CMS page delete transaction before deleting the page, call:

```ts
await deletePublicSlugHistoryForTarget({
  db: tx,
  sluggableId: id,
  sluggableType: 'CmsPage',
});
```

- [x] **Step 4: Update sailing class update/delete**

Inside the sailing class update transaction, after loading the snapshot and updating the row:

```ts
await recordPublicSlugHistory({
  currentSlug: data.slug,
  db: tx,
  previousSlug: snapshot.item.slug,
  scope: 'classes',
  sluggableId: id,
  sluggableType: 'SailingClass',
});
```

Inside delete:

```ts
await deletePublicSlugHistoryForTarget({
  db: tx,
  sluggableId: id,
  sluggableType: 'SailingClass',
});
```

- [x] **Step 5: Update fleet update/delete**

Inside the fleet update transaction:

```ts
await recordPublicSlugHistory({
  currentSlug: data.slug,
  db: tx,
  previousSlug: snapshot.item.slug,
  scope: 'fleet',
  sluggableId: id,
  sluggableType: 'FleetBoat',
});
```

Inside delete:

```ts
await deletePublicSlugHistoryForTarget({
  db: tx,
  sluggableId: id,
  sluggableType: 'FleetBoat',
});
```

- [x] **Step 6: Update event update/delete**

In `eventAdminActions.ts`, record history only when the event exists and the submitted slug is valid:

```ts
await recordPublicSlugHistory({
  currentSlug: data.slug,
  db: tx,
  previousSlug: existing.slug,
  scope: 'events',
  sluggableId: existing.id,
  sluggableType: 'Event',
});
```

Before deleting an event:

```ts
await deletePublicSlugHistoryForTarget({
  db: tx,
  sluggableId: event.id,
  sluggableType: 'Event',
});
```

- [x] **Step 7: Run mutation tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/publicSlugHistory.test.ts src/libs/admin/catalog/cmsCatalogHandlers.test.ts src/libs/admin/catalog/catalogActions.test.ts src/libs/admin/events/eventAdminActions.test.ts
```

Expected: PASS.

- [x] **Step 8: Commit Phase 2 mutation work**

```bash
git add src/libs/mit-sailing/publicSlugHistory.ts src/libs/mit-sailing/publicSlugHistory.test.ts src/libs/admin/catalog/cmsCatalogHandlers.ts src/libs/admin/catalog/cmsCatalogHandlers.test.ts src/libs/admin/catalog/sailingClassesHandlers.ts src/libs/admin/catalog/fleetCatalogHandlers.ts src/libs/admin/catalog/catalogActions.test.ts src/libs/admin/events/eventAdminActions.ts src/libs/admin/events/eventAdminActions.test.ts
git commit -m "feat: record public slug history on admin changes"
```

### Phase 2 Review Gate

- [x] **Step 1: Main-agent review** _(blocking test-coverage findings fixed in `54f4593`; re-review passed)_

Run:

```bash
git diff origin/main...HEAD -- src/libs/mit-sailing/publicSlugHistory.ts src/libs/admin/catalog/cmsCatalogHandlers.ts src/libs/admin/catalog/sailingClassesHandlers.ts src/libs/admin/catalog/fleetCatalogHandlers.ts src/libs/admin/events/eventAdminActions.ts
```

Review for:
- history writes are in the same transaction as canonical row updates;
- unchanged slug/path updates remove stale self-aliases but do not create rows;
- deletes remove history rows for the target;
- no history is created from title/name changes alone.

- [x] **Step 2: Phase 2 tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/publicSlugHistory.test.ts src/libs/admin/catalog/cmsCatalogHandlers.test.ts src/libs/admin/catalog/catalogActions.test.ts src/libs/admin/events/eventAdminActions.test.ts
```

Expected: PASS.

---

## Phase 3: Public Alias Resolution

### Task 5: Add Redirect Resolver

**Files:**
- Create: `src/libs/mit-sailing/publicSlugRedirects.ts`
- Create: `src/libs/mit-sailing/publicSlugRedirects.test.ts`

- [x] **Step 1: Write failing resolver tests**

Create `src/libs/mit-sailing/publicSlugRedirects.test.ts` with cases:

```ts
it('returns event canonical paths for published history targets', async () => {
  publicSlugFindFirst.mockResolvedValue({
    sluggableId: 'event-1',
    sluggableType: 'Event',
  });
  eventFindUnique.mockResolvedValue({
    isPublished: true,
    slug: 'new-event',
  });

  await expect(
    resolvePublicSlugRedirect({
      locale: 'en',
      scope: 'events',
      slug: 'old-event',
    })
  ).resolves.toBe('/events/new-event');
});

it('returns null for hidden class history targets', async () => {
  publicSlugFindFirst.mockResolvedValue({
    sluggableId: 'class-1',
    sluggableType: 'SailingClass',
  });
  sailingClassFindUnique.mockResolvedValue({
    isVisible: false,
    slug: 'new-class',
  });

  await expect(
    resolvePublicSlugRedirect({
      locale: 'en',
      scope: 'classes',
      slug: 'old-class',
    })
  ).resolves.toBeNull();
});
```

- [x] **Step 2: Run the failing resolver tests**

Run: `npm run test -- src/libs/mit-sailing/publicSlugRedirects.test.ts`

Expected: FAIL because the resolver does not exist.

- [x] **Step 3: Implement resolver**

Create `src/libs/mit-sailing/publicSlugRedirects.ts`:

```ts
import 'server-only';
import { prisma } from '@/libs/DB';
import type {
  PublicSlugScope,
  PublicSluggableType,
} from '@/libs/mit-sailing/publicSlugHistory';
import { getI18nPath } from '@/utils/Helpers';

type ResolvePublicSlugRedirectOptions = {
  locale: string;
  scope: PublicSlugScope;
  slug: string;
};

function targetPathForSlug(options: {
  locale: string;
  scope: PublicSlugScope;
  slug: string;
}): string {
  if (options.scope === 'cms') {
    return getI18nPath(options.slug, options.locale);
  }
  if (options.scope === 'events') {
    return getI18nPath(`/events/${options.slug}`, options.locale);
  }
  if (options.scope === 'classes') {
    return getI18nPath(`/classes/${options.slug}`, options.locale);
  }
  return getI18nPath(`/fleet/${options.slug}`, options.locale);
}

async function canonicalSlugForTarget(options: {
  sluggableId: string;
  sluggableType: PublicSluggableType;
}): Promise<{ scope: PublicSlugScope; slug: string } | null> {
  if (options.sluggableType === 'CmsPage') {
    const page = await prisma.cmsPage.findUnique({
      where: { id: options.sluggableId, isPublished: true },
      select: { path: true },
    });
    return page ? { scope: 'cms', slug: page.path } : null;
  }
  if (options.sluggableType === 'Event') {
    const event = await prisma.event.findUnique({
      where: { id: options.sluggableId, isPublished: true },
      select: { slug: true },
    });
    return event ? { scope: 'events', slug: event.slug } : null;
  }
  if (options.sluggableType === 'SailingClass') {
    const sailingClass = await prisma.sailingClass.findUnique({
      where: { id: options.sluggableId, isVisible: true },
      select: { slug: true },
    });
    return sailingClass
      ? { scope: 'classes', slug: sailingClass.slug }
      : null;
  }
  const boat = await prisma.fleetBoat.findUnique({
    where: { id: options.sluggableId },
    select: { slug: true },
  });
  return boat ? { scope: 'fleet', slug: boat.slug } : null;
}

export async function resolvePublicSlugRedirect(
  options: ResolvePublicSlugRedirectOptions
): Promise<string | null> {
  const row = await prisma.publicSlug.findFirst({
    where: {
      scope: options.scope,
      slug: options.slug,
    },
    select: {
      sluggableId: true,
      sluggableType: true,
    },
  });
  if (!row) {
    return null;
  }

  const canonical = await canonicalSlugForTarget({
    sluggableId: row.sluggableId,
    sluggableType: row.sluggableType as PublicSluggableType,
  });
  if (!canonical || canonical.slug === options.slug) {
    return null;
  }

  return targetPathForSlug({
    locale: options.locale,
    scope: canonical.scope,
    slug: canonical.slug,
  });
}
```

- [x] **Step 4: Run resolver tests**

Run: `npm run test -- src/libs/mit-sailing/publicSlugRedirects.test.ts`

Expected: PASS.

### Task 6: Wire Alias Redirects Into Public Pages

**Files:**
- Modify: `src/app/[locale]/(marketing)/(site)/[...cmsPath]/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/events/[slug]/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/events/[slug]/register/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/classes/[slug]/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/fleet/[slug]/page.tsx`
- Test: add or extend page tests beside these route modules when existing patterns allow direct imports

- [x] **Step 1: Add page tests for redirect-before-404 behavior**

Mock `next/navigation` with `permanentRedirect` throwing `NEXT_REDIRECT:<path>` and `notFound` throwing `NEXT_NOT_FOUND`. For each route, assert a missing current resource and found history alias redirects:

```ts
await expect(ClassDetailPage({
  params: Promise.resolve({ locale: 'en', slug: 'old-class' }),
})).rejects.toThrow('NEXT_REDIRECT:/classes/new-class');
```

Also assert missing current resource and no history alias still calls `notFound`.

- [x] **Step 2: Run the failing page tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/publicSlugRedirects.test.ts
```

Expected: resolver tests pass; new page tests fail until the route modules call the resolver.

- [x] **Step 3: Update CMS catch-all**

In `src/app/[locale]/(marketing)/(site)/[...cmsPath]/page.tsx`, import:

```ts
import { permanentRedirect } from 'next/navigation';
import { resolvePublicSlugRedirect } from '@/libs/mit-sailing/publicSlugRedirects';
```

After the current `loadPublishedCmsPageByPath` miss:

```ts
const redirectPath = await resolvePublicSlugRedirect({
  locale,
  scope: 'cms',
  slug: pathFromSegments(cmsPath),
});
if (redirectPath) {
  permanentRedirect(redirectPath);
}
notFound();
```

- [x] **Step 4: Update event detail and register pages**

After current event lookup misses in the detail page:

```ts
const redirectPath = await resolvePublicSlugRedirect({
  locale,
  scope: 'events',
  slug,
});
if (redirectPath) {
  permanentRedirect(redirectPath);
}
notFound();
```

In the register page, do the same before `requireCurrentUser` or any login callback redirect.

- [x] **Step 5: Update class and fleet pages**

For classes:

```ts
const redirectPath = await resolvePublicSlugRedirect({
  locale,
  scope: 'classes',
  slug,
});
if (redirectPath) {
  permanentRedirect(redirectPath);
}
notFound();
```

For fleet:

```ts
const redirectPath = await resolvePublicSlugRedirect({
  locale,
  scope: 'fleet',
  slug,
});
if (redirectPath) {
  permanentRedirect(redirectPath);
}
notFound();
```

- [x] **Step 6: Run public redirect tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/publicSlugRedirects.test.ts src/libs/mit-sailing/cmsQueries.test.ts src/libs/mit-sailing/classQueries.test.ts src/libs/mit-sailing/fleetQueries.test.ts src/libs/mit-sailing/eventQueries.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit Phase 3 route work**

```bash
git add src/libs/mit-sailing/publicSlugRedirects.ts src/libs/mit-sailing/publicSlugRedirects.test.ts 'src/app/[locale]/(marketing)/(site)/[...cmsPath]/page.tsx' 'src/app/[locale]/(marketing)/(site)/events/[slug]/page.tsx' 'src/app/[locale]/(marketing)/(site)/events/[slug]/register/page.tsx' 'src/app/[locale]/(marketing)/(site)/classes/[slug]/page.tsx' 'src/app/[locale]/(marketing)/(site)/fleet/[slug]/page.tsx'
git commit -m "feat: redirect public slug history aliases"
```

### Phase 3 Review Gate

- [x] **Step 1: Main-agent review** _(blocking register intent finding fixed in `d6dd355`; re-review passed)_

Run:

```bash
git diff origin/main...HEAD -- src/libs/mit-sailing/publicSlugRedirects.ts 'src/app/[locale]/(marketing)/(site)'
```

Review for:
- current resource lookup happens before history;
- redirects happen before `notFound`;
- unpublished/hidden targets return 404;
- redirect loops are impossible when alias equals current canonical value;
- no public URL includes `/en`.

- [x] **Step 2: Phase 3 tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/publicSlugRedirects.test.ts src/libs/mit-sailing/cmsQueries.test.ts src/libs/mit-sailing/classQueries.test.ts src/libs/mit-sailing/fleetQueries.test.ts src/libs/mit-sailing/eventQueries.test.ts
```

Expected: PASS.

---

## Phase 4: Admin-Managed Legacy Redirects

### Task 7: Add Legacy Redirect Validation And Catalog Handlers

**Files:**
- Create: `src/libs/mit-sailing/legacyRedirects.ts`
- Create: `src/libs/mit-sailing/legacyRedirects.test.ts`
- Create: `src/libs/admin/catalog/legacyRedirectSchemas.ts`
- Create: `src/libs/admin/catalog/legacyRedirectSchemas.test.ts`
- Create: `src/libs/admin/catalog/legacyRedirectCatalogHandlers.ts`
- Create: `src/libs/admin/catalog/publicSlugCatalogHandlers.ts`
- Modify: `src/libs/admin/catalog/catalogServerRegistry.ts`

- [x] **Step 1: Write validation tests**

Create `src/libs/mit-sailing/legacyRedirects.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  normalizeLegacyRedirectPath,
  normalizeLegacyRedirectTargetPath,
} from '@/libs/mit-sailing/legacyRedirects';

describe('legacyRedirects', () => {
  it('normalizes source paths and drops query strings', () => {
    expect(normalizeLegacyRedirectPath('calendar.php?view=month')).toBe(
      '/calendar.php'
    );
    expect(normalizeLegacyRedirectPath('/info/boats.php/')).toBe(
      '/info/boats.php'
    );
  });

  it('accepts only internal target paths', () => {
    expect(normalizeLegacyRedirectTargetPath('/calendar')).toBe('/calendar');
    expect(normalizeLegacyRedirectTargetPath('https://example.com')).toBeNull();
    expect(normalizeLegacyRedirectTargetPath('/api/private')).toBeNull();
  });
});
```

- [x] **Step 2: Run the failing validation tests**

Run: `npm run test -- src/libs/mit-sailing/legacyRedirects.test.ts`

Expected: FAIL because `legacyRedirects.ts` does not exist.

- [x] **Step 3: Implement `legacyRedirects.ts`**

```ts
import 'server-only';
import { prisma } from '@/libs/DB';
import { getI18nPath } from '@/utils/Helpers';

const LEGACY_DOTTED_PATH_PATTERN = /^\/(?:[\w.-]+\/)*[\w.-]+\.(?:php|html?)$/i;

export function normalizeLegacyRedirectPath(value: string): string | null {
  const withoutQuery = value.trim().split('?')[0]?.trim() ?? '';
  const withSlash = withoutQuery.startsWith('/')
    ? withoutQuery
    : `/${withoutQuery}`;
  const normalized =
    withSlash.length > 1 ? withSlash.replace(/\/+$/u, '') : withSlash;
  return LEGACY_DOTTED_PATH_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeLegacyRedirectTargetPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null;
  }
  if (
    trimmed.startsWith('/api/') ||
    trimmed.startsWith('/_next/') ||
    trimmed.startsWith('/monitoring/')
  ) {
    return null;
  }
  return trimmed.length > 1 ? trimmed.replace(/\/+$/u, '') : trimmed;
}

export async function resolveLegacyRedirect(options: {
  locale: string;
  pathname: string;
}): Promise<string | null> {
  const sourcePath = normalizeLegacyRedirectPath(options.pathname);
  if (!sourcePath) {
    return null;
  }
  const row = await prisma.legacyRedirect.findUnique({
    where: { sourcePath },
    select: { targetPath: true },
  });
  if (!row) {
    return null;
  }
  const targetPath = normalizeLegacyRedirectTargetPath(row.targetPath);
  return targetPath ? getI18nPath(targetPath, options.locale) : null;
}
```

- [x] **Step 4: Add catalog schemas**

Create `src/libs/admin/catalog/legacyRedirectSchemas.ts`:

```ts
import * as z from 'zod';
import {
  normalizeLegacyRedirectPath,
  normalizeLegacyRedirectTargetPath,
} from '@/libs/mit-sailing/legacyRedirects';

export const legacyRedirectFormSchema = z.object({
  source: z.enum(['ai_migration', 'manual']),
  sourcePath: z.string().transform((value, ctx) => {
    const normalized = normalizeLegacyRedirectPath(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Invalid legacy source path' });
      return z.NEVER;
    }
    return normalized;
  }),
  targetPath: z.string().transform((value, ctx) => {
    const normalized = normalizeLegacyRedirectTargetPath(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Invalid target path' });
      return z.NEVER;
    }
    return normalized;
  }),
});

export function rawLegacyRedirectFromFormData(
  formData: FormData
): Record<string, unknown> {
  return {
    source: formData.get('source') ?? 'manual',
    sourcePath: formData.get('sourcePath'),
    targetPath: formData.get('targetPath'),
  };
}
```

- [x] **Step 5: Add handlers and registry entries**

Create handlers that follow the existing catalog handler shape:

```ts
export const legacyRedirectCatalogHandlers: CatalogServerHandlers = {
  async list() {
    const rows = await prisma.legacyRedirect.findMany({
      orderBy: [{ source: 'asc' }, { sourcePath: 'asc' }],
      select: {
        id: true,
        source: true,
        sourcePath: true,
        targetPath: true,
      },
    });
    return rows;
  },
  async getById(id) {
    return prisma.legacyRedirect.findUnique({
      where: { id },
      select: {
        id: true,
        source: true,
        sourcePath: true,
        targetPath: true,
      },
    });
  },
  async createFromForm(formData) {
    const parsed = legacyRedirectFormSchema.safeParse(
      rawLegacyRedirectFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      const row = await prisma.legacyRedirect.create({
        data: parsed.data,
        select: { id: true },
      });
      return { ok: true, id: row.id };
    } catch (error) {
      return mapLegacyRedirectPrismaError(error);
    }
  },
  async updateFromForm(id, formData) {
    const parsed = legacyRedirectFormSchema.safeParse(
      rawLegacyRedirectFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      await prisma.legacyRedirect.update({
        where: { id },
        data: parsed.data,
      });
      return { ok: true };
    } catch (error) {
      return mapLegacyRedirectPrismaError(error);
    }
  },
  async delete(id) {
    await prisma.legacyRedirect.delete({ where: { id } });
    return { ok: true };
  },
};
```

Create `publicSlugCatalogHandlers` as read-only list plus delete:

```ts
export const publicSlugCatalogHandlers: CatalogServerHandlers = {
  async list() {
    const rows = await prisma.publicSlug.findMany({
      orderBy: [{ scope: 'asc' }, { slug: 'asc' }],
      select: {
        id: true,
        scope: true,
        slug: true,
        sluggableId: true,
        sluggableType: true,
        source: true,
      },
    });
    return rows.map((row) => ({
      ...row,
      targetPath: publicSlugTargetPreviewPath(row),
    }));
  },
  async getById(id) {
    return prisma.publicSlug.findUnique({
      where: { id },
      select: {
        id: true,
        scope: true,
        slug: true,
        sluggableId: true,
        sluggableType: true,
        source: true,
      },
    });
  },
  async createFromForm() {
    return { ok: false, code: 'not_allowed' };
  },
  async updateFromForm() {
    return { ok: false, code: 'not_allowed' };
  },
  async delete(id) {
    await prisma.publicSlug.delete({ where: { id } });
    return { ok: true };
  },
};
```

Register both in `catalogServerRegistry.ts`.

- [x] **Step 6: Run handler tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/legacyRedirects.test.ts src/libs/admin/catalog/legacyRedirectSchemas.test.ts src/libs/admin/catalog/catalogDefinitions.test.ts
```

Expected: PASS.

### Task 8: Resolve Legacy Redirects In Proxy

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/proxy.test.ts`

- [x] **Step 1: Write failing proxy tests**

Add to `src/proxy.test.ts`:

```ts
it('permanently redirects legacy php paths before intl middleware', async () => {
  resolveLegacyRedirect.mockResolvedValue('/calendar');
  const { default: proxy } = await import('@/proxy');
  const request = new NextRequest(
    new URL('http://localhost:3008/calendar.php?month=may')
  );

  const response = await proxy(request);

  expect(response.status).toBe(308);
  expect(response.headers.get('location')).toBe('/calendar');
  expect(resolveLegacyRedirect).toHaveBeenCalledWith({
    locale: 'en',
    pathname: '/calendar.php',
  });
  expect(intlFn).not.toHaveBeenCalled();
});

it('continues to intl for unmatched dotted legacy paths', async () => {
  resolveLegacyRedirect.mockResolvedValue(null);
  const { default: proxy } = await import('@/proxy');
  const request = new NextRequest(
    new URL('http://localhost:3008/missing.php')
  );

  const response = await proxy(request);

  expect(response.status).toBe(200);
  expect(intlFn).toHaveBeenCalledWith(request);
});
```

- [x] **Step 2: Run failing proxy tests**

Run: `npm run test -- src/proxy.test.ts`

Expected: FAIL because `proxy.ts` does not import or call `resolveLegacyRedirect`.

- [x] **Step 3: Add proxy resolution**

In `src/proxy.ts`, import:

```ts
import { resolveLegacyRedirect } from '@/libs/mit-sailing/legacyRedirects';
```

Before protected account route handling:

```ts
const legacyRedirect = await resolveLegacyRedirect({
  locale: routing.defaultLocale,
  pathname,
});
if (legacyRedirect) {
  return NextResponse.redirect(new URL(legacyRedirect, request.url), 308);
}
```

Update matcher:

```ts
export const config = {
  matcher: [
    '/((?!api|_next|_vercel|monitoring|.*\\..*).*)',
    '/((?!api|_next|_vercel|monitoring).+\\.(?:php|html?))',
  ],
};
```

- [x] **Step 4: Run proxy tests**

Run: `npm run test -- src/proxy.test.ts`

Expected: PASS.

- [x] **Step 5: Commit Phase 4 legacy redirect work**

```bash
git add src/libs/mit-sailing/legacyRedirects.ts src/libs/mit-sailing/legacyRedirects.test.ts src/libs/admin/catalog/legacyRedirectSchemas.ts src/libs/admin/catalog/legacyRedirectSchemas.test.ts src/libs/admin/catalog/legacyRedirectCatalogHandlers.ts src/libs/admin/catalog/publicSlugCatalogHandlers.ts src/libs/admin/catalog/catalogServerRegistry.ts src/proxy.ts src/proxy.test.ts
git commit -m "feat: manage and resolve legacy redirects"
```

### Phase 4 Review Gate

- [x] **Step 1: Main-agent review** _(blocking target query/hash finding fixed in `e05ecb9`; re-review passed)_

Run:

```bash
git diff origin/main...HEAD -- src/libs/mit-sailing/legacyRedirects.ts src/libs/admin/catalog/legacyRedirectCatalogHandlers.ts src/libs/admin/catalog/publicSlugCatalogHandlers.ts src/proxy.ts
```

Review for:
- source paths accept `.php`, `.html`, and `.htm` only;
- target paths are internal app paths and exclude `/api`, `/_next`, and monitoring;
- query strings are dropped for legacy redirects;
- proxy matcher does not route ordinary static assets through the app;
- `/calendar.php -> /calendar` can be represented as one admin row.

- [x] **Step 2: Phase 4 tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/legacyRedirects.test.ts src/libs/admin/catalog/legacyRedirectSchemas.test.ts src/proxy.test.ts
```

Expected: PASS.

---

## Phase 5: E2E Smoke And Final Hardening

### Task 9: Add E2E Smoke For Slug History And Legacy Redirect

**Files:**
- Modify: `tests/e2e/MitSailingCatalog.e2e.ts`

- [x] **Step 1: Add E2E setup SQL**

Use the existing raw `pg` pool pattern in `MitSailingCatalog.e2e.ts`. Insert one public slug alias and one legacy redirect row:

```ts
await pool.query(
  `
    INSERT INTO public_slugs (id, slug, sluggable_type, sluggable_id, scope, source, created_at)
    SELECT 'e2e-class-old-slug', 'old-intro-sailing', 'SailingClass', id, 'classes', 'migration', NOW()
    FROM sailing_classes
    WHERE slug = 'intro-sailing-101'
    ON CONFLICT (slug, sluggable_type, scope) DO UPDATE
      SET sluggable_id = EXCLUDED.sluggable_id
  `
);
await pool.query(
  `
    INSERT INTO legacy_redirects (id, source_path, target_path, source, created_at)
    VALUES ('e2e-calendar-php', '/calendar.php', '/calendar', 'manual', NOW())
    ON CONFLICT (source_path) DO UPDATE
      SET target_path = EXCLUDED.target_path,
          source = EXCLUDED.source
  `
);
```

- [x] **Step 2: Add E2E assertions**

Add tests:

```ts
test('redirects old public class slugs to canonical class pages', async ({
  page,
}) => {
  await page.goto('/classes/old-intro-sailing');
  await expect.poll(() => new URL(page.url()).pathname).toBe(
    '/classes/intro-sailing-101'
  );
  await expect(
    page.getByRole('heading', { name: 'Intro Sailing 101' })
  ).toBeVisible();
});

test('redirects legacy php paths to admin-managed targets', async ({ page }) => {
  await page.goto('/calendar.php?month=may');
  await expect.poll(() => new URL(page.url()).pathname).toBe('/calendar');
});
```

- [x] **Step 3: Run the E2E gate** _(default-worker run reached the new redirect tests and both passed, then failed once in existing `/reserve`; full gate passed with `PLAYWRIGHT_WORKERS=1`: 80 passed, 2 skipped)_

Run: `npm run test:e2e`

Expected: PASS.

### Task 10: Full Verification And Final Review

**Files:**
- All files changed in this plan

- [x] **Step 1: Run full unit/component tests** _(plain run failed on missing local env; CI-style placeholder env passed: 226 files, 1664 tests passed, 13 skipped)_

Run: `npm run test`

Expected: PASS.

- [x] **Step 2: Run type, lint, dependency, and i18n checks** _(passed with CI-style placeholder env where required)_

Run:

```bash
npm run check:types
npm run lint
npm run check:deps
npm run check:i18n
```

Expected: PASS.

- [x] **Step 3: Run build gate**

Run: `npm run build-local`

Expected: PASS.

- [x] **Step 4: Main-agent final code review** _(blocking stale-alias cleanup finding fixed in `58f7405`; re-review passed with no blocking findings)_

Run:

```bash
git diff --check
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
```

Review for:
- no `any` types;
- no hard-coded user-visible strings outside `src/locales/en.json`;
- no direct `process.env` reads;
- no broad route rewrites beyond the legacy dotted matcher;
- no unrelated formatting churn;
- no public redirects to unpublished/hidden resources;
- no manual editing path that breaks automatic CMS history.

- [ ] **Step 5: Commit E2E/final fixes** _(ready to commit final E2E smoke and plan status updates)_

If Task 9 or final fixes changed files:

```bash
git add tests/e2e/MitSailingCatalog.e2e.ts
git commit -m "test: cover public slug and legacy redirects"
```

## Self-Review

- Spec coverage: The plan covers public slug history rows, alias redirect resolution, public visibility checks, revert cleanup, deletion cleanup, active resource precedence, duplicate validation, admin-managed legacy redirects, dotted `.php`/`.html` proxy handling, and E2E smoke.
- Placeholder scan: This plan contains no deferred implementation markers, and each code-changing task includes concrete snippets or exact expected calls.
- Type consistency: `PublicSlugScope`, `PublicSluggableType`, `PublicSlugSource`, and `LegacyRedirectSource` names are used consistently across schema, helpers, and handlers.

Plan complete. Execution mode for this feature: subagent-driven, one worker per task, with main-agent review gates after each phase.
