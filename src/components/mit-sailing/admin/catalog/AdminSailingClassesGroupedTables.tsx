'use client';

import { AdminCatalogTable } from '@/components/mit-sailing/admin/catalog/AdminCatalogTable';
import type {
  CatalogResourceDefinition,
  CatalogRow,
} from '@/libs/admin/catalog/types';

type AdminSailingClassesGroupedTablesProps = {
  locale: string;
  definition: CatalogResourceDefinition;
  rows: CatalogRow[];
};

/**
 * Renders sailing-class catalog rows grouped by category; drag-and-drop reorder
 * runs within each category only (scoped server validation).
 *
 * @param props - Locale, catalog definition, flat list rows (includes category fields)
 * @returns One table section per class category
 */
export function AdminSailingClassesGroupedTables(
  props: AdminSailingClassesGroupedTablesProps
) {
  const map = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      categoryDisplayOrder: number;
      rows: CatalogRow[];
    }
  >();

  for (const row of props.rows) {
    const cid = String(row.classCategoryId ?? '');
    if (cid.length === 0) {
      continue;
    }
    let group = map.get(cid);
    if (!group) {
      group = {
        categoryId: cid,
        categoryName: String(row.classCategoryName ?? ''),
        categoryDisplayOrder: Number(row.classCategoryDisplayOrder ?? 0),
        rows: [],
      };
      map.set(cid, group);
    }
    group.rows.push(row);
  }

  const groups = [...map.values()].toSorted(
    (a, b) =>
      a.categoryDisplayOrder - b.categoryDisplayOrder ||
      a.categoryName.localeCompare(b.categoryName)
  );

  return (
    <div className="flex flex-col gap-10">
      {groups.map((g) => (
        <section key={g.categoryId} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-mit-text">
            {g.categoryName}
          </h2>
          <AdminCatalogTable
            definition={props.definition}
            locale={props.locale}
            reorderScope={{ classCategoryId: g.categoryId }}
            resourceId="sailing_classes"
            rows={g.rows}
          />
        </section>
      ))}
    </div>
  );
}
