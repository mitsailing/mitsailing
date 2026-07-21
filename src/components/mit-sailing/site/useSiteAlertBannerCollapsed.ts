'use client';

import { useSyncExternalStore } from 'react';
import type { SiteAlertBannerCollapseAlert } from '@/libs/mit-sailing/siteAlertBannerCollapse';
import {
  parseStoredSiteAlertBannerCollapse,
  serializeSiteAlertBannerCollapse,
  SITE_ALERT_BANNER_COLLAPSE_STORAGE_KEY,
  siteAlertBannerStartsCollapsed,
} from '@/libs/mit-sailing/siteAlertBannerCollapse';

const CHANGED_EVENT = 'mitsailing:site-alert-banner-collapse-changed';
let storageFault: boolean | null = null;

function collapsedSnapshot(alerts: readonly SiteAlertBannerCollapseAlert[]) {
  if (storageFault !== null) {
    return storageFault;
  }
  try {
    return siteAlertBannerStartsCollapsed({
      currentAlerts: alerts,
      storedAlerts: parseStoredSiteAlertBannerCollapse(
        window.localStorage.getItem(SITE_ALERT_BANNER_COLLAPSE_STORAGE_KEY)
      ),
    });
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  const sync = (event: Event) => {
    if (
      event instanceof StorageEvent &&
      event.key !== null &&
      event.key !== SITE_ALERT_BANNER_COLLAPSE_STORAGE_KEY
    ) {
      return;
    }
    if (event instanceof StorageEvent) {
      storageFault = null;
    }
    onChange();
  };
  window.addEventListener('storage', sync);
  window.addEventListener(CHANGED_EVENT, sync);
  return () => {
    window.removeEventListener('storage', sync);
    window.removeEventListener(CHANGED_EVENT, sync);
  };
}

/**
 * Reads and toggles persisted site alert banner collapse state.
 *
 * @param alerts - Current banner alerts used for storage fingerprinting
 * @returns Collapsed flag and toggle handler
 */
export function useSiteAlertBannerCollapsed(
  alerts: readonly SiteAlertBannerCollapseAlert[]
) {
  const collapsed = useSyncExternalStore(
    subscribe,
    () => collapsedSnapshot(alerts),
    () => true
  );

  function toggleCollapsed() {
    const next = !collapsedSnapshot(alerts);
    storageFault = null;
    try {
      if (next) {
        window.localStorage.setItem(
          SITE_ALERT_BANNER_COLLAPSE_STORAGE_KEY,
          serializeSiteAlertBannerCollapse([...alerts])
        );
      } else {
        window.localStorage.removeItem(SITE_ALERT_BANNER_COLLAPSE_STORAGE_KEY);
      }
    } catch {
      storageFault = next;
    }
    window.dispatchEvent(new Event(CHANGED_EVENT));
  }

  return { collapsed, toggleCollapsed };
}

/** Resets in-memory collapse override (tests only). */
export function resetSiteAlertBannerCollapseStateForTests() {
  storageFault = null;
}
