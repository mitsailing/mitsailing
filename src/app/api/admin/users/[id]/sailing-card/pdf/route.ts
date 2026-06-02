import * as Sentry from '@sentry/nextjs';
import { generateSailingCardPdf } from '@/libs/admin/cards/sailingCardPdf';
import {
  getSailingCardPdfData,
  loadSailingCardPdfAssets,
} from '@/libs/admin/cards/sailingCardPdfData';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { logger } from '@/libs/Logger';

type SailingCardPdfRouteProps = {
  readonly params: Promise<{ id: string }>;
};

function jsonResponse(body: { readonly error: string }, status: number) {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}

function arrayBufferFromBytes(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function GET(_request: Request, props: SailingCardPdfRouteProps) {
  const session = await requirePermission(Permission.CARDS_PRINT);
  const { id } = await props.params;
  let cardNumber: number | null = null;
  let cardYear: number | null = null;

  try {
    const data = await getSailingCardPdfData(id);
    if (data === null) {
      return jsonResponse({ error: 'sailing_card_not_found' }, 404);
    }

    const { cardNumber: generatedCardNumber, cardYear: generatedCardYear } =
      data;
    cardNumber = generatedCardNumber;
    cardYear = generatedCardYear;
    const assets = await loadSailingCardPdfAssets();
    const pdfBytes = await generateSailingCardPdf({ assets, data });

    return new Response(arrayBufferFromBytes(pdfBytes), {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'content-disposition': `inline; filename="sailing-card-${data.cardYear}-${data.cardNumber}.pdf"`,
        'content-type': 'application/pdf',
      },
    });
  } catch (error) {
    logger.error('Failed to generate sailing-card PDF: {error}', {
      adminUserId: session.user.id,
      cardNumber,
      cardYear,
      error,
      targetUserId: id,
    });
    Sentry.captureException(error, {
      contexts: {
        sailingCardPdf: {
          adminUserId: session.user.id,
          cardNumber,
          cardYear,
          targetUserId: id,
        },
      },
      tags: {
        action: 'generate',
        feature: 'sailing-card-pdf',
      },
    });

    return jsonResponse({ error: 'pdf_generation_failed' }, 500);
  }
}
