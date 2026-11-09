'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { enableCmsDraftPreview } from '@/libs/payload/enableCmsDraftPreview';

function messageType(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('type' in data)) {
    return null;
  }
  return typeof data.type === 'string' ? data.type : null;
}

/**
 * Refreshes the public page when Payload live preview saves, and turns on
 * draft mode for a CMS session the first time the admin iframe connects.
 *
 * @param props - Whether draft mode is already on, and the site origin
 * @returns Nothing visible
 */
export function RefreshPayloadPreview(props: {
  draft: boolean;
  serverURL: string;
}) {
  const router = useRouter();
  const draftRef = useRef(props.draft);
  const enablingRef = useRef(false);
  draftRef.current = props.draft;

  useEffect(() => {
    if (window.parent === window) {
      return;
    }
    window.parent.postMessage(
      { ready: true, type: 'payload-live-preview' },
      props.serverURL
    );

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== props.serverURL) {
        return;
      }
      const type = messageType(event.data);
      if (
        type !== 'payload-live-preview' &&
        type !== 'payload-document-event'
      ) {
        return;
      }
      if (!draftRef.current) {
        if (enablingRef.current) {
          return;
        }
        enablingRef.current = true;
        const enableDraftFromPreview = async () => {
          try {
            const enabled = await enableCmsDraftPreview();
            if (!enabled) {
              return;
            }
            draftRef.current = true;
            router.refresh();
          } finally {
            enablingRef.current = false;
          }
        };
        // eslint-disable-next-line no-void -- the preview message listener cannot be async
        void enableDraftFromPreview();
        return;
      }
      if (type === 'payload-document-event') {
        router.refresh();
      }
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [props.serverURL, router]);

  return null;
}
