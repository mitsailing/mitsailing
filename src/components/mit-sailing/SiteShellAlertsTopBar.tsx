import {
  buildSiteAlertsFingerprint,
  listSiteAlertsForBannerAt,
  mapSiteAlertsToBannerRows,
} from '@/libs/mit-sailing/siteAlertQueries';
import { SiteAlertsBanner } from './site/SiteAlertsBanner';

/**
 * Resolves cached active site alerts for the global shell top bar.
 *
 * @returns Top-bar alert banner or nothing when no alerts are active
 */
export async function SiteShellAlertsTopBar() {
  const alerts = await listSiteAlertsForBannerAt(new Date());
  const rows = mapSiteAlertsToBannerRows(alerts);
  if (rows.length === 0) {
    return null;
  }
  return (
    <SiteAlertsBanner
      alertsFingerprint={buildSiteAlertsFingerprint(rows)}
      rows={rows}
    />
  );
}
