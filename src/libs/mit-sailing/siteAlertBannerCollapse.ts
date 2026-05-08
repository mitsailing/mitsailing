export const SITE_ALERT_BANNER_COLLAPSE_STORAGE_KEY =
  'mit-sailing:site-alert-banner:v1';

type StoredSiteAlertBannerCollapse = {
  collapsed: true;
  fingerprint: string;
};

function isStoredSiteAlertBannerCollapse(
  value: unknown
): value is StoredSiteAlertBannerCollapse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as {
    collapsed?: unknown;
    fingerprint?: unknown;
  };
  return record.collapsed === true && typeof record.fingerprint === 'string';
}

export function parseStoredSiteAlertBannerCollapse(
  raw: string | null
): string | null {
  if (!raw) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!isStoredSiteAlertBannerCollapse(value)) {
      return null;
    }
    return value.fingerprint;
  } catch {
    return null;
  }
}

export function serializeSiteAlertBannerCollapse(fingerprint: string): string {
  return JSON.stringify({ collapsed: true, fingerprint });
}

export function siteAlertBannerStartsCollapsed(props: {
  currentFingerprint: string;
  storedFingerprint: string | null;
}): boolean {
  return props.storedFingerprint === props.currentFingerprint;
}
