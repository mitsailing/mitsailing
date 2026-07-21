/**
 * Namespaced localStorage key for persisted collapsed site alert banner state (v1 schema).
 */
export const SITE_ALERT_BANNER_COLLAPSE_STORAGE_KEY =
  'mit-sailing:site-alert-banner:v1';

type StoredSiteAlertBannerCollapse = {
  alerts: SiteAlertBannerCollapseAlert[];
  collapsed: true;
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
): value is StoredSiteAlertBannerCollapse {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.collapsed === true &&
    Array.isArray(value.alerts) &&
    value.alerts.every(isSiteAlertBannerCollapseAlert)
  );
}

/**
 * Parses localStorage JSON into collapsed alert entries, or null when missing or invalid.
 *
 * @param raw Serialized storage string, or null when unset.
 * @returns Parsed alert list, or null when input is empty or JSON is invalid or shape does not match.
 */
export function parseStoredSiteAlertBannerCollapse(
  raw: string | null
): SiteAlertBannerCollapseAlert[] | null {
  if (!raw) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!isStoredSiteAlertBannerCollapse(value)) {
      return null;
    }
    return value.alerts;
  } catch {
    return null;
  }
}

/**
 * Serializes collapsed alerts for localStorage using the stored wrapper shape.
 *
 * @param alerts Alert identities to persist.
 * @returns JSON string with `collapsed: true` and the alerts array.
 */
export function serializeSiteAlertBannerCollapse(
  alerts: SiteAlertBannerCollapseAlert[]
): string {
  return JSON.stringify({ collapsed: true, alerts });
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
 * @param props.storedAlerts Alerts from storage when the user collapsed the banner, or null when none.
 * @returns True when storage exists, there is at least one current alert, and each id's fingerprint matches storage.
 */
export function siteAlertBannerStartsCollapsed(props: {
  currentAlerts: readonly SiteAlertBannerCollapseAlert[];
  storedAlerts: SiteAlertBannerCollapseAlert[] | null;
}): boolean {
  if (!props.storedAlerts) {
    return false;
  }

  if (props.currentAlerts.length === 0) {
    return false;
  }

  const storedFingerprintsById = new Map(
    props.storedAlerts.map((alert) => [alert.id, alert.contentFingerprint])
  );

  return props.currentAlerts.every(
    (alert) => storedFingerprintsById.get(alert.id) === alert.contentFingerprint
  );
}
