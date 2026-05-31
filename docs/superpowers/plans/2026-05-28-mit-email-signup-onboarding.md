# MIT Email Signup Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make verified `@mit.edu` signup land in sailing-card onboarding with identity already resolved, so current MIT students do not type MIT ID, affiliation, name, class year, or MIT Fitness status.

**Architecture:** Add a verified-Kerberos identity lookup that can resolve a user directly from their confirmed MIT email, then derive safe onboarding defaults on the server before rendering the form. Keep the existing sailing-card request write path, but let the server submit/validate hidden identity values for current students and use a compact confirmation path for ambiguous MIT Data Warehouse `Other` rows.

**Tech Stack:** Next.js App Router, React Hook Form, next-intl, Prisma 7 generated client, Postgres legacy mirror schema, Vitest, Testing Library.

---

## Legacy Data Findings

Verified locally against the mirrored legacy database on May 28, 2026:

- `legacy.dw` columns: `id`, `last`, `first`, `kerberos`, `year`, `type`, `loaddate`.
- `legacy.dw.type` values are `Current Student`, `Current Employee`, `Other`, plus one sentinel row `Done`. The legacy database does **not** contain `Current Staff`.
- App enum mapping should be:
  - `Current Student` -> `MitDataWarehousePersonType.CURRENT_STUDENT`
  - `Current Employee` -> `MitDataWarehousePersonType.CURRENT_STAFF`
  - `Other` -> `MitDataWarehousePersonType.OTHER`
  - `Done` -> ignored
- Counts in `legacy.dw`:
  - `Current Student`: 13,878 rows, 13,681 with Kerberos, 13,845 with `year`.
  - `Current Employee`: 17,045 rows, 16,922 with Kerberos, no `year`.
  - `Other`: 1,076,494 rows, 46,954 with Kerberos, 3,838 with `year`.
- Current student `year` values are `1`, `2`, `3`, `4`, `G`, and blank. Store the raw value in `mitClassYear`; do not reinterpret it as a calendar graduation year.
- `legacy.affil_type` values are `MIT Student`, `MIT Faculty`, `MIT Staff`, `MIT Alum`, `Wellesley`, `Other Student`, `Other Non-Student`, `MIT Family`, `MIT Affiliate`, `Brandeis`, `Northeastern`, `Winsor`, `Brooks`, and `NROTC`.
- Many old active `@mit.edu` members joined to `legacy.dw.type = Other` while their member affiliation was MIT Student, MIT Staff, MIT Faculty, Alum, Affiliate, or Family. Therefore, do not silently map Data Warehouse `Other` to one sailing affiliation.

## Product Decision

For confirmed `@mit.edu` users:

- If Data Warehouse says `CURRENT_STUDENT`, auto-fill and lock:
  - MIT ID
  - affiliation `MIT_STUDENT`
  - first name
  - last name
  - MIT class/year
  - MIT Fitness status, because current MIT students meet the Normal membership requirement
- Still ask for:
  - date of birth
  - phone
  - emergency contact name
  - emergency contact phone
  - card type, keeping the existing default of Normal
  - swim/sailing agreement acceptance
- If Data Warehouse says `CURRENT_STAFF`, auto-fill MIT ID and name, but ask one compact choice: MIT faculty or MIT staff. The legacy warehouse does not distinguish faculty from staff.
- If Data Warehouse says `OTHER`, auto-fill MIT ID and name when Kerberos matches, but ask the user to choose the specific MIT relationship: MIT alum, MIT family, or MIT affiliate. Do not show a Data Warehouse `Other` label to the user.
- Keep `Other student` and `Other non-student` for non-MIT or non-warehouse users for now. A later UI-only grouping may merge them visually, but pricing and staff review still need student vs non-student.

## File Structure

- Modify `src/libs/mit-sailing/mitDataWarehouse.ts`: add verified-Kerberos lookup and legacy type normalization helpers.
- Create `src/libs/mit-sailing/mitDataWarehouseImport.ts`: pure SQL-backed importer from `legacy.dw` into `mit_data_warehouse_people`.
- Create `src/libs/mit-sailing/mitDataWarehouseImport.test.ts`: verifies legacy type mapping, sentinel filtering, invalid MIT ID filtering, and idempotent upsert SQL behavior with a fake client.
- Modify `src/libs/mit-sailing/mitDataWarehouse.test.ts`: cover lookup by verified Kerberos and non-MIT or unverified email rejection.
- Modify `src/libs/legacy-sync/legacyMysqlSync.ts`: run the Data Warehouse importer inside the same successful mirror transaction after `legacy.dw` is copied.
- Modify `src/worker/legacyMysqlSyncJob.test.ts`: assert the normalized identity importer is triggered by sync when the job runs a successful mirror import.
- Modify `src/app/[locale]/(marketing)/(site)/onboarding/page.tsx`: resolve verified MIT email before rendering, derive initial form values, locked identity, and identity mode.
- Modify `src/app/[locale]/(marketing)/(site)/onboarding/onboardingPages.test.tsx`: cover current student, current employee, other, missing warehouse row, and completed onboarding redirects.
- Modify `src/components/mit-sailing/onboarding/SailingCardOnboardingFormTypes.ts`: add server-derived identity mode props.
- Modify `src/components/mit-sailing/onboarding/SailingCardOnboardingFormModel.ts`: treat server-verified current student identity as complete without the user pressing an identity step.
- Modify `src/components/mit-sailing/onboarding/SailingCardOnboardingFormSections.tsx`: skip the affiliation select for fully resolved current students and render a compact verified identity summary.
- Modify `src/components/mit-sailing/onboarding/SailingCardOnboardingIdentityFields.tsx`: add the verified summary and compact MIT relationship chooser for staff/other identity modes.
- Modify `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx`: cover the simplified student path and compact staff/other choices.
- Modify `src/libs/mit-sailing/sailingCardOnboarding.ts`: allow server-verified current student submissions without a visible MIT ID field while still requiring a matching Data Warehouse identity.
- Modify `src/libs/mit-sailing/sailingCardOnboardingActions.ts`: look up identity by verified Kerberos before falling back to MIT ID lookup and ensure hidden server-derived identity values are validated.
- Modify `src/libs/mit-sailing/sailingCardOnboarding.test.ts`: cover current student hidden identity, current employee faculty/staff choice, and `OTHER` MIT relationship choice.
- Modify `src/libs/mit-sailing/sailingCardOnboardingActions.test.ts`: cover action behavior when session email is verified `@mit.edu`.
- Modify `src/locales/en.json`: add concise onboarding copy for verified identity, staff/faculty choice, and MIT relationship choice.

## Task 1: Normalize Legacy Data Warehouse Rows Into App Table

**Files:**
- Create: `src/libs/mit-sailing/mitDataWarehouseImport.ts`
- Create: `src/libs/mit-sailing/mitDataWarehouseImport.test.ts`
- Modify: `src/libs/legacy-sync/legacyMysqlSync.ts`

- [ ] **Step 1: Write failing tests for legacy type mapping**

Create `src/libs/mit-sailing/mitDataWarehouseImport.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { MitDataWarehousePersonType } from '@/generated/prisma/enums';
import {
  importMitDataWarehousePeopleFromLegacySchema,
  legacyDwTypeToPersonType,
} from '@/libs/mit-sailing/mitDataWarehouseImport';

describe('mitDataWarehouseImport', () => {
  it('maps legacy dw types to app person types', () => {
    expect(legacyDwTypeToPersonType('Current Student')).toBe(
      MitDataWarehousePersonType.CURRENT_STUDENT
    );
    expect(legacyDwTypeToPersonType('Current Employee')).toBe(
      MitDataWarehousePersonType.CURRENT_STAFF
    );
    expect(legacyDwTypeToPersonType('Other')).toBe(
      MitDataWarehousePersonType.OTHER
    );
    expect(legacyDwTypeToPersonType('Done')).toBeNull();
    expect(legacyDwTypeToPersonType('Unexpected')).toBeNull();
  });

  it('loads normalized rows from legacy dw into mit data warehouse people', async () => {
    const queries: { sql: string; values?: readonly unknown[] }[] = [];
    const pg = {
      query: vi.fn(async (sql: string, values?: readonly unknown[]) => {
        queries.push({ sql, values });
        return { rows: [{ inserted_count: 3 }] };
      }),
    };

    await expect(
      importMitDataWarehousePeopleFromLegacySchema({ pg })
    ).resolves.toEqual({ imported: 3 });

    expect(queries.at(0)?.sql).toContain('INSERT INTO mit_data_warehouse_people');
    expect(queries.at(0)?.sql).toContain("legacy.dw");
    expect(queries.at(0)?.sql).toContain("WHEN 'Current Student'");
    expect(queries.at(0)?.sql).toContain("WHEN 'Current Employee'");
    expect(queries.at(0)?.sql).toContain("WHEN 'Other'");
    expect(queries.at(0)?.sql).toContain("id ~ '^[0-9]{9}$'");
    expect(queries.at(0)?.sql).toContain("type <> 'Done'");
    expect(queries.at(0)?.sql).toContain('ON CONFLICT (mit_id) DO UPDATE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run --project unit src/libs/mit-sailing/mitDataWarehouseImport.test.ts
```

Expected: FAIL because `src/libs/mit-sailing/mitDataWarehouseImport.ts` does not exist.

- [ ] **Step 3: Add the importer**

Create `src/libs/mit-sailing/mitDataWarehouseImport.ts`:

```ts
import { MitDataWarehousePersonType } from '@/generated/prisma/enums';

type MitDataWarehouseImportPgClient = {
  readonly query: (
    sql: string,
    values?: readonly unknown[]
  ) => Promise<{ readonly rows: readonly unknown[] }>;
};

type ImportedCountRow = {
  readonly inserted_count: number | string | bigint;
};

function isImportedCountRow(row: unknown): row is ImportedCountRow {
  return (
    typeof row === 'object' &&
    row !== null &&
    'inserted_count' in row &&
    (typeof row.inserted_count === 'number' ||
      typeof row.inserted_count === 'string' ||
      typeof row.inserted_count === 'bigint')
  );
}

export function legacyDwTypeToPersonType(value: string) {
  if (value === 'Current Student') {
    return MitDataWarehousePersonType.CURRENT_STUDENT;
  }
  if (value === 'Current Employee') {
    return MitDataWarehousePersonType.CURRENT_STAFF;
  }
  if (value === 'Other') {
    return MitDataWarehousePersonType.OTHER;
  }
  return null;
}

export async function importMitDataWarehousePeopleFromLegacySchema(props: {
  readonly pg: MitDataWarehouseImportPgClient;
}) {
  const result = await props.pg.query(`
    WITH normalized_dw AS (
      SELECT
        id AS mit_id,
        NULLIF(TRIM(first), '') AS first_name,
        NULLIF(TRIM(last), '') AS last_name,
        NULLIF(TRIM(kerberos), '') AS kerberos,
        NULLIF(TRIM(year), '') AS class_year,
        CASE type
          WHEN 'Current Student' THEN 'CURRENT_STUDENT'::mit_data_warehouse_person_type
          WHEN 'Current Employee' THEN 'CURRENT_STAFF'::mit_data_warehouse_person_type
          WHEN 'Other' THEN 'OTHER'::mit_data_warehouse_person_type
          ELSE NULL
        END AS person_type,
        to_date(loaddate, 'YYYY-MM-DD')::timestamp AS loaded_at
      FROM legacy.dw
      WHERE id ~ '^[0-9]{9}$'
        AND type <> 'Done'
    ),
    valid_dw AS (
      SELECT *
      FROM normalized_dw
      WHERE first_name IS NOT NULL
        AND last_name IS NOT NULL
        AND person_type IS NOT NULL
        AND loaded_at IS NOT NULL
    ),
    upserted AS (
      INSERT INTO mit_data_warehouse_people (
        mit_id,
        first_name,
        last_name,
        kerberos,
        class_year,
        person_type,
        loaded_at,
        updated_at
      )
      SELECT
        mit_id,
        first_name,
        last_name,
        kerberos,
        class_year,
        person_type,
        loaded_at,
        now()
      FROM valid_dw
      ON CONFLICT (mit_id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        kerberos = EXCLUDED.kerberos,
        class_year = EXCLUDED.class_year,
        person_type = EXCLUDED.person_type,
        loaded_at = EXCLUDED.loaded_at,
        updated_at = now()
      RETURNING 1
    )
    SELECT count(*) AS inserted_count FROM upserted
  `);
  const [row] = result.rows;
  if (!isImportedCountRow(row)) {
    throw new TypeError('Invalid mit data warehouse import count row.');
  }
  return { imported: Number(row.inserted_count) };
}
```

- [ ] **Step 4: Run importer test to verify it passes**

Run:

```bash
npx vitest run --project unit src/libs/mit-sailing/mitDataWarehouseImport.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire importer into the successful legacy sync transaction**

Modify `src/libs/legacy-sync/legacyMysqlSync.ts`:

```ts
import { importMitDataWarehousePeopleFromLegacySchema } from '@/libs/mit-sailing/mitDataWarehouseImport';
```

Inside `runLegacyMysqlSync`, after the loop that copies MySQL tables and before returning from `load`, add:

```ts
          await importMitDataWarehousePeopleFromLegacySchema({ pg });
```

The resulting block should be:

```ts
          for (const table of tables) {
            await createMirrorTable({ pg, table });
            loadedRows += BigInt(
              await copyMysqlTableToPostgres({
                pg,
                rows: streamLegacyMysqlTableRows(
                  legacyMysql.mysql,
                  table.tableName
                ),
                table,
              })
            );
          }
          await importMitDataWarehousePeopleFromLegacySchema({ pg });
          return { rowCount: loadedRows, tableCount: tables.length };
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npx vitest run --project unit src/libs/legacy-sync/legacyMysqlSync.test.ts src/libs/mit-sailing/mitDataWarehouseImport.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/libs/legacy-sync/legacyMysqlSync.ts src/libs/mit-sailing/mitDataWarehouseImport.ts src/libs/mit-sailing/mitDataWarehouseImport.test.ts
git commit -m "feat: normalize legacy data warehouse people"
```

## Task 2: Look Up Verified MIT Users By Kerberos

**Files:**
- Modify: `src/libs/mit-sailing/mitDataWarehouse.ts`
- Modify: `src/libs/mit-sailing/mitDataWarehouse.test.ts`

- [ ] **Step 1: Write failing tests for Kerberos lookup**

Append to `src/libs/mit-sailing/mitDataWarehouse.test.ts`:

```ts
  it('returns identity for verified kerberos without asking for mit id', async () => {
    const db = {
      mitDataWarehousePerson: {
        findUnique: vi.fn().mockResolvedValue({
          mitId: '123456789',
          firstName: 'Ada',
          lastName: 'Lovelace',
          kerberos: 'ada',
          classYear: 'G',
          personType: MitDataWarehousePersonType.CURRENT_STUDENT,
        }),
      },
    };

    await expect(
      lookupMitDataWarehouseIdentityByVerifiedKerberos({
        db,
        verifiedKerberos: 'ADA',
      })
    ).resolves.toEqual({
      mitId: '123456789',
      firstName: 'Ada',
      lastName: 'Lovelace',
      kerberos: 'ada',
      classYear: 'G',
      personType: MitDataWarehousePersonType.CURRENT_STUDENT,
    });

    expect(db.mitDataWarehousePerson.findUnique).toHaveBeenCalledWith({
      where: { kerberos: 'ada' },
      select: {
        mitId: true,
        firstName: true,
        lastName: true,
        kerberos: true,
        classYear: true,
        personType: true,
      },
    });
  });

  it('does not query data warehouse without verified kerberos', async () => {
    const db = {
      mitDataWarehousePerson: {
        findUnique: vi.fn(),
      },
    };

    await expect(
      lookupMitDataWarehouseIdentityByVerifiedKerberos({
        db,
        verifiedKerberos: null,
      })
    ).resolves.toBeNull();

    expect(db.mitDataWarehousePerson.findUnique).not.toHaveBeenCalled();
  });
```

Add `lookupMitDataWarehouseIdentityByVerifiedKerberos` to the import list.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run --project unit src/libs/mit-sailing/mitDataWarehouse.test.ts
```

Expected: FAIL because `lookupMitDataWarehouseIdentityByVerifiedKerberos` is missing.

- [ ] **Step 3: Implement Kerberos lookup**

Modify the `MitDataWarehouseDb` type in `src/libs/mit-sailing/mitDataWarehouse.ts` so `where` accepts either unique field:

```ts
      readonly where:
        | { readonly mitId: string }
        | { readonly kerberos: string };
```

Add this helper near `lookupMitDataWarehouseIdentity`:

```ts
const mitDataWarehouseIdentitySelect = {
  mitId: true,
  firstName: true,
  lastName: true,
  kerberos: true,
  classYear: true,
  personType: true,
} as const;
```

Update the existing `lookupMitDataWarehouseIdentity` call to use `select: mitDataWarehouseIdentitySelect`.

Add the new export:

```ts
export const lookupMitDataWarehouseIdentityByVerifiedKerberos = async (props: {
  readonly db?: MitDataWarehouseDb;
  readonly verifiedKerberos: string | null;
}) => {
  const verifiedKerberos = props.verifiedKerberos?.trim().toLowerCase() ?? '';
  if (verifiedKerberos === '') {
    return null;
  }

  const db = props.db ?? prisma;
  return db.mitDataWarehousePerson.findUnique({
    where: { kerberos: verifiedKerberos },
    select: mitDataWarehouseIdentitySelect,
  });
};
```

- [ ] **Step 4: Run focused test**

Run:

```bash
npx vitest run --project unit src/libs/mit-sailing/mitDataWarehouse.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/libs/mit-sailing/mitDataWarehouse.ts src/libs/mit-sailing/mitDataWarehouse.test.ts
git commit -m "feat: find MIT warehouse identity by verified email"
```

## Task 3: Derive Onboarding Defaults From Verified MIT Identity

**Files:**
- Modify: `src/app/[locale]/(marketing)/(site)/onboarding/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/onboarding/onboardingPages.test.tsx`
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingFormTypes.ts`

- [ ] **Step 1: Write failing page tests for current student defaults**

Modify the onboarding form mock props in `src/app/[locale]/(marketing)/(site)/onboarding/onboardingPages.test.tsx`:

```ts
    SailingCardOnboardingForm: (props: {
      callbackUrl?: string;
      initialValues?: unknown;
      lockedIdentity?: unknown;
      verifiedIdentityMode?: unknown;
    }) => (
      <section
        data-callback-url={props.callbackUrl}
        data-initial-values={JSON.stringify(props.initialValues)}
        data-locked-identity={JSON.stringify(props.lockedIdentity ?? null)}
        data-verified-identity-mode={JSON.stringify(
          props.verifiedIdentityMode ?? null
        )}
        data-testid="onboarding-form"
      />
    ),
```

Add mocks:

```ts
const warehouseMocks = vi.hoisted(() => ({
  lookupByKerberos: vi.fn(),
  verifiedKerberosFromEmail: vi.fn(),
}));

vi.mock('@/libs/mit-sailing/mitDataWarehouse', () => ({
  lookupMitDataWarehouseIdentityByVerifiedKerberos:
    warehouseMocks.lookupByKerberos,
  verifiedKerberosFromEmail: warehouseMocks.verifiedKerberosFromEmail,
}));
```

Reset in `beforeEach`:

```ts
  warehouseMocks.lookupByKerberos.mockReset();
  warehouseMocks.verifiedKerberosFromEmail.mockReset();
  warehouseMocks.verifiedKerberosFromEmail.mockReturnValue('ada');
  warehouseMocks.lookupByKerberos.mockResolvedValue(null);
```

Change `mocks.requireCurrentUser.mockResolvedValue` to include email state:

```ts
  mocks.requireCurrentUser.mockResolvedValue({
    id: 'user-1',
    role: Role.USER,
    email: 'ada@mit.edu',
    emailVerified: true,
  });
```

Add test:

```ts
  it('prefills and locks current student identity from verified MIT email', async () => {
    warehouseMocks.lookupByKerberos.mockResolvedValue({
      mitId: '123456789',
      firstName: 'Ada',
      lastName: 'Lovelace',
      kerberos: 'ada',
      classYear: 'G',
      personType: 'CURRENT_STUDENT',
    });
    mocks.findUser.mockResolvedValue({
      ...onboardingUser(),
      firstName: null,
      lastName: null,
      mitClassYear: null,
      mitDataWarehouseVerifiedAt: null,
      mitId: null,
      sailingAffiliation: null,
    });
    const { default: OnboardingPage } = await import('./page');

    render(
      await OnboardingPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(warehouseMocks.lookupByKerberos).toHaveBeenCalledWith({
      verifiedKerberos: 'ada',
    });
    expect(screen.getByTestId('onboarding-form')).toHaveAttribute(
      'data-initial-values',
      expect.stringContaining('"affiliation":"MIT_STUDENT"')
    );
    expect(screen.getByTestId('onboarding-form')).toHaveAttribute(
      'data-initial-values',
      expect.stringContaining('"mitId":"123456789"')
    );
    expect(screen.getByTestId('onboarding-form')).toHaveAttribute(
      'data-locked-identity',
      expect.stringContaining('"firstName":"Ada"')
    );
    expect(screen.getByTestId('onboarding-form')).toHaveAttribute(
      'data-verified-identity-mode',
      '"currentStudent"'
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run --project unit 'src/app/[locale]/(marketing)/(site)/onboarding/onboardingPages.test.tsx'
```

Expected: FAIL because the page does not look up identity by verified Kerberos or pass `verifiedIdentityMode`.

- [ ] **Step 3: Add verified identity mode type**

Modify `src/components/mit-sailing/onboarding/SailingCardOnboardingFormTypes.ts`:

```ts
export type SailingCardOnboardingVerifiedIdentityMode =
  | 'currentStudent'
  | 'currentEmployee'
  | 'mitOther';

export type SailingCardOnboardingLockedIdentity = {
  readonly firstName: string;
  readonly lastName: string;
  readonly mitClassYear: string | null;
};
```

Keep existing fields in `SailingCardOnboardingLockedIdentity` if the file already defines the type; only add `SailingCardOnboardingVerifiedIdentityMode`.

- [ ] **Step 4: Implement server-derived defaults**

Modify `src/app/[locale]/(marketing)/(site)/onboarding/page.tsx` imports:

```ts
import {
  MitDataWarehousePersonType,
  SailingAffiliation,
} from '@/generated/prisma/enums';
import {
  lookupMitDataWarehouseIdentityByVerifiedKerberos,
  verifiedKerberosFromEmail,
} from '@/libs/mit-sailing/mitDataWarehouse';
import type { MitDataWarehouseIdentity } from '@/libs/mit-sailing/mitDataWarehouse';
import type { SailingCardOnboardingVerifiedIdentityMode } from '@/components/mit-sailing/onboarding/SailingCardOnboardingFormTypes';
```

Add helpers near `lockedIdentityFromUser`:

```ts
function verifiedIdentityModeFromWarehouse(
  identity: MitDataWarehouseIdentity | null
): SailingCardOnboardingVerifiedIdentityMode | undefined {
  if (identity?.personType === MitDataWarehousePersonType.CURRENT_STUDENT) {
    return 'currentStudent';
  }
  if (identity?.personType === MitDataWarehousePersonType.CURRENT_STAFF) {
    return 'currentEmployee';
  }
  if (identity?.personType === MitDataWarehousePersonType.OTHER) {
    return 'mitOther';
  }
}

function affiliationFromVerifiedIdentity(
  identity: MitDataWarehouseIdentity | null
) {
  if (identity?.personType === MitDataWarehousePersonType.CURRENT_STUDENT) {
    return SailingAffiliation.MIT_STUDENT;
  }
  return '';
}

function initialValuesFromUserAndWarehouse(props: {
  readonly currentUser: OnboardingUser;
  readonly identity: MitDataWarehouseIdentity | null;
}) {
  const currentValues = initialValuesFromUser(props.currentUser);
  if (props.identity === null) {
    return currentValues;
  }
  return {
    ...currentValues,
    affiliation:
      currentValues.affiliation || affiliationFromVerifiedIdentity(props.identity),
    firstName: currentValues.firstName || props.identity.firstName,
    lastName: currentValues.lastName || props.identity.lastName,
    mitId: currentValues.mitId || props.identity.mitId,
  };
}

function lockedIdentityFromWarehouse(
  identity: MitDataWarehouseIdentity | null
) {
  if (identity === null) {
    return;
  }
  return {
    firstName: identity.firstName,
    lastName: identity.lastName,
    mitClassYear: identity.classYear,
  };
}
```

In `OnboardingPage`, after `currentUser`:

```ts
  const verifiedKerberos = verifiedKerberosFromEmail({
    email: typeof user.email === 'string' ? user.email : null,
    emailVerified: user.emailVerified,
  });
  const warehouseIdentity =
    currentUser?.mitDataWarehouseVerifiedAt === null ||
    currentUser?.mitDataWarehouseVerifiedAt === undefined
      ? await lookupMitDataWarehouseIdentityByVerifiedKerberos({
          verifiedKerberos,
        })
      : null;
```

Replace initial value and locked identity creation:

```ts
  const initialValues = initialValuesFromUserAndWarehouse({
    currentUser,
    identity: warehouseIdentity,
  });
  const lockedIdentity =
    lockedIdentityFromUser(currentUser) ??
    lockedIdentityFromWarehouse(warehouseIdentity);
  const verifiedIdentityMode = verifiedIdentityModeFromWarehouse(warehouseIdentity);
```

Pass the prop:

```tsx
          <SailingCardOnboardingForm
            callbackUrl={callbackUrl}
            initialValues={initialValues}
            lockedIdentity={lockedIdentity}
            verifiedIdentityMode={verifiedIdentityMode}
          />
```

- [ ] **Step 5: Run page tests**

Run:

```bash
npx vitest run --project unit 'src/app/[locale]/(marketing)/(site)/onboarding/onboardingPages.test.tsx'
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/[locale]/(marketing)/(site)/onboarding/page.tsx' 'src/app/[locale]/(marketing)/(site)/onboarding/onboardingPages.test.tsx' src/components/mit-sailing/onboarding/SailingCardOnboardingFormTypes.ts
git commit -m "feat: prefill onboarding from verified MIT email"
```

## Task 4: Simplify The Current Student Form UI

**Files:**
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingFormModel.ts`
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingFormSections.tsx`
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingIdentityFields.tsx`
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Write failing UI test for the current student path**

Add to `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx`:

```ts
  it('starts verified current students at contact details without identity questions', () => {
    renderForm({
      initialValues: {
        ...emptyValues,
        affiliation: SailingAffiliation.MIT_STUDENT,
        mitId: '123456789',
      },
      lockedIdentity: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        mitClassYear: 'G',
      },
      verifiedIdentityMode: 'currentStudent',
    });

    expect(screen.queryByRole('combobox', { name: 'Affiliation' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('MIT ID')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    expect(screen.getByText('Verified with your MIT email')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('MIT student')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Contact details' })
    ).toBeInTheDocument();
    expect(screen.getByText('MIT students meet the MIT Fitness requirement for Normal membership.')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run --project component src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx
```

Expected: FAIL because `verifiedIdentityMode` is not supported by the form.

- [ ] **Step 3: Add form prop and make identity complete**

Modify `SailingCardOnboardingFormProps` in `src/components/mit-sailing/onboarding/SailingCardOnboardingFormModel.ts`:

```ts
  readonly verifiedIdentityMode?: SailingCardOnboardingVerifiedIdentityMode;
```

Import the type:

```ts
import type {
  SailingCardOnboardingLockedIdentity,
  SailingCardOnboardingVerifiedIdentityMode,
} from './SailingCardOnboardingFormTypes';
```

In `getOnboardingIdentityModel`, add a prop:

```ts
  readonly verifiedIdentityMode?: SailingCardOnboardingVerifiedIdentityMode;
```

Before calculating `identityComplete`, add:

```ts
  const verifiedCurrentStudent =
    props.verifiedIdentityMode === 'currentStudent' &&
    props.lockedIdentity !== undefined;
```

Return `identityComplete: verifiedCurrentStudent || identityComplete`.

Pass `verifiedIdentityMode: props.verifiedIdentityMode` from `useSailingCardOnboardingFormModel`.

Change `showDetails` calculation so verified current students do not need the Continue click:

```ts
    showDetails:
      props.verifiedIdentityMode === 'currentStudent'
        ? true
        : shouldShowDetails({
            detailsUnlocked: runtime.detailsUnlocked,
            identityComplete: identity.identityComplete,
            state: runtime.state,
          }),
```

Return `verifiedIdentityMode: props.verifiedIdentityMode`.

- [ ] **Step 4: Render verified identity summary**

In `src/components/mit-sailing/onboarding/SailingCardOnboardingIdentityFields.tsx`, add:

```tsx
export function VerifiedCurrentStudentSummary(props: {
  readonly identity: SailingCardOnboardingLockedIdentity;
}) {
  const t = useTranslations('OnboardingPage');
  const classYear = props.identity.mitClassYear
    ? t('verified_identity_class_year', {
        classYear: props.identity.mitClassYear,
      })
    : null;

  return (
    <section className="rounded border border-border bg-muted/30 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('verified_identity_label')}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {props.identity.firstName} {props.identity.lastName}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {classYear ?? t('affiliation_mit_student')}
      </p>
    </section>
  );
}
```

In `src/components/mit-sailing/onboarding/SailingCardOnboardingFormSections.tsx`, import it and add `verifiedIdentityMode` to props. Replace the top of `OnboardingFormFields` with:

```tsx
      {props.verifiedIdentityMode === 'currentStudent' &&
      props.lockedIdentity !== undefined ? (
        <VerifiedCurrentStudentSummary identity={props.lockedIdentity} />
      ) : (
        <AffiliationSelect
          affiliation={props.affiliation}
          register={props.register}
          state={props.state}
        />
      )}
```

Wrap the existing `IdentityFields` block with:

```tsx
      {props.verifiedIdentityMode === 'currentStudent' ||
      props.affiliation === '' ? null : (
```

- [ ] **Step 5: Add translations**

Modify `src/locales/en.json` under `OnboardingPage`:

```json
    "verified_identity_label": "Verified with your MIT email",
    "verified_identity_class_year": "MIT student, class/year {classYear}",
```

- [ ] **Step 6: Run UI test**

Run:

```bash
npx vitest run --project component src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/mit-sailing/onboarding/SailingCardOnboardingFormModel.ts src/components/mit-sailing/onboarding/SailingCardOnboardingFormSections.tsx src/components/mit-sailing/onboarding/SailingCardOnboardingIdentityFields.tsx src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx src/locales/en.json
git commit -m "feat: simplify onboarding for MIT student emails"
```

## Task 5: Preserve Server Validation For Hidden Verified Identity

**Files:**
- Modify: `src/libs/mit-sailing/sailingCardOnboarding.ts`
- Modify: `src/libs/mit-sailing/sailingCardOnboarding.test.ts`
- Modify: `src/libs/mit-sailing/sailingCardOnboardingActions.ts`
- Modify: `src/libs/mit-sailing/sailingCardOnboardingActions.test.ts`

- [ ] **Step 1: Write failing model test for hidden current student identity**

Add to `src/libs/mit-sailing/sailingCardOnboarding.test.ts`:

```ts
  it('accepts server-provided current student identity without visible mit id entry', () => {
    expect(
      buildSailingCardOnboardingUpdate({
        input: {
          ...contactInput,
          affiliation: SailingAffiliation.MIT_STUDENT,
          mitId: '',
          firstName: '',
          lastName: '',
        },
        dataWarehouseIdentity: studentIdentity,
        now: new Date('2026-05-21T12:00:00-04:00'),
      })
    ).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      mitId: '123456789',
      mitClassYear: '2027',
      sailingAffiliation: SailingAffiliation.MIT_STUDENT,
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run --project unit src/libs/mit-sailing/sailingCardOnboarding.test.ts
```

Expected: FAIL because `requireMatchingDataWarehouseIdentity` requires a normalized MIT ID from the form input.

- [ ] **Step 3: Allow verified identity to supply MIT ID**

Modify `requireMatchingDataWarehouseIdentity` in `src/libs/mit-sailing/sailingCardOnboarding.ts`:

```ts
const requireMatchingDataWarehouseIdentity = (props: {
  readonly dataWarehouseIdentity: MitDataWarehouseIdentity | null;
  readonly normalizedMitId: string | null;
  readonly missingCode: SailingCardOnboardingFieldError;
}) => {
  if (props.dataWarehouseIdentity === null) {
    throw new SailingCardOnboardingValidationError({
      mitId: props.missingCode,
    });
  }

  if (
    props.normalizedMitId !== null &&
    props.dataWarehouseIdentity.mitId !== props.normalizedMitId
  ) {
    throw new SailingCardOnboardingValidationError({
      mitId: 'invalid_dw_identity',
    });
  }

  return props.dataWarehouseIdentity;
};
```

- [ ] **Step 4: Update action lookup order**

In `src/libs/mit-sailing/sailingCardOnboardingActions.ts`, import:

```ts
  lookupMitDataWarehouseIdentityByVerifiedKerberos,
```

Replace the `dataWarehouseIdentity` block with:

```ts
  const verifiedEmailIdentity =
    await lookupMitDataWarehouseIdentityByVerifiedKerberos({
      verifiedKerberos,
    });
  const dataWarehouseIdentity =
    verifiedEmailIdentity ??
    (input.mitId.trim() === ''
      ? null
      : await lookupMitDataWarehouseIdentity({
          mitId: input.mitId,
          verifiedKerberos,
        }));
```

This keeps MIT ID fallback for non-prefilled users while allowing verified MIT email users to submit with a hidden MIT ID field.

- [ ] **Step 5: Run action tests and update mocks**

In `src/libs/mit-sailing/sailingCardOnboardingActions.test.ts`, add `lookupMitDataWarehouseIdentityByVerifiedKerberos: vi.fn()` to the hoisted MIT warehouse mocks, export it from the module mock, and reset it to `null` in `beforeEach`.

Add test:

```ts
  it('uses verified MIT email identity before asking for mit id lookup', async () => {
    const formData = onboardingFormData();
    formData.set('mitId', '');
    mocks.lookupMitDataWarehouseIdentityByVerifiedKerberos.mockResolvedValue({
      mitId: '123456789',
      firstName: 'Ada',
      lastName: 'Lovelace',
      kerberos: 'ada',
      classYear: 'G',
      personType: MitDataWarehousePersonType.CURRENT_STUDENT,
    });

    await expect(
      submitSailingCardOnboardingAction(idleState, formData)
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.lookupMitDataWarehouseIdentityByVerifiedKerberos).toHaveBeenCalledWith({
      verifiedKerberos: 'ada',
    });
    expect(mocks.lookupMitDataWarehouseIdentity).not.toHaveBeenCalled();
  });
```

Run:

```bash
npx vitest run --project unit src/libs/mit-sailing/sailingCardOnboarding.test.ts src/libs/mit-sailing/sailingCardOnboardingActions.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/libs/mit-sailing/sailingCardOnboarding.ts src/libs/mit-sailing/sailingCardOnboarding.test.ts src/libs/mit-sailing/sailingCardOnboardingActions.ts src/libs/mit-sailing/sailingCardOnboardingActions.test.ts
git commit -m "feat: validate onboarding from verified MIT email identity"
```

## Task 6: Add Compact Staff And MIT Other Paths

**Files:**
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingIdentityFields.tsx`
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingFormSections.tsx`
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Write failing staff path test**

Add to `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx`:

```ts
  it('asks verified current employees to choose faculty or staff only', () => {
    renderForm({
      initialValues: {
        ...emptyValues,
        mitId: '123456789',
      },
      lockedIdentity: {
        firstName: 'Grace',
        lastName: 'Hopper',
        mitClassYear: null,
      },
      verifiedIdentityMode: 'currentEmployee',
    });

    expect(screen.queryByLabelText('MIT ID')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Last name')).not.toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'MIT affiliation' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'MIT faculty' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'MIT staff' })).toBeInTheDocument();
  });
```

Add an equivalent `mitOther` test that expects options `MIT alum`, `MIT family`, and `MIT affiliate`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run --project component src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx
```

Expected: FAIL because compact verified MIT relationship controls do not exist.

- [ ] **Step 3: Implement compact relationship select**

In `SailingCardOnboardingIdentityFields.tsx`, add:

```tsx
const verifiedRelationshipOptions = {
  currentEmployee: [
    SailingAffiliation.MIT_FACULTY,
    SailingAffiliation.MIT_STAFF,
  ],
  mitOther: [
    SailingAffiliation.MIT_ALUM,
    SailingAffiliation.MIT_FAMILY,
    SailingAffiliation.MIT_AFFILIATE,
  ],
} as const;

export function VerifiedMitRelationshipSelect(props: {
  readonly mode: 'currentEmployee' | 'mitOther';
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const affiliationError = props.state.fieldErrors.affiliation;
  const helpId = 'sailing-card-onboarding-verified-relationship-help';

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-foreground" htmlFor="affiliation">
        {t('verified_relationship_label')}
      </Label>
      <select
        aria-describedby={
          affiliationError
            ? `${helpId} ${fieldErrorId('affiliation')}`
            : helpId
        }
        aria-invalid={affiliationError ? true : undefined}
        className={adminNativeSelectClassName}
        id="affiliation"
        required
        {...props.register('affiliation', { required: true })}
      >
        <option value="">{t('verified_relationship_placeholder')}</option>
        {verifiedRelationshipOptions[props.mode].map((affiliation) => (
          <option key={affiliation} value={affiliation}>
            {t(affiliationLabelKey(affiliation))}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground" id={helpId}>
        {props.mode === 'currentEmployee'
          ? t('verified_employee_relationship_help')
          : t('verified_other_relationship_help')}
      </p>
      <FieldError field="affiliation" state={props.state} />
    </div>
  );
}
```

In `OnboardingFormFields`, render the summary plus this select for `currentEmployee` and `mitOther`, and do not render the full affiliation select for those modes.

- [ ] **Step 4: Add translations**

Modify `src/locales/en.json` under `OnboardingPage`:

```json
    "verified_relationship_label": "MIT affiliation",
    "verified_relationship_placeholder": "Select your MIT affiliation",
    "verified_employee_relationship_help": "MIT records confirmed your employee status. Choose the affiliation staff should use on your sailing card request.",
    "verified_other_relationship_help": "MIT records matched your email. Choose the MIT relationship staff should use on your sailing card request."
```

- [ ] **Step 5: Run UI tests**

Run:

```bash
npx vitest run --project component src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/mit-sailing/onboarding/SailingCardOnboardingIdentityFields.tsx src/components/mit-sailing/onboarding/SailingCardOnboardingFormSections.tsx src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx src/locales/en.json
git commit -m "feat: confirm ambiguous MIT onboarding affiliation"
```

## Task 7: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused onboarding tests**

Run:

```bash
npx vitest run --project unit src/libs/mit-sailing/mitDataWarehouse.test.ts src/libs/mit-sailing/mitDataWarehouseImport.test.ts src/libs/mit-sailing/sailingCardOnboarding.test.ts src/libs/mit-sailing/sailingCardOnboardingActions.test.ts 'src/app/[locale]/(marketing)/(site)/onboarding/onboardingPages.test.tsx' --project component src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx src/components/mit-sailing/onboarding/SailingCardOnboardingFormSubmission.test.tsx
```

Expected: PASS. If Vitest rejects mixed project arguments, run the same files in two commands, one with `--project unit` and one with `--project component`.

- [ ] **Step 2: Run required repo checks**

Run:

```bash
npm run lint
npm run check:types
npm run check:i18n
npm run test
```

Expected: all commands PASS.

- [ ] **Step 3: Optional local browser check**

Run:

```bash
npm run dev
```

Open `/api/dev-login?email=<seeded-admin-email>&password=<seeded-admin-password>&redirect=/onboarding` only in local dev. Verify:

- Verified current student users see no affiliation, MIT ID, name, class year, or MIT Fitness question.
- They land directly on contact details and card request fields.
- Verified employee users choose only MIT faculty or MIT staff.
- Verified Data Warehouse `Other` users choose only MIT alum, MIT family, or MIT affiliate.
- Non-MIT and unmatched users keep the existing affiliation-first flow.

- [ ] **Step 4: Inspect the verification diff**

```bash
git status --short
```

Expected: only intentional source, test, locale, and plan files are changed.

## Self-Review

- Spec coverage: the plan covers MIT email signup onboarding, current student auto-fill/hiding, legacy Data Warehouse type verification, employee mapping, Data Warehouse `Other` treatment, and a cautious non-schema merge strategy for Other.
- Placeholder scan: no unresolved implementation markers remain.
- Type consistency: `CURRENT_STUDENT`, `CURRENT_STAFF`, `OTHER`, `MIT_STUDENT`, `MIT_FACULTY`, `MIT_STAFF`, `MIT_ALUM`, `MIT_FAMILY`, and `MIT_AFFILIATE` match the existing Prisma enums.
