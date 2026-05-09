export const SITE_ALERT_BANNER_COLLAPSE_STORAGE_KEY =
  'mit-sailing:site-alert-banner:v1';

type StoredSiteAlertBannerCollapse = {
  alerts: SiteAlertBannerCollapseAlert[];
  collapsed: true;
};

/**
 * Represents a single alert for collapse tracking.
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
  return Boolean(value) && typeof value === 'object';
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
 * Parses stored site alert banner collapse state from JSON.
 *
 * @param raw - JSON string from localStorage
 * @returns Parsed alert array or null if invalid
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
 * Serializes site alert banner collapse state to JSON.
 *
 * @param alerts - Array of alerts to serialize
 * @returns JSON string for localStorage
 */
export function serializeSiteAlertBannerCollapse(
  alerts: SiteAlertBannerCollapseAlert[]
): string {
  return JSON.stringify({ collapsed: true, alerts });
}

/**
 * Builds collapse alerts from alert rows with fingerprints.
 *
 * @param rows - Alert rows with body text and dates
 * @returns Array of alerts with content fingerprints
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
 * Determines if the site alert banner starts in collapsed state.
 *
 * @param props - Current and stored alerts
 * @returns True if all current alerts match stored fingerprints
 */
export function siteAlertBannerStartsCollapsed(props: {
  currentAlerts: SiteAlertBannerCollapseAlert[];
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
