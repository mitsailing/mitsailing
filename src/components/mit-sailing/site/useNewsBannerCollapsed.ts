'use client';

import { useSyncExternalStore } from 'react';
import type { NewsBannerCollapseAlert } from '@/libs/mit-sailing/newsBannerCollapse';
import {
  NEWS_BANNER_COLLAPSE_STORAGE_KEY,
  newsBannerStartsCollapsed,
  parseStoredNewsBannerCollapse,
  serializeNewsBannerCollapse,
} from '@/libs/mit-sailing/newsBannerCollapse';

const CHANGED_EVENT = 'mitsailing:news-banner-collapse-changed';
let storageFault: boolean | null = null;

function collapsedSnapshot(alerts: readonly NewsBannerCollapseAlert[]) {
  if (storageFault !== null) {
    return storageFault;
  }
  try {
    return newsBannerStartsCollapsed({
      currentAlerts: alerts,
      stored: parseStoredNewsBannerCollapse(
        window.localStorage.getItem(NEWS_BANNER_COLLAPSE_STORAGE_KEY)
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
      event.key !== NEWS_BANNER_COLLAPSE_STORAGE_KEY
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
 * Reads and toggles persisted news banner collapse state.
 *
 * @param alerts - Current banner items used for storage fingerprinting
 * @returns Collapsed flag and toggle handler
 */
export function useNewsBannerCollapsed(
  alerts: readonly NewsBannerCollapseAlert[]
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
      window.localStorage.setItem(
        NEWS_BANNER_COLLAPSE_STORAGE_KEY,
        serializeNewsBannerCollapse([...alerts], next)
      );
    } catch {
      storageFault = next;
    }
    window.dispatchEvent(new Event(CHANGED_EVENT));
  }

  return { collapsed, toggleCollapsed };
}

/** Resets in-memory collapse override (tests only). */
export function resetNewsBannerCollapseStateForTests() {
  storageFault = null;
}
