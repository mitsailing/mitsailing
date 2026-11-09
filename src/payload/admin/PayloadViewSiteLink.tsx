import messages from '@/locales/en.json';
import { getBaseUrl } from '@/utils/Helpers';

/**
 * Payload CMS nav link back to the public site.
 *
 * @returns Link shown above the Payload admin nav
 */
export function PayloadViewSiteLink() {
  return (
    <a className="nav__link" href={getBaseUrl()}>
      <span className="nav__link-label">{messages.PayloadCms.view_site}</span>
    </a>
  );
}
