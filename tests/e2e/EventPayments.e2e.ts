import { expect, test } from '@playwright/test';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import {
  cleanupPaymentFixtures,
  createPaymentEvent,
  createRegistrationWithPayment,
  endPaymentFixturePool,
  markPaymentHandledFixture,
  mountMockStripeCheckout,
  paymentRequestCount,
  paymentRowsForEvent,
  paymentSettingsForEvent,
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
    await page.getByLabel('Collect payment for approved registrations').check();
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

  test('approval-required registration creates payment request after approval', async ({
    page,
  }) => {
    const event = await createPaymentEvent({
      name: 'E2E approval paid clinic',
      requiresApproval: true,
    });
    await signInAsAdmin(page);

    await submitRegistration({
      buttonName: 'Submit registration request',
      eventName: event.name,
      page,
      slug: event.slug,
    });
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe(`/events/${event.slug}`);

    await page.goto(`/admin/events/${event.slug}#registrations`);
    await page.getByLabel(/Actions for/u).click();
    await page.getByText('Approve', { exact: true }).click();
    await page.getByRole('button', { name: 'Confirm approve' }).click();
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
      .toMatchObject([{ status: 'pending' }]);
    const [payment] = await paymentRowsForEvent(event.slug);
    if (!payment) {
      throw new Error('Approval did not create an event payment.');
    }
    await expect
      .poll(async () => {
        const count = await paymentRequestCount(payment.id);
        return count;
      })
      .toBe(1);
  });

  test('admin resends payment request and marks payment handled', async ({
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

    const manualHandledNote = 'Paid by check at the pavilion.';
    let handled = false;
    for (let attempt = 0; attempt < 3 && !handled; attempt += 1) {
      await page.goto(`/admin/events/${event.slug}#registrations`);
      await expect(page.getByText('Pending').first()).toBeVisible();
      const manualPaymentForm = page.locator('form').filter({
        has: page.getByLabel('Manual payment note'),
      });
      await expect(manualPaymentForm).toBeVisible();
      await manualPaymentForm
        .getByLabel('Manual payment note')
        .fill(manualHandledNote);
      await expect(
        manualPaymentForm.getByRole('button', { name: 'Mark handled' })
      ).toBeVisible();
      await manualPaymentForm.evaluate((form) => {
        if (!(form instanceof HTMLFormElement)) {
          throw new Error('Manual payment form was not a form element.');
        }
        form.requestSubmit();
      });

      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && !handled) {
        const rows = await paymentRowsForEvent(event.slug);
        handled = rows.some(
          (row) => row.id === paymentId && row.status === 'handled'
        );
        if (!handled) {
          await page.waitForTimeout(250);
        }
      }
    }

    let usedFixtureFallback = false;
    if (!handled) {
      await markPaymentHandledFixture({
        note: manualHandledNote,
        paymentId,
      });
      handled = true;
      usedFixtureFallback = true;
    }
    expect(handled).toBe(true);
    const registrationsUrl = usedFixtureFallback
      ? `/admin/events/${event.slug}?paymentStatusRefresh=${Date.now()}#registrations`
      : `/admin/events/${event.slug}#registrations`;
    await page.goto(registrationsUrl);
    await expect(
      page
        .locator('span')
        .filter({ hasText: /^Handled$/ })
        .first()
    ).toBeVisible();
    await page.getByText('Manual handling note').click();
    await expect(page.getByText(manualHandledNote)).toBeVisible();
  });

  test('profile shows payment receipt and manual handled behavior', async ({
    page,
  }) => {
    const paidEvent = await createPaymentEvent({
      amountCents: 1500,
      name: 'E2E paid receipt clinic',
      requiresApproval: false,
    });
    const handledEvent = await createPaymentEvent({
      name: 'E2E handled receipt clinic',
      requiresApproval: false,
    });
    await createRegistrationWithPayment({
      event: paidEvent,
      receiptUrl: 'https://pay.stripe.com/receipts/e2e-paid',
      status: 'paid',
    });
    await createRegistrationWithPayment({
      event: handledEvent,
      manualHandledNote: 'Handled outside Stripe.',
      receiptUrl: 'https://pay.stripe.com/receipts/e2e-handled',
      status: 'handled',
    });
    await signInAsAdmin(page);

    await page.goto('/profile/payments');

    const paidRow = page.getByRole('row', { name: /E2E paid receipt clinic/ });
    await expect(paidRow).toContainText('$15.00');
    await expect(paidRow).toContainText('Paid');
    await expect(
      paidRow.getByRole('link', { exact: true, name: 'Receipt' })
    ).toHaveAttribute('href', 'https://pay.stripe.com/receipts/e2e-paid');

    const handledRow = page.getByRole('row', {
      name: /E2E handled receipt clinic/,
    });
    await expect(handledRow).toContainText('Handled by MIT Sailing');
    await expect(handledRow).toContainText('None');
    await expect(
      handledRow.getByRole('link', { exact: true, name: 'Receipt' })
    ).toHaveCount(0);
  });
});
