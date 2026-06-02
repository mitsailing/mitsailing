import * as Sentry from '@sentry/nextjs';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AdminSailingCardPrintLauncher,
  loadSailingCardPdfFrameSource,
  printSailingCardFrame,
} from './AdminSailingCardPrintLauncher';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('AdminSailingCardPrintLauncher', () => {
  it('allows the PDF frame to run browser print scripts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        await Promise.resolve();
        return new Response(new Blob(['pdf'], { type: 'application/pdf' }), {
          headers: { 'content-type': 'application/pdf' },
        });
      })
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:card-pdf');

    render(
      <AdminSailingCardPrintLauncher
        failureLabel="Failed"
        frameTitle="Sailing card PDF"
        loadingLabel="Loading"
        mode="print"
        pdfHref="/api/admin/users/user-1/sailing-card/pdf"
        readyLabel="Ready"
        targetUserId="user-1"
      />
    );

    const frame = await screen.findByTitle('Sailing card PDF');

    expect(frame).toHaveAttribute(
      'sandbox',
      expect.stringContaining('allow-scripts')
    );
  });

  it('reports app-visible quick print launch failures to Sentry', () => {
    const error = new Error('print failed');
    const frame = document.createElement('iframe');
    Object.defineProperty(frame, 'contentWindow', {
      value: {
        focus: vi.fn(),
        print: vi.fn(() => {
          throw error;
        }),
      },
    });

    const result = printSailingCardFrame({
      frame,
      mode: 'quick',
      targetUserId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error });
    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        contexts: {
          sailingCardPrint: {
            mode: 'quick',
            targetUserId: 'user-1',
          },
        },
        tags: {
          action: 'quick-print',
          feature: 'sailing-card-pdf',
        },
      })
    );
  });

  it('reports returned non-PDF responses before printing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        await Promise.resolve();
        return Response.json({ error: 'not_found' }, { status: 404 });
      })
    );

    const result = await loadSailingCardPdfFrameSource({
      mode: 'quick',
      pdfHref: '/api/admin/users/user-1/sailing-card/pdf',
      targetUserId: 'user-1',
    });

    expect(result.ok).toBe(false);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'application/json',
        name: 'SailingCardPdfLoadError',
        status: 404,
      }),
      expect.objectContaining({
        contexts: {
          sailingCardPrint: {
            mode: 'quick',
            responseStatus: 404,
            targetUserId: 'user-1',
          },
        },
      })
    );
  });
});
