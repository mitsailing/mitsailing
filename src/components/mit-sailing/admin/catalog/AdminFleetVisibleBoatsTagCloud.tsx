'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';

const COLLAPSED_TAG_CAP = 10;

type AdminFleetVisibleBoatsTagCloudProps = {
  boats: readonly { name: string; slug: string }[];
};

/**
 * Read-only chips for boats currently marked visible on the fleet catalog.
 *
 * @param props - Boats in display order (slug is stable React key)
 * @returns Wrapped tag list with optional expand/collapse
 */
export function AdminFleetVisibleBoatsTagCloud(
  props: AdminFleetVisibleBoatsTagCloudProps
) {
  const t = useTranslations('AdminCatalogResource');
  const [expanded, setExpanded] = useState(false);
  const { boats } = props;
  if (boats.length === 0) {
    return (
      <p className="m-0 text-sm text-mit-text">{t('fleet_tag_cloud_empty')}</p>
    );
  }
  const needsToggle = boats.length > COLLAPSED_TAG_CAP;
  const shown = expanded ? boats : boats.slice(0, COLLAPSED_TAG_CAP);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {shown.map((boat) => (
          <span
            className="inline-flex max-w-full items-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm font-medium text-mit-text"
            key={boat.slug}
          >
            <span className="truncate">{boat.name}</span>
          </span>
        ))}
      </div>
      {needsToggle ? (
        <button
          className={`self-start text-sm font-semibold text-mit-red hover:underline ${textFocusRingClassName}`}
          onClick={() => {
            setExpanded((v) => !v);
          }}
          type="button"
        >
          {expanded
            ? t('fleet_tag_cloud_show_less')
            : t('fleet_tag_cloud_show_all')}
        </button>
      ) : null}
    </div>
  );
}
