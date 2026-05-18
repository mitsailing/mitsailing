# CASL Prisma Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the CASL migration by making CASL the single authorization API while using `@casl/prisma` conditions for record ownership and query filtering.

**Architecture:** `src/libs/auth/permissions.ts` owns the Prisma-backed ability type and subject helpers. Admin event access uses `accessibleBy` so event admins only query events they own or administer. Registration ownership stays expressed through CASL conditions and can be reused by mutations or queries.

**Tech Stack:** TypeScript, Prisma 7, `@casl/ability`, `@casl/prisma`, Vitest.

---

### Task 1: Convert the auth ability to Prisma conditions

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/libs/auth/permissions.ts`
- Test: `src/libs/auth/permissions.test.ts`

- [ ] **Step 1: Verify the dependency exists**

Run: `node -e "const p=require('./package.json'); console.log(p.dependencies['@casl/prisma'])"`

Expected: prints an installed `@casl/prisma` version. If it prints `undefined`, run `npm install @casl/prisma` before continuing.

- [ ] **Step 2: Update the failing ownership tests**

In `src/libs/auth/permissions.test.ts`, assert event rules use Prisma-compatible relation conditions:

```ts
expect(ability.can(AuthAction.UPDATE, createEventAbilitySubject({
  createdByUserId: 'user-1',
  admins: [],
}))).toBe(true);
expect(ability.can(AuthAction.UPDATE, createEventAbilitySubject({
  createdByUserId: 'creator-1',
  admins: [{ adminUserId: 'user-1' }],
}))).toBe(true);
expect(ability.can(AuthAction.UPDATE, createEventAbilitySubject({
  createdByUserId: 'creator-1',
  admins: [{ adminUserId: 'user-2' }],
}))).toBe(false);
```

- [ ] **Step 3: Run the test and verify red**

Run: `npm run test -- src/libs/auth/permissions.test.ts`

Expected: FAIL because `createEventAbilitySubject` still expects `adminUserIds`.

- [ ] **Step 4: Implement Prisma ability types and rules**

In `src/libs/auth/permissions.ts`, import `createPrismaAbility`, `PrismaQuery`, and `Subjects` from `@casl/prisma`. Define `AuthAbility` as `PureAbility<[AbilityAction, AbilitySubject], PrismaQuery>`. Represent event ownership as `{ createdByUserId: userId }` OR `{ admins: { some: { adminUserId: userId } } }`; represent registration ownership as `{ userId }`. Build abilities with `new AbilityBuilder<AuthAbility>(createPrismaAbility)`.

- [ ] **Step 5: Run the focused test green**

Run: `npm run test -- src/libs/auth/permissions.test.ts`

Expected: PASS.

### Task 2: Use accessibleBy for event admin lookup

**Files:**
- Modify: `src/libs/admin/events/eventAdminAuthorization.ts`
- Test: `src/libs/admin/events/eventAdminAuthorization.test.ts`

- [ ] **Step 1: Add a failing query-filter assertion**

In `eventAdminAuthorization.test.ts`, assert the event lookup uses `findFirst` with `AND: [{ slug }, accessible filter]` instead of fetching by slug first and checking in memory.

- [ ] **Step 2: Run the test and verify red**

Run: `npm run test -- src/libs/admin/events/eventAdminAuthorization.test.ts`

Expected: FAIL because the module currently calls `event.findUnique`.

- [ ] **Step 3: Implement accessibleBy event filtering**

In `eventAdminAuthorization.ts`, build the ability first, call `accessibleBy(ability, AuthAction.UPDATE).Event`, and use `prisma.event.findFirst({ where: { AND: [{ slug }, eventAccessWhere] }, select: ... })`. If CASL throws `ForbiddenError`, redirect to `/admin/events`.

- [ ] **Step 4: Run the focused test green**

Run: `npm run test -- src/libs/admin/events/eventAdminAuthorization.test.ts`

Expected: PASS.

### Task 3: Verify the migration surface

**Files:**
- Modify only files already touched by Tasks 1-2 unless a type error identifies another direct migration caller.

- [ ] **Step 1: Search for stale in-memory ownership checks**

Run: `rg "adminUserIds|conditionsMatcher|MatchConditions|findUnique\\(\\{\\s*where: \\{ slug" src/libs src/app`

Expected: no stale CASL ownership helpers or event slug authorization fetches remain.

- [ ] **Step 2: Run targeted tests**

Run: `npm run test -- src/libs/auth/permissions.test.ts src/libs/admin/events/eventAdminAuthorization.test.ts`

Expected: PASS.

- [ ] **Step 3: Run required checks**

Run:

```bash
npm run lint
SKIP_ENV_VALIDATION=true npm run check:types
npm run check:i18n
npm run check:deps
```

Expected: all PASS.

