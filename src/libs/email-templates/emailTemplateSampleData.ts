import type { EditableEmailTemplateKey } from '@/libs/email-templates/emailTemplateKeys';
import type { EmailTemplateRenderContext } from '@/libs/email-templates/emailTemplateRendering';

export function sampleEmailTemplateValues(key: EditableEmailTemplateKey) {
  switch (key) {
    case 'event_payment_admin_digest': {
      return {
        deadline: 'June 15, 2026, 7:00 PM ET',
        eventName: 'Moonlight sail',
      };
    }
    case 'event_payment_receipt': {
      return {
        amount: '$45.00',
        checkoutUrl: 'https://mitsailing.com/events/moonlight-sail/pay',
        deadline: 'June 15, 2026, 7:00 PM ET',
        eventAddress: '134 Memorial Drive, Cambridge, MA',
        eventAddressUrl:
          'https://www.google.com/maps/search/?api=1&query=MIT%20Sailing%20Pavilion',
        eventName: 'Moonlight sail',
        receiptUrl: 'https://pay.stripe.com/receipts/example',
        recipientName: 'Avery Sailor',
        selectedFeeDescription: 'Guest registration',
      };
    }
    case 'event_payment_reminder':
    case 'event_payment_request': {
      return {
        amount: '$45.00',
        checkoutUrl: 'https://mitsailing.com/events/moonlight-sail/pay',
        deadline: 'June 15, 2026, 7:00 PM ET',
        eventAddress: '134 Memorial Drive, Cambridge, MA',
        eventAddressUrl:
          'https://www.google.com/maps/search/?api=1&query=MIT%20Sailing%20Pavilion',
        eventName: 'Moonlight sail',
        receiptUrl: null,
        recipientName: 'Avery Sailor',
        selectedFeeDescription: 'Guest registration',
      };
    }
    case 'membership_payment_reminder': {
      return {
        amount: '$175.00',
        cardType: 'Pavilion racing',
        cardYear: '2026',
        onboardingUrl: 'https://mitsailing.com/onboarding',
      };
    }
    case 'newsletter_broadcast': {
      return {
        body: 'This week at MIT Sailing.',
        listName: 'General updates',
        manageUrl: 'https://mitsailing.com/newsletter',
        postalAddress: 'MIT Sailing Pavilion, 134 Memorial Drive, Cambridge MA',
        subject: 'Weekly sailing update',
        unsubscribeUrl: 'https://mitsailing.com/newsletter',
      };
    }
    case 'pavilion_reservation_status': {
      return {
        eventName: 'Frostbite banquet',
        referenceCode: 'PAV-2026-0042',
        status: 'Approved',
      };
    }
    case 'pavilion_reservation_submitted': {
      return {
        eventName: 'Frostbite banquet',
        referenceCode: 'PAV-2026-0042',
      };
    }
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

export function sampleEmailTemplateContext(
  key: EditableEmailTemplateKey
): EmailTemplateRenderContext | undefined {
  switch (key) {
    case 'event_payment_admin_digest': {
      return {
        eventPaymentAdminDigest: {
          overduePayments: [
            {
              amount: '$45.00',
              id: 'payment_sample',
              recipientEmail: 'sailor@example.com',
              recipientName: 'Avery Sailor',
              selectedFeeDescription: 'Guest registration',
            },
          ],
        },
      };
    }
    case 'pavilion_reservation_status':
    case 'pavilion_reservation_submitted': {
      return {
        pavilionReservation: {
          scheduleLines: ['June 15, 2026, 6:00 PM-9:00 PM'],
        },
      };
    }
    case 'event_payment_receipt':
    case 'event_payment_reminder':
    case 'event_payment_request':
    case 'membership_payment_reminder':
    case 'newsletter_broadcast': {
      return undefined;
    }
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}
