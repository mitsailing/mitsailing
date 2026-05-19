# Site Nav Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache public header Classes and Fleet dropdown data across requests and invalidate it from admin mutations.

**Architecture:** Use Next.js `unstable_cache` for DB-backed nav reads with explicit cache tags. Keep fail-soft logging outside the persistent data cache so transient DB failures return `[]` without intentionally caching the fallback. Invalidate tags from existing catalog Server Actions with `updateTag`, matching current `site_alerts` and sitemap invalidation style.

**Tech Stack:** Next.js App Router, `unstable_cache`, `updateTag`, React `cache`, Prisma, Vitest.

---

## Task 1: Add Failing Cache Wrapper Tests

**Files:**
- Test: `src/libs/mit-sailing/classQueries.test.ts`
- Test: `src/libs/mit-sailing/fleetQueries.test.ts`

- [ ] **Step 1: Write tests that expect nav reads to register Next cache tags**

```ts
expect(unstableCacheCalls[0]?.options.tags).toEqual(['site-nav-classes']);
expect(unstableCacheCalls[0]?.keyParts).toEqual(['site-nav-classes']);
```

```ts
expect(unstableCacheCalls[0]?.options.tags).toEqual(['site-nav-fleet']);
expect(unstableCacheCalls[0]?.keyParts).toEqual(['site-nav-fleet']);
```

- [ ] **Step 2: Run tests to verify they fail before implementation**

Run: `npm run test -- src/libs/mit-sailing/classQueries.test.ts src/libs/mit-sailing/fleetQueries.test.ts`
Expected: FAIL because the tests or exports do not exist yet.

## Task 2: Add Failing Admin Invalidation Tests

**Files:**
- Modify: `src/libs/admin/catalog/catalogActions.test.ts`

- [ ] **Step 1: Assert class category and fleet mutations expire nav tags**

```ts
expect(updateTag).toHaveBeenCalledWith('site-nav-classes');
expect(updateTag).toHaveBeenCalledWith('site-nav-fleet');
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- src/libs/admin/catalog/catalogActions.test.ts`
Expected: FAIL because only existing tags such as `sitemap-catalog` are invalidated.

## Task 3: Implement Cache Tags And Cached Nav Reads

**Files:**
- Create: `src/libs/mit-sailing/siteNavCache.ts`
- Modify: `src/libs/mit-sailing/cacheDbListOrEmpty.ts`
- Modify: `src/libs/mit-sailing/classQueries.ts`
- Modify: `src/libs/mit-sailing/fleetQueries.ts`
- Modify: `src/components/mit-sailing/SiteShellHeaderNav.tsx`

- [ ] **Step 1: Add shared tag constants**

```ts
export const siteNavClassesCacheTag = 'site-nav-classes';
export const siteNavFleetCacheTag = 'site-nav-fleet';
export const SITE_NAV_CACHE_REVALIDATE_SECONDS = 86_400;
```

- [ ] **Step 2: Extend `cacheDbListOrEmpty` with optional Next cache options**

```ts
const load = options
  ? unstable_cache(loadUnchecked, options.keyParts, {
      revalidate: options.revalidate,
      tags: options.tags,
    })
  : loadUnchecked;
```

- [ ] **Step 3: Cache class category nav rows with `site-nav-classes`**

```ts
export const listClassCategoriesForNav = cacheDbListOrEmpty(
  'class categories for site nav',
  loadClassCategoriesForNavUnchecked,
  {
    keyParts: [siteNavClassesCacheTag],
    revalidate: SITE_NAV_CACHE_REVALIDATE_SECONDS,
    tags: [siteNavClassesCacheTag],
  }
);
```

- [ ] **Step 4: Add a fleet nav-only cached query**

```ts
export const listFleetBoatsForNav = cacheDbListOrEmpty(
  'fleet boats for site nav',
  loadFleetBoatsForNavUnchecked,
  {
    keyParts: [siteNavFleetCacheTag],
    revalidate: SITE_NAV_CACHE_REVALIDATE_SECONDS,
    tags: [siteNavFleetCacheTag],
  }
);
```

- [ ] **Step 5: Use `listFleetBoatsForNav` in the header**

```ts
const [categories, fleetBoats, headerMenu, mobileUtilityMenu] =
  await Promise.all([
    listClassCategoriesForNav(),
    listFleetBoatsForNav(),
    loadCmsMenu('header'),
    loadCmsMenu('mobile_utility'),
  ]);
```

## Task 4: Invalidate Tags From Admin Mutations

**Files:**
- Modify: `src/libs/admin/catalog/catalogActions.ts`

- [ ] **Step 1: Invalidate class nav after class category mutations**

```ts
if (resourceId === 'class_categories') {
  updateTag(siteNavClassesCacheTag);
}
```

- [ ] **Step 2: Invalidate fleet nav after fleet mutations**

```ts
if (resourceId === 'fleet') {
  updateTag(siteNavFleetCacheTag);
}
```

## Task 5: Verify

**Files:**
- All files above

- [ ] **Step 1: Run targeted tests**

Run: `npm run test -- src/libs/mit-sailing/classQueries.test.ts src/libs/mit-sailing/fleetQueries.test.ts src/libs/admin/catalog/catalogActions.test.ts`
Expected: PASS.

- [ ] **Step 2: Run required local checks**

Run: `npm run lint`
Expected: PASS.

Run: `SKIP_ENV_VALIDATION=true npm run check:types`
Expected: PASS.

Run: `npm run check:i18n`
Expected: PASS.

Run: `npm run check:deps`
Expected: PASS.
