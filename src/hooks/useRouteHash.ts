'use client';

import { useSyncExternalStore } from 'react';

function getHashSnip(): string {
  if (globalThis.window === undefined) {
    return '';
  }
  return globalThis.window.location.hash.replace(/^#/, '');
}

function subscribeToHash(change: () => void): () => void {
  globalThis.window?.addEventListener('hashchange', change);
  return () => {
    globalThis.window?.removeEventListener('hashchange', change);
  };
}

/**
 * Current `location.hash` without the leading `#`, updated on `hashchange`.
 * Empty during SSR and when no hash is set.
 *
 * @returns Fragment without `#`, or empty string when absent.
 */
export function useRouteHash(): string {
  return useSyncExternalStore(subscribeToHash, getHashSnip, () => '');
}
