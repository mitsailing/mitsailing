# CodeRabbit Role Permissions Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the eight CodeRabbit findings on `feature/role-based-permissions` with focused tests and minimal behavior changes.

**Architecture:** Keep authorization checks in the existing server action and page modules. Add regression tests around permission denial, role counting, admin access grants, and admin user pages before changing production behavior. Treat the migration and existing plan heading as direct consistency fixes.

**Tech Stack:** TypeScript, Next.js App Router, Prisma, Vitest, Tailwind v4.

---

## File Structure

- Modify: `src/libs/admin/users/adminUserActions.test.ts`
  - Adds permission-denial test setup that proves actions stop when `requirePermission` rejects.
- Modify: `src/libs/admin/roles/roleAdminActions.test.ts`
  - Adds a regression assertion that admin counting uses exact role equality.
- Modify: `src/libs/admin/roles/roleAdminActions.ts`
  - Changes last-admin guard from substring matching to exact role matching.
- Modify: `src/libs/admin/adminAreaAccess.test.ts`
  - Adds a regression test that admins skip role grant loading.
- Modify: `src/libs/admin/adminAreaAccess.ts`
  - Avoids unnecessary role grant DB reads for admins.
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx`
  - Adds page permission tests for index, new, delete, and show pages.
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`
  - Uses `parseRoles(...).includes(Role.ADMIN)` consistently for admin UI decisions.
- Modify: `src/app/[locale]/(marketing)/(site)/admin/roles/page.tsx`
  - Adds Prisma cursor pagination for the role assignment user list and renders progressive next-page markup for Infinite Scroll.
- Create: `src/components/mit-sailing/admin/roles/AdminRoleUsersInfiniteScroll.tsx`
  - Initializes Infinite Scroll v5 on the server-rendered role user table.
- Modify: `src/locales/en.json`
  - Adds infinite-scroll status labels used by the roles page.
- Modify: `prisma/migrations/20260518130000_role_permission_grants/migration.sql`
  - Includes all code-defined roles in the `role_key` check constraint.
- Modify: `docs/superpowers/plans/2026-05-18-casl-prisma-authorization.md`
  - Fixes the skipped heading level.

### Task 1: Permission Denial Regression Tests

**Files:**
- Modify: `src/libs/admin/users/adminUserActions.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test below the existing create/update permission test:

```ts
  it.each([
    {
      name: 'creating users',
      permission: 'users.edit',
      run: async () => {
        const { createAdminUserAction } =
          await import('@/libs/admin/users/adminUserActions');
        return createAdminUserAction('en', new FormData());
      },
    },
    {
      name: 'updating users',
      permission: 'users.edit',
      run: async () => {
        const { updateAdminUserAction } =
          await import('@/libs/admin/users/adminUserActions');
        return updateAdminUserAction('en', 'user-1', new FormData());
      },
    },
    {
      name: 'deleting users',
      permission: 'users.delete',
      run: async () => {
        const { deleteAdminUserAction } =
          await import('@/libs/admin/users/adminUserActions');
        return deleteAdminUserAction('en', 'user-1');
      },
    },
  ])('stops before $name when permission is denied', async (action) => {
    mocks.requirePermission.mockRejectedValue(new Error('permission denied'));

    await expect(action.run()).rejects.toThrow('permission denied');

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      action.permission,
      'en'
    );
    expect(mocks.createFromForm).not.toHaveBeenCalled();
    expect(mocks.updateFromForm).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify red**

Run: `npm run test -- src/libs/admin/users/adminUserActions.test.ts`

Expected: FAIL if the actions do not currently stop on permission denial. If it passes, keep the regression test because it directly addresses the CodeRabbit coverage gap.

### Task 2: Exact Admin Role Counting

**Files:**
- Modify: `src/libs/admin/roles/roleAdminActions.test.ts`
- Modify: `src/libs/admin/roles/roleAdminActions.ts`

- [ ] **Step 1: Write the failing assertion**

In `keeps at least one admin role assigned`, add:

```ts
    expect(userCount).toHaveBeenCalledWith({ where: { role: Role.ADMIN } });
```

- [ ] **Step 2: Run test to verify red**

Run: `npm run test -- src/libs/admin/roles/roleAdminActions.test.ts`

Expected: FAIL because the code currently calls `user.count({ where: { role: { contains: Role.ADMIN } } })`.

- [ ] **Step 3: Write minimal implementation**

Change `src/libs/admin/roles/roleAdminActions.ts`:

```ts
  const adminCount = await prisma.user.count({
    where: { role: Role.ADMIN },
  });
```

- [ ] **Step 4: Run test to verify green**

Run: `npm run test -- src/libs/admin/roles/roleAdminActions.test.ts`

Expected: PASS.

### Task 3: Admin Area Grant Loading

**Files:**
- Modify: `src/libs/admin/adminAreaAccess.test.ts`
- Modify: `src/libs/admin/adminAreaAccess.ts`

- [ ] **Step 1: Write the failing test**

Add this test inside `describe('requireAdminAreaAccess')`:

```ts
  it('does not load role grants for administrators', async () => {
    mocks.verifySession.mockResolvedValue({
      session: { impersonatedBy: null },
      user: { id: 'admin-1', role: Role.ADMIN },
    });
    const { requireAdminAreaAccess } =
      await import('@/libs/admin/adminAreaAccess');

    const access = await requireAdminAreaAccess('en');

    expect(access.role).toBe(Role.ADMIN);
    expect(mocks.listRolePermissionGrants).not.toHaveBeenCalled();
    expect(access.ability.can(Permission.ADMIN_VIEW, 'Permission')).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify red**

Run: `npm run test -- src/libs/admin/adminAreaAccess.test.ts`

Expected: FAIL because `listRolePermissionGrants` is currently always called.

- [ ] **Step 3: Write minimal implementation**

Change `src/libs/admin/adminAreaAccess.ts`:

```ts
  const role = normalizeRole(session.user.role);
  const grants = role === Role.ADMIN ? [] : await listRolePermissionGrants();
  const ability = createAuthAbility({
    grants,
    role,
    userId: session.user.id,
  });
```

Also change the role import to import the runtime `Role`:

```ts
import { normalizeRole, Role } from '@/libs/auth/roles';
```

- [ ] **Step 4: Run test to verify green**

Run: `npm run test -- src/libs/admin/adminAreaAccess.test.ts`

Expected: PASS.

### Task 4: Admin User Page Coverage and Role Parsing

**Files:**
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`

- [ ] **Step 1: Expand mocks for page imports**

Update the hoisted mocks in `adminUserPages.test.tsx`:

```ts
const mocks = vi.hoisted(() => ({
  getById: vi.fn(),
  getTranslations: vi.fn(async () => {
    await Promise.resolve();
    return (key: string) => key;
  }),
  list: vi.fn(),
  listRolePermissionGrants: vi.fn(),
  listUserRatingAssignmentRows: vi.fn(),
  getAdminUserEmailMessages: vi.fn(),
  loggerError: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  requirePermission: vi.fn(),
  setRequestLocale: vi.fn(),
}));
```

Add these mocks:

```ts
vi.mock('@/libs/auth/rolePermissionGrants', () => ({
  listRolePermissionGrants: mocks.listRolePermissionGrants,
}));

vi.mock('@/libs/mit-sailing/sailingRatingQueries', () => ({
  listUserRatingAssignmentRows: mocks.listUserRatingAssignmentRows,
}));

vi.mock('@/libs/email/emailMessages', () => ({
  getAdminUserEmailMessages: mocks.getAdminUserEmailMessages,
}));

vi.mock('@/libs/Logger', () => ({
  logger: { error: mocks.loggerError },
}));

vi.mock('@/components/mit-sailing/admin/catalog/AdminCatalogTable', () => ({
  AdminCatalogTable: (props: { rows: unknown[] }) => (
    <table data-row-count={props.rows.length} />
  ),
}));
```

Update the `usersAdminHandlers` mock:

```ts
vi.mock('@/libs/admin/users/usersAdminHandlers', () => ({
  usersAdminHandlers: {
    getById: mocks.getById,
    list: mocks.list,
  },
}));
```

Reset and default the new mocks in `beforeEach`:

```ts
  mocks.list.mockReset();
  mocks.listRolePermissionGrants.mockReset();
  mocks.listUserRatingAssignmentRows.mockReset();
  mocks.getAdminUserEmailMessages.mockReset();
  mocks.loggerError.mockReset();

  mocks.list.mockResolvedValue([
    { email: 'sailor@example.com', id: 'user-1', name: 'Sailor One' },
  ]);
  mocks.listRolePermissionGrants.mockResolvedValue([]);
  mocks.listUserRatingAssignmentRows.mockResolvedValue([]);
  mocks.getAdminUserEmailMessages.mockResolvedValue([]);
```

- [ ] **Step 2: Add page permission tests**

Add these tests:

```ts
  it('keeps the user index behind the view-users permission', async () => {
    const { default: AdminUsersIndexPage } = await import('./page');

    await AdminUsersIndexPage({
      params: Promise.resolve({ locale: 'en' }),
    });

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requirePermission).toHaveBeenCalledWith('users.view', 'en');
    expect(mocks.list).toHaveBeenCalledOnce();
  });

  it('keeps user creation behind the edit-users permission', async () => {
    const { default: AdminUsersNewPage } = await import('./new/page');

    await AdminUsersNewPage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({}),
    });

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requirePermission).toHaveBeenCalledWith('users.edit', 'en');
  });

  it('keeps user deletion behind the delete-users permission', async () => {
    const { default: AdminUsersDeletePage } = await import('./[id]/delete/page');

    await AdminUsersDeletePage({
      params: Promise.resolve({ id: 'user-1', locale: 'en' }),
      searchParams: Promise.resolve({}),
    });

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requirePermission).toHaveBeenCalledWith('users.delete', 'en');
    expect(mocks.getById).toHaveBeenCalledWith('user-1');
  });

  it('keeps the user detail page behind the view-users permission', async () => {
    const { default: AdminUserShowPage } = await import('./[id]/page');

    await AdminUserShowPage({
      params: Promise.resolve({ id: 'user-1', locale: 'en' }),
      searchParams: Promise.resolve({}),
    });

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requirePermission).toHaveBeenCalledWith('users.view', 'en');
    expect(mocks.getById).toHaveBeenCalledWith('user-1');
    expect(mocks.listRolePermissionGrants).toHaveBeenCalledOnce();
    expect(mocks.listUserRatingAssignmentRows).toHaveBeenCalledWith('user-1');
  });
```

- [ ] **Step 3: Run tests to verify red or coverage gap**

Run: `npm run test -- src/app/[locale]/\\(marketing\\)/\\(site\\)/admin/users/adminUserPages.test.tsx`

Expected: PASS for page coverage if current behavior is correct. The role parsing issue is handled in the next step because it is a consistency cleanup.

- [ ] **Step 4: Write minimal implementation**

Change `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx` import:

```ts
import { parseRoles, Role } from '@/libs/auth/roles';
```

Change the role assignment:

```ts
  const role = parseRoles(session.user.role);
  const canAdmin = role.includes(Role.ADMIN);
```

Pass the normalized primary role to the ability by deriving it from parsed roles:

```ts
  const primaryRole = canAdmin ? Role.ADMIN : (role[0] ?? Role.USER);
```

Then update `createAuthAbility`:

```ts
    role: primaryRole,
```

- [ ] **Step 5: Run focused test**

Run: `npm run test -- src/app/[locale]/\\(marketing\\)/\\(site\\)/admin/users/adminUserPages.test.tsx`

Expected: PASS.

### Task 5: Cursor-Based Infinite Role User Loading

**Files:**
- Modify: `src/app/[locale]/(marketing)/(site)/admin/roles/page.tsx`
- Create: `src/components/mit-sailing/admin/roles/AdminRoleUsersInfiniteScroll.tsx`
- Modify: `src/locales/en.json`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install Infinite Scroll v5**

Run: `npm install infinite-scroll@^5.0.0 && npm install --save-dev @types/infinite-scroll@^4.0.4`

Expected: `infinite-scroll` is in dependencies and `@types/infinite-scroll` is in devDependencies.

- [ ] **Step 2: Add cursor loader implementation**

Replace `listRoleAdminUsers` with:

```ts
const ROLE_ADMIN_USERS_PAGE_SIZE = 100;

type RoleAdminUsersPage = {
  nextCursor: string | null;
  rows: RoleAdminUserRow[];
  totalCount: number;
};

async function listRoleAdminUsers(cursor?: string): Promise<RoleAdminUsersPage> {
  if (cursor) {
    const cursorUser = await prisma.user.findUnique({
      where: { id: cursor },
      select: { id: true },
    });
    if (!cursorUser) {
      return listRoleAdminUsers();
    }
  }
  const [rows, totalCount] = await Promise.all([
    prisma.user.findMany({
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ email: 'asc' }, { id: 'asc' }],
      select: {
        email: true,
        id: true,
        name: true,
        role: true,
      },
      take: ROLE_ADMIN_USERS_PAGE_SIZE + 1,
    }),
    prisma.user.count(),
  ]);
  const hasNextPage = rows.length > ROLE_ADMIN_USERS_PAGE_SIZE;
  const pageRows = rows.slice(0, ROLE_ADMIN_USERS_PAGE_SIZE);
  return {
    nextCursor: hasNextPage ? (pageRows.at(-1)?.id ?? null) : null,
    rows: pageRows,
    totalCount,
  };
}
```

Change the page load:

```ts
  const [grants, usersPage] = await Promise.all([
    listRoleAdminGrants(),
    listRoleAdminUsers(searchParams.cursor),
  ]);
```

Change the table map:

```tsx
              {usersPage.rows.map((user) => {
```

Add a range note before the users table:

```tsx
          <p className="mt-1 text-sm text-muted-foreground">
            {t('user_roles_count', {
              count: usersPage.rows.length,
              total: usersPage.totalCount,
            })}
          </p>
```

- [ ] **Step 3: Add Infinite Scroll initializer**

Create `src/components/mit-sailing/admin/roles/AdminRoleUsersInfiniteScroll.tsx`:

```tsx
'use client';

import { useEffect } from 'react';

export function AdminRoleUsersInfiniteScroll() {
  useEffect(() => {
    const frame = window.requestAnimationFrame(async () => {
      const { default: InfiniteScroll } = await import('infinite-scroll');
      const container = document.querySelector('.js-role-admin-users');
      if (!container) {
        return;
      }
      new InfiniteScroll(container, {
        append: '.js-role-admin-user-row',
        checkLastPage: '.js-role-admin-users-next',
        hideNav: '.js-role-admin-users-nav',
        history: false,
        path: '.js-role-admin-users-next',
        status: '.js-role-admin-users-status',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return null;
}
```

Add `js-role-admin-users` to the `<tbody>`, `js-role-admin-user-row` to each row, render the initializer, and render a real next link only when `usersPage.nextCursor` exists.

- [ ] **Step 4: Add translations**

In `src/locales/en.json`, inside `AdminRoles`, add:

```json
    "user_roles_count": "Showing {count} of {total} users",
    "load_more_users": "Load more users",
    "loading_users": "Loading users...",
    "all_users_loaded": "All users loaded.",
    "load_users_error": "Could not load more users.",
```

- [ ] **Step 5: Run type check**

Run: `npm run check:types`

Expected: PASS.

### Task 6: Migration and Plan Heading Consistency

**Files:**
- Modify: `prisma/migrations/20260518130000_role_permission_grants/migration.sql`
- Modify: `docs/superpowers/plans/2026-05-18-casl-prisma-authorization.md`

- [ ] **Step 1: Update migration check constraint**

Change the `role_key` check to:

```sql
        "role_key" IN (
            'admin',
            'user',
            'volunteer',
            'volunteer_instructor',
            'dock_staff',
            'dock_master'
        )
```

- [ ] **Step 2: Fix skipped heading level**

Change:

```md
### Task 1: Convert the auth ability to Prisma conditions
```

to:

```md
## Task 1: Convert the auth ability to Prisma conditions
```

- [ ] **Step 3: Run dependency and i18n checks**

Run: `npm run check:deps`

Expected: PASS.

Run: `npm run check:i18n`

Expected: PASS.

### Task 7: Final Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test -- src/libs/admin/users/adminUserActions.test.ts src/libs/admin/roles/roleAdminActions.test.ts src/libs/admin/adminAreaAccess.test.ts src/app/[locale]/\\(marketing\\)/\\(site\\)/admin/users/adminUserPages.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run repo checks**

Run: `npm run lint`

Expected: PASS.

Run: `npm run check:types`

Expected: PASS.

- [ ] **Step 3: Review diff**

Run: `git diff --check`

Expected: no whitespace errors.
