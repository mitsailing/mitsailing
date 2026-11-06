/**
 * Namespaced localStorage key for persisted collapsed news banner state (v1 schema).
 */
export const NEWS_BANNER_COLLAPSE_STORAGE_KEY = 'mit-sailing:news-banner:v1';

/**
 * Persisted banner disclosure: news identities plus whether the strip is collapsed.
 */
export type NewsBannerCollapseStored = {
  alerts: NewsBannerCollapseAlert[];
  collapsed: boolean;
};

/**
 * Identifies a news item when persisting collapse state: stable id plus a content fingerprint.
 *
 * @property {string} contentFingerprint Serialized fingerprint of body plain text and date ISO so content changes invalidate collapse.
 * @property {string} id Stable news identifier aligned with the source row.
 */
export type NewsBannerCollapseAlert = {
  contentFingerprint: string;
  id: string;
};

type NewsBannerCollapseRow = {
  bodyPlainText: string;
  dateLabel?: string;
  dateIso: string;
  id: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNewsBannerCollapseAlert(
  value: unknown
): value is NewsBannerCollapseAlert {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.contentFingerprint === 'string' && typeof value.id === 'string'
  );
}

function isStoredNewsBannerCollapse(
  value: unknown
): value is NewsBannerCollapseStored {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.collapsed === 'boolean' &&
    Array.isArray(value.alerts) &&
    value.alerts.every(isNewsBannerCollapseAlert)
  );
}

/**
 * Parses localStorage JSON into collapsed news entries, or null when missing or invalid.
 *
 * @param raw Serialized storage string, or null when unset.
 * @returns Parsed disclosure state, or null when input is empty or invalid
 */
export function parseStoredNewsBannerCollapse(
  raw: string | null
): NewsBannerCollapseStored | null {
  if (!raw) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!isStoredNewsBannerCollapse(value)) {
      return null;
    }
    return { alerts: value.alerts, collapsed: value.collapsed };
  } catch {
    return null;
  }
}

/**
 * Serializes banner disclosure for localStorage.
 *
 * @param alerts - News identities to persist
 * @param collapsed - Whether the banner should start collapsed
 * @returns JSON string with collapsed flag and alerts
 */
export function serializeNewsBannerCollapse(
  alerts: NewsBannerCollapseAlert[],
  collapsed = true
): string {
  return JSON.stringify({ alerts, collapsed });
}

/**
 * Maps banner rows to collapse records with ids and content fingerprints.
 *
 * @param rows Banner rows with body plain text, optional date label, ISO date, and id.
 * @returns One entry per row: id plus fingerprint derived from body and date ISO.
 */
export function buildNewsBannerCollapseAlerts(
  rows: NewsBannerCollapseRow[]
): NewsBannerCollapseAlert[] {
  return rows.map((row) => ({
    id: row.id,
    contentFingerprint: JSON.stringify({
      bodyPlainText: row.bodyPlainText,
      dateIso: row.dateIso,
    }),
  }));
}

/**
 * Returns whether stored collapse state still matches every current item so the banner can start collapsed.
 *
 * @param props Current page items and last persisted collapse snapshot.
 * @param props.currentAlerts Items currently rendered for the banner.
 * @param props.stored Last persisted disclosure, or null when none
 * @returns True when the banner should render collapsed
 */
export function newsBannerStartsCollapsed(props: {
  currentAlerts: readonly NewsBannerCollapseAlert[];
  stored: NewsBannerCollapseStored | null;
}): boolean {
  if (!props.stored) {
    return true;
  }

  if (!props.stored.collapsed) {
    return false;
  }

  if (props.currentAlerts.length === 0) {
    return false;
  }

  const storedFingerprintsById = new Map(
    props.stored.alerts.map((alert) => [alert.id, alert.contentFingerprint])
  );

  return props.currentAlerts.every(
    (alert) => storedFingerprintsById.get(alert.id) === alert.contentFingerprint
  );
}
