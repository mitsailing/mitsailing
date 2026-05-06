import type {
  AdminFormFieldDef,
  CatalogResourceDefinition,
  CatalogRow,
  CatalogSnapshotValue,
  CatalogVersionSnapshot,
} from '@/libs/admin/catalog/types';

export type CatalogVersionDiffField = {
  field: AdminFormFieldDef;
  currentValue: CatalogSnapshotValue;
  snapshotValue: CatalogSnapshotValue;
  changed: boolean;
};

function normalizedSnapshotValue(value: unknown): CatalogSnapshotValue {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  return null;
}

function valueForFormData(value: CatalogSnapshotValue): string {
  if (value === null) {
    return '';
  }
  return String(value);
}

function restorableFormFields(
  definition: CatalogResourceDefinition
): readonly AdminFormFieldDef[] {
  return definition.formFields.filter(
    (field) => field.kind !== 'fleetVisibleBoats'
  );
}

/**
 * Normalizes a serialized catalog row to JSON-safe primitive values.
 *
 * @param row - Catalog row returned by resource handlers
 * @returns Snapshot suitable for storing on a change log
 */
export function catalogSnapshotFromRow(
  row: CatalogRow
): CatalogVersionSnapshot {
  const snapshot: CatalogVersionSnapshot = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== undefined) {
      snapshot[key] = normalizedSnapshotValue(value);
    }
  }
  return snapshot;
}

/**
 * Narrows database JSON into a catalog version snapshot.
 *
 * @param value - Unknown JSON value from Prisma
 * @returns Snapshot when all values are supported primitives
 */
export function catalogSnapshotFromUnknown(
  value: unknown
): CatalogVersionSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const snapshot: CatalogVersionSnapshot = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      item === null ||
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean'
    ) {
      snapshot[key] = item;
    } else {
      return null;
    }
  }
  return snapshot;
}

/**
 * Builds update form data from a stored snapshot.
 *
 * @param definition - Catalog definition controlling restorable fields
 * @param snapshot - Stored row snapshot
 * @returns FormData accepted by the resource update handler
 */
export function catalogSnapshotFormData(
  definition: CatalogResourceDefinition,
  snapshot: CatalogVersionSnapshot
): FormData {
  const formData = new FormData();
  for (const field of restorableFormFields(definition)) {
    formData.set(field.field, valueForFormData(snapshot[field.field] ?? null));
  }
  return formData;
}

/**
 * Produces field-level comparison data for current row vs stored snapshot.
 *
 * @param props - Definition, current row, and stored snapshot
 * @returns Diff rows in form-field order
 */
export function catalogVersionDiffFields(props: {
  definition: CatalogResourceDefinition;
  current: CatalogRow;
  snapshot: CatalogVersionSnapshot;
}): readonly CatalogVersionDiffField[] {
  return restorableFormFields(props.definition).map((field) => {
    const currentValue = normalizedSnapshotValue(props.current[field.field]);
    const snapshotValue = props.snapshot[field.field] ?? null;
    return {
      field,
      currentValue,
      snapshotValue,
      changed:
        valueForFormData(currentValue) !== valueForFormData(snapshotValue),
    };
  });
}
