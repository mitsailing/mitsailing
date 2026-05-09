export const SITE_ALERT_BANNER_COLLAPSE_STORAGE_KEY =
  'mit-sailing:site-alert-banner:v1';

type StoredSiteAlertBannerCollapse = {
  alerts: SiteAlertBannerCollapseAlert[];
  collapsed: true;
};

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

export function serializeSiteAlertBannerCollapse(
  alerts: SiteAlertBannerCollapseAlert[]
): string {
  return JSON.stringify({ collapsed: true, alerts });
}

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

export function siteAlertBannerStartsCollapsed(props: {
  currentAlerts: SiteAlertBannerCollapseAlert[];
  storedAlerts: SiteAlertBannerCollapseAlert[] | null;
}): boolean {
  if (!props.storedAlerts) {
    return false;
  }

  const storedFingerprintsById = new Map(
    props.storedAlerts.map((alert) => [alert.id, alert.contentFingerprint])
  );

  return props.currentAlerts.every(
    (alert) => storedFingerprintsById.get(alert.id) === alert.contentFingerprint
  );
}
