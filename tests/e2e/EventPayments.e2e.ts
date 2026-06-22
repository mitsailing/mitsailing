import { expect, test } from '@playwright/test';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import {
  cleanupPaymentFixtures,
  createPaymentEvent,
  createRegistrationWithPayment,
  endPaymentFixturePool,
  mountMockStripeCheckout,
  paymentRequestCount,
  paymentRowsForEvent,
  paymentSettingsForEvent,
  registrationStatusesForEvent,
  submitRegistration,
} from '../helpers/e2e-event-payments-fixtures';

test.beforeEach(async () => {
  await cleanupPaymentFixtures();
});

test.afterEach(async () => {
  await cleanupPaymentFixtures();
});

test.afterAll(async () => {
  await endPaymentFixturePool();
});

test.describe('Event payments', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin enables payments with deadline and custom address', async ({
    page,
  }) => {
    const paymentDeadlineYear = new Date().getUTCFullYear() + 1;
    const event = await createPaymentEvent({
      name: 'E2E paid clinic settings',
      paymentDeadlineAt: null,
      paymentsEnabled: false,
      requiresApproval: false,
    });
    await signInAsAdmin(page);

    await page.goto(`/admin/events/${event.slug}/edit`);
    await page.getByLabel('Collect payment for registrations').check();
    await page
      .getByLabel('Payment deadline')
      .fill(`${paymentDeadlineYear}-01-15T12:00`);
    await page.getByRole('button', { name: 'Save payment settings' }).click();
    await expect
      .poll(async () => {
        const settings = await paymentSettingsForEvent(event.slug);
        return settings?.payment_deadline_at?.toISOString();
      })
      .toContain(`${paymentDeadlineYear}-01-15T17:00`);

    await page.goto(`/admin/events/${event.slug}/edit`);
    await page.getByLabel('Custom address').check();
    await page.getByLabel('Location name').fill('MIT Sailing Test Dock');
    await page.getByLabel('Address line 1').fill('77 Massachusetts Ave');
    await page.getByLabel('City').fill('Cambridge');
    await page.getByLabel('State').fill('MA');
    await page.getByLabel('Postal code').fill('02139');
    await page.getByRole('button', { name: 'Save location' }).click();

    await expect
      .poll(async () => {
        const settings = await paymentSettingsForEvent(event.slug);
        return settings;
      })
      .toMatchObject({
        address_city: 'Cambridge',
        address_line1: '77 Massachusetts Ave',
        address_name: 'MIT Sailing Test Dock',
        address_postal_code: '02139',
        address_preset: 'custom',
        address_state: 'MA',
        payments_enabled: true,
      });
  });

  test('auto-approved paid registration lands on embedded checkout page', async ({
    page,
  }) => {
    const event = await createPaymentEvent({
      name: 'E2E auto paid clinic',
      requiresApproval: false,
    });
    await mountMockStripeCheckout(page);
    await signInAsAdmin(page);

    await submitRegistration({
      buttonName: 'Confirm registration',
      eventName: event.name,
      page,
      slug: event.slug,
    });

    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe(`/events/${event.slug}/checkout`);
    await expect(
      page.getByRole('region', { name: 'Secure Stripe checkout' })
    ).toBeVisible();
    await expect(page.getByRole('status')).toHaveText(
      'Embedded checkout ready'
    );
    await expect(page.getByTestId('stripe-client-secret')).toContainText(
      'cs_test_e2e_secret_'
    );
    await expect
      .poll(async () => {
        const rows = await paymentRowsForEvent(event.slug);
        return rows;
      })
      .toMatchObject([{ status: 'checkout_created' }]);
  });

  test('approval-required paid registration lands on checkout and stays pending', async ({
    page,
  }) => {
    const event = await createPaymentEvent({
      name: 'E2E approval paid clinic',
      requiresApproval: true,
    });
    await mountMockStripeCheckout(page);
    await signInAsAdmin(page);

    await submitRegistration({
      buttonName: 'Request a spot',
      eventName: event.name,
      page,
      slug: event.slug,
    });
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe(`/events/${event.slug}/checkout`);
    await expect(
      page.getByRole('region', { name: 'Secure Stripe checkout' })
    ).toBeVisible();
    await expect(page.getByRole('status')).toHaveText(
      'Embedded checkout ready'
    );

    await page.goto(`/admin/events/${event.slug}#registrations`);
    await expect(
      page
        .locator('span')
        .filter({ hasText: /^Pending$/ })
        .first()
    ).toBeVisible();

    await expect
      .poll(async () => {
        const rows = await paymentRowsForEvent(event.slug);
        return rows;
      })
      .toMatchObject([{ status: 'checkout_created' }]);
    await expect
      .poll(async () => {
        const rows = await registrationStatusesForEvent(event.slug);
        return rows;
      })
      .toMatchObject([{ status: 'pending' }]);
  });

  test('admin resends unpaid request without local payment handling', async ({
    page,
  }) => {
    const event = await createPaymentEvent({
      name: 'E2E resend paid clinic',
      requiresApproval: false,
    });
    const paymentId = await createRegistrationWithPayment({
      event,
      status: 'pending',
    });
    await signInAsAdmin(page);

    await page.goto(`/admin/events/${event.slug}#registrations`);
    await expect(page.getByText('Pending').first()).toBeVisible();

    await page.getByRole('button', { name: 'Resend request' }).click();
    await expect
      .poll(async () => {
        const count = await paymentRequestCount(paymentId);
        return count;
      })
      .toBe(1);

    await expect(page.getByLabel('Manual payment note')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Mark handled' })
    ).toHaveCount(0);
  });

  test('profile shows paid Stripe receipt without local handled controls', async ({
    page,
  }) => {
    const paidEvent = await createPaymentEvent({
      amountCents: 1500,
      name: 'E2E paid receipt clinic',
      requiresApproval: false,
    });
    await createRegistrationWithPayment({
      event: paidEvent,
      receiptUrl: 'https://pay.stripe.com/receipts/e2e-paid',
      status: 'paid',
    });
    await signInAsAdmin(page);

    await page.goto('/profile/payments');

    const paidRow = page
      .getByRole('listitem')
      .filter({ hasText: 'E2E paid receipt clinic' });
    await expect(paidRow).toContainText('$15.00');
    await expect(paidRow).toContainText('Paid');
    await expect(
      paidRow.getByRole('link', { exact: true, name: 'Receipt' })
    ).toHaveAttribute('href', 'https://pay.stripe.com/receipts/e2e-paid');
  });
});
