'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect, useRef, useState } from 'react';

export type SailingCardPrintMode = 'print' | 'quick';

type PrintSailingCardFrameProps = {
  readonly frame: HTMLIFrameElement;
  readonly mode: SailingCardPrintMode;
  readonly targetUserId: string;
};

type PrintSailingCardFrameResult =
  | { readonly ok: true }
  | { readonly error: unknown; readonly ok: false };

type SailingCardPdfLoadResult =
  | { readonly ok: true; readonly url: string }
  | { readonly error: unknown; readonly ok: false };

function sentryActionForPrintMode(mode: SailingCardPrintMode) {
  return mode === 'quick' ? 'quick-print' : 'print-dialog';
}

function reportSailingCardPrintFailure(props: {
  readonly error: unknown;
  readonly mode: SailingCardPrintMode;
  readonly responseStatus?: number;
  readonly targetUserId: string;
}) {
  Sentry.captureException(props.error, {
    contexts: {
      sailingCardPrint: {
        mode: props.mode,
        responseStatus: props.responseStatus,
        targetUserId: props.targetUserId,
      },
    },
    tags: {
      action: sentryActionForPrintMode(props.mode),
      feature: 'sailing-card-pdf',
    },
  });
}

function pdfResponseError(props: {
  readonly contentType: string | null;
  readonly preview: string;
  readonly status: number;
}) {
  const error = new Error('Sailing card PDF request did not return a PDF.');
  error.name = 'SailingCardPdfLoadError';

  return Object.assign(error, {
    contentType: props.contentType,
    preview: props.preview,
    status: props.status,
  });
}

export async function loadSailingCardPdfFrameSource(props: {
  readonly mode: SailingCardPrintMode;
  readonly pdfHref: string;
  readonly targetUserId: string;
}): Promise<SailingCardPdfLoadResult> {
  try {
    const response = await fetch(props.pdfHref, {
      credentials: 'same-origin',
    });
    const contentType = response.headers.get('content-type');

    if (!response.ok || !contentType?.includes('application/pdf')) {
      const responseText = await response.text();
      const preview = responseText.slice(0, 500);
      const error = pdfResponseError({
        contentType,
        preview,
        status: response.status,
      });
      reportSailingCardPrintFailure({
        error,
        mode: props.mode,
        responseStatus: response.status,
        targetUserId: props.targetUserId,
      });

      return { ok: false, error };
    }

    return { ok: true, url: URL.createObjectURL(await response.blob()) };
  } catch (error) {
    reportSailingCardPrintFailure({
      error,
      mode: props.mode,
      targetUserId: props.targetUserId,
    });

    return { ok: false, error };
  }
}

function printLauncherStatusLabel(props: {
  readonly failureLabel: string;
  readonly loadingLabel: string;
  readonly readyLabel: string;
  readonly status: 'failed' | 'loading' | 'ready';
}) {
  if (props.status === 'failed') {
    return props.failureLabel;
  }
  if (props.status === 'ready') {
    return props.readyLabel;
  }

  return props.loadingLabel;
}

export function printSailingCardFrame(
  props: PrintSailingCardFrameProps
): PrintSailingCardFrameResult {
  try {
    if (props.frame.contentWindow === null) {
      throw new Error('Sailing card PDF frame is unavailable.');
    }

    props.frame.contentWindow.focus();
    props.frame.contentWindow.print();

    return { ok: true };
  } catch (error) {
    reportSailingCardPrintFailure({
      error,
      mode: props.mode,
      targetUserId: props.targetUserId,
    });

    return { ok: false, error };
  }
}

export function AdminSailingCardPrintLauncher(props: {
  readonly failureLabel: string;
  readonly frameTitle: string;
  readonly loadingLabel: string;
  readonly mode: SailingCardPrintMode;
  readonly pdfHref: string;
  readonly readyLabel: string;
  readonly targetUserId: string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const statusRef = useRef<'failed' | 'loading' | 'ready'>('loading');
  const [frameSource, setFrameSource] = useState<string | null>(null);
  const [status, setStatus] = useState<'failed' | 'loading' | 'ready'>(
    'loading'
  );

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    setFrameSource(null);
    setStatus('loading');
    let active = true;
    let loadedFrameSource: string | null = null;
    const timeoutId = window.setTimeout(() => {
      if (statusRef.current !== 'loading') {
        return;
      }

      const error = new Error('Sailing card PDF did not load before printing.');
      reportSailingCardPrintFailure({
        error,
        mode: props.mode,
        targetUserId: props.targetUserId,
      });
      setStatus('failed');
    }, 15_000);

    async function loadFrameSource() {
      const result = await loadSailingCardPdfFrameSource({
        mode: props.mode,
        pdfHref: props.pdfHref,
        targetUserId: props.targetUserId,
      });

      if (!active) {
        if (result.ok) {
          URL.revokeObjectURL(result.url);
        }
        return;
      }

      if (!result.ok) {
        setStatus('failed');
        return;
      }

      loadedFrameSource = result.url;
      setFrameSource(result.url);
    }

    // eslint-disable-next-line no-void -- React effects cannot be async; the loader reports PDF load failures.
    void loadFrameSource();

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      if (loadedFrameSource !== null) {
        URL.revokeObjectURL(loadedFrameSource);
      }
    };
  }, [props.mode, props.pdfHref, props.targetUserId]);
  const statusLabel = printLauncherStatusLabel({
    failureLabel: props.failureLabel,
    loadingLabel: props.loadingLabel,
    readyLabel: props.readyLabel,
    status,
  });

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <div className="border-b border-border p-4">
        <p className="m-0 text-sm text-muted-foreground">{statusLabel}</p>
      </div>
      {frameSource === null ? null : (
        <iframe
          className="min-h-0 flex-1 border-0"
          onLoad={() => {
            const frame = frameRef.current;
            if (frame === null) {
              return;
            }

            const result = printSailingCardFrame({
              frame,
              mode: props.mode,
              targetUserId: props.targetUserId,
            });
            setStatus(result.ok ? 'ready' : 'failed');
          }}
          ref={frameRef}
          sandbox="allow-modals allow-same-origin"
          src={frameSource}
          title={props.frameTitle}
        />
      )}
    </div>
  );
}
