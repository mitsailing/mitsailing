import * as Sentry from '@sentry/nextjs';
import { getTranslations } from 'next-intl/server';
import { generateSailingCardPdf } from '@/libs/admin/cards/sailingCardPdf';
import type { SailingCardPdfLabels } from '@/libs/admin/cards/sailingCardPdf';
import {
  getSailingCardPdfData,
  loadSailingCardPdfAssets,
} from '@/libs/admin/cards/sailingCardPdfData';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { logger } from '@/libs/Logger';
import { AppConfig } from '@/utils/AppConfig';

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

async function getSailingCardPdfLabels(cardNumber: number) {
  const t = await getTranslations({
    locale: AppConfig.i18n.defaultLocale,
    namespace: 'AdminUsers',
  });

  return {
    affiliation: t('sailing_card_pdf_affiliation'),
    cardNumber: t('sailing_card_pdf_card_number', { cardNumber }),
    class: t('sailing_card_pdf_class'),
    date: t('sailing_card_pdf_date'),
    email: t('sailing_card_pdf_email'),
    expires: t('sailing_card_pdf_expires'),
    membership: t('sailing_card_pdf_membership'),
    notTransferable: t('sailing_card_pdf_not_transferable'),
    pavilionName: t('sailing_card_pdf_pavilion_name'),
    phone: t('sailing_card_pdf_phone'),
    signature: t('sailing_card_pdf_signature'),
  } satisfies SailingCardPdfLabels;
}

function reportSailingCardPdfError(props: {
  readonly adminUserId: string;
  readonly cardNumber: number | null;
  readonly cardYear: number | null;
  readonly error: unknown;
  readonly targetUserId: string;
}) {
  logger.error('Failed to generate sailing-card PDF: {error}', {
    adminUserId: props.adminUserId,
    cardNumber: props.cardNumber,
    cardYear: props.cardYear,
    error: props.error,
    targetUserId: props.targetUserId,
  });
  Sentry.captureException(props.error, {
    contexts: {
      sailingCardPdf: {
        adminUserId: props.adminUserId,
        cardNumber: props.cardNumber,
        cardYear: props.cardYear,
        targetUserId: props.targetUserId,
      },
    },
    tags: {
      action: 'generate',
      feature: 'sailing-card-pdf',
    },
  });
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
    const [assets, labels] = await Promise.all([
      loadSailingCardPdfAssets(),
      getSailingCardPdfLabels(data.cardNumber),
    ]);
    const pdfBytes = await generateSailingCardPdf({ assets, data, labels });

    return new Response(arrayBufferFromBytes(pdfBytes), {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'content-disposition': `inline; filename="sailing-card-${data.cardYear}-${data.cardNumber}.pdf"`,
        'content-type': 'application/pdf',
      },
    });
  } catch (error) {
    reportSailingCardPdfError({
      adminUserId: session.user.id,
      cardNumber,
      cardYear,
      error,
      targetUserId: id,
    });

    return jsonResponse({ error: 'pdf_generation_failed' }, 500);
  }
}
