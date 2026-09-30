/**
 * Namespaced localStorage key for persisted collapsed site alert banner state (v1 schema).
 */
export const SITE_ALERT_BANNER_COLLAPSE_STORAGE_KEY =
  'mit-sailing:site-alert-banner:v1';

/**
 * Persisted banner disclosure: alert identities plus whether the strip is collapsed.
 */
export type SiteAlertBannerCollapseStored = {
  alerts: SiteAlertBannerCollapseAlert[];
  collapsed: boolean;
};

/**
 * Identifies a site alert when persisting collapse state: stable id plus a content fingerprint.
 *
 * @property {string} contentFingerprint Serialized fingerprint of body plain text and date ISO so content changes invalidate collapse.
 * @property {string} id Stable alert identifier aligned with the source row.
 */
export type SiteAlertBannerCollapseAlert = {
  contentFingerprint: string;
  id: string;
};

type SiteAlertBannerCollapseRow = {
  bodyPlainText: string;
  dateLabel?: string;
  dateIso: string;
  id: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSiteAlertBannerCollapseAlert(
  value: unknown
): value is SiteAlertBannerCollapseAlert {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.contentFingerprint === 'string' && typeof value.id === 'string'
  );
}

function isStoredSiteAlertBannerCollapse(
  value: unknown
): value is SiteAlertBannerCollapseStored {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.collapsed === 'boolean' &&
    Array.isArray(value.alerts) &&
    value.alerts.every(isSiteAlertBannerCollapseAlert)
  );
}

/**
 * Parses localStorage JSON into collapsed alert entries, or null when missing or invalid.
 *
 * @param raw Serialized storage string, or null when unset.
 * @returns Parsed disclosure state, or null when input is empty or invalid
 */
export function parseStoredSiteAlertBannerCollapse(
  raw: string | null
): SiteAlertBannerCollapseStored | null {
  if (!raw) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!isStoredSiteAlertBannerCollapse(value)) {
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
 * @param alerts - Alert identities to persist
 * @param collapsed - Whether the banner should start collapsed
 * @returns JSON string with collapsed flag and alerts
 */
export function serializeSiteAlertBannerCollapse(
  alerts: SiteAlertBannerCollapseAlert[],
  collapsed = true
): string {
  return JSON.stringify({ alerts, collapsed });
}

/**
 * Maps banner rows to collapse-alert records with ids and content fingerprints.
 *
 * @param rows Banner rows with body plain text, optional date label, ISO date, and id.
 * @returns One alert per row: id plus fingerprint derived from body and date ISO.
 */
export function buildSiteAlertBannerCollapseAlerts(
  rows: SiteAlertBannerCollapseRow[]
): SiteAlertBannerCollapseAlert[] {
  return rows.map((row) => ({
    id: row.id,
    contentFingerprint: JSON.stringify({
      bodyPlainText: row.bodyPlainText,
      dateIso: row.dateIso,
    }),
  }));
}

/**
 * Returns whether stored collapse state still matches every current alert so the banner can start collapsed.
 *
 * @param props Current page alerts and last persisted collapse snapshot.
 * @param props.currentAlerts Alerts currently rendered for the banner.
 * @param props.stored Last persisted disclosure, or null when none
 * @returns True when the banner should render collapsed
 */
export function siteAlertBannerStartsCollapsed(props: {
  currentAlerts: readonly SiteAlertBannerCollapseAlert[];
  stored: SiteAlertBannerCollapseStored | null;
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
