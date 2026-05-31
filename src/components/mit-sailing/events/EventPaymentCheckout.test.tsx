import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventPaymentCheckout } from '@/components/mit-sailing/events/EventPaymentCheckout';
import type {
  EventPaymentCheckoutActionResult,
  EventPaymentCheckoutPayment,
} from '@/components/mit-sailing/events/EventPaymentCheckout';

const stripeMocks = vi.hoisted(() => ({
  createEmbeddedCheckoutPage: vi.fn(),
  loadStripe: vi.fn(),
  mount: vi.fn(),
  unmount: vi.fn(),
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: stripeMocks.loadStripe,
}));

const labels = {
  amountLabel: 'Amount',
  alreadyHandledBody: 'This payment has already been handled.',
  alreadyHandledTitle: 'Payment handled',
  checkoutLoadError: 'Checkout could not load.',
  checkoutLoading: 'Loading secure checkout',
  checkoutRegionLabel: 'Secure Stripe checkout',
  checkoutUnavailable: 'Checkout is not configured for this event payment.',
  noPaymentBody: 'There is no payable registration for this event.',
  noPaymentTitle: 'No payment due',
  paidReceipt: 'View receipt',
  reviewBody:
    'MIT Sailing is reviewing an existing payment record for this registration.',
  reviewTitle: 'Payment needs review',
  statusLabel: 'Status',
} as const;

async function defaultClientSecretAction(): Promise<EventPaymentCheckoutActionResult> {
  const result: EventPaymentCheckoutActionResult = {
    clientSecret: 'cs_test_secret',
    status: 'ok',
  };
  await Promise.resolve();
  return result;
}

function renderCheckout(props: {
  clientSecretAction?: () => Promise<
    | { clientSecret: string; status: 'ok' }
    | { message: string; status: 'unavailable' }
  >;
  payment:
    | {
        amount: string;
        receiptUrl: string | null;
        status: 'pending' | 'checkout_created' | 'past_due';
        statusLabel: string;
      }
    | {
        amount: string;
        receiptUrl: string | null;
        status: 'cancelled' | 'disputed' | 'handled' | 'paid' | 'refunded';
        statusLabel: string;
      }
    | null;
}) {
  return render(
    <EventPaymentCheckout
      clientSecretAction={
        props.clientSecretAction ?? vi.fn(defaultClientSecretAction)
      }
      labels={labels}
      payment={props.payment}
      publishableKey="pk_test_checkout"
      title="Pay for Intro Sail"
    />
  );
}

describe('EventPaymentCheckout', () => {
  beforeEach(() => {
    stripeMocks.createEmbeddedCheckoutPage.mockReset();
    stripeMocks.loadStripe.mockReset();
    stripeMocks.mount.mockReset();
    stripeMocks.unmount.mockReset();
    stripeMocks.createEmbeddedCheckoutPage.mockResolvedValue({
      mount: stripeMocks.mount,
      unmount: stripeMocks.unmount,
    });
    stripeMocks.loadStripe.mockResolvedValue({
      createEmbeddedCheckoutPage: stripeMocks.createEmbeddedCheckoutPage,
    });
  });

  it('shows loading state while checkout mounts', async () => {
    renderCheckout({
      payment: {
        amount: '$25.00',
        receiptUrl: null,
        status: 'pending',
        statusLabel: 'Pending',
      },
    });

    expect(
      screen.getByRole('heading', { name: 'Pay for Intro Sail' })
    ).toBeVisible();
    expect(screen.getByText('Loading secure checkout')).toBeVisible();
    await waitFor(() => {
      expect(stripeMocks.mount).toHaveBeenCalledTimes(1);
    });
  });

  it('shows unavailable state when checkout is missing a publishable key', () => {
    render(
      <EventPaymentCheckout
        clientSecretAction={vi.fn(defaultClientSecretAction)}
        labels={labels}
        payment={{
          amount: '$25.00',
          receiptUrl: null,
          status: 'pending',
          statusLabel: 'Pending',
        }}
        publishableKey={undefined}
        title="Pay for Intro Sail"
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Pay for Intro Sail' })
    ).toBeVisible();
    expect(
      screen.getByText('Checkout is not configured for this event payment.')
    ).toBeVisible();
    expect(stripeMocks.loadStripe).not.toHaveBeenCalled();
  });

  it('shows no-payment state when nothing is payable', () => {
    renderCheckout({ payment: null });

    expect(
      screen.getByRole('heading', { name: 'No payment due' })
    ).toBeVisible();
    expect(stripeMocks.loadStripe).not.toHaveBeenCalled();
  });

  it('shows handled state with receipt link after payment is terminal', () => {
    renderCheckout({
      payment: {
        amount: '$25.00',
        receiptUrl: 'https://stripe.test/receipt',
        status: 'paid',
        statusLabel: 'Paid',
      },
    });

    expect(
      screen.getByRole('heading', { name: 'Payment handled' })
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'View receipt' })).toHaveAttribute(
      'href',
      'https://stripe.test/receipt'
    );
  });

  it('mounts embedded checkout for payable payments and unmounts on cleanup', async () => {
    const { unmount } = renderCheckout({
      payment: {
        amount: '$25.00',
        receiptUrl: null,
        status: 'past_due',
        statusLabel: 'Past due',
      },
    });

    await waitFor(() => {
      expect(stripeMocks.mount).toHaveBeenCalledTimes(1);
    });
    expect(stripeMocks.createEmbeddedCheckoutPage).toHaveBeenCalledWith({
      fetchClientSecret: expect.any(Function),
    });

    act(() => {
      unmount();
    });

    expect(stripeMocks.unmount).toHaveBeenCalledTimes(1);
  });

  it('shows load error when client secret is unavailable', async () => {
    stripeMocks.createEmbeddedCheckoutPage.mockImplementation(
      async (options: { fetchClientSecret: () => Promise<string> }) => {
        await options.fetchClientSecret();
        return {
          mount: stripeMocks.mount,
          unmount: stripeMocks.unmount,
        };
      }
    );
    const clientSecretAction = vi.fn().mockResolvedValue({
      message: 'Payment is no longer payable.',
      status: 'unavailable' as const,
    });

    renderCheckout({
      clientSecretAction,
      payment: {
        amount: '$25.00',
        receiptUrl: null,
        status: 'pending',
        statusLabel: 'Pending',
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Checkout could not load.'
    );
    expect(stripeMocks.mount).not.toHaveBeenCalled();
  });

  it('shows load error when Stripe fails to initialize', async () => {
    stripeMocks.loadStripe.mockResolvedValue(null);

    renderCheckout({
      payment: {
        amount: '$25.00',
        receiptUrl: null,
        status: 'pending',
        statusLabel: 'Pending',
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Checkout could not load.'
    );
    expect(stripeMocks.createEmbeddedCheckoutPage).not.toHaveBeenCalled();
    expect(stripeMocks.mount).not.toHaveBeenCalled();
  });

  it('clears checkout load error after successful retry', async () => {
    const retryPayment: EventPaymentCheckoutPayment = {
      amount: '$25.00',
      receiptUrl: null,
      status: 'past_due',
      statusLabel: 'Past due',
    };
    stripeMocks.loadStripe
      .mockResolvedValueOnce({
        createEmbeddedCheckoutPage: vi
          .fn()
          .mockRejectedValue(new Error('Stripe unavailable')),
      })
      .mockResolvedValue({
        createEmbeddedCheckoutPage: stripeMocks.createEmbeddedCheckoutPage,
      });
    const { rerender } = renderCheckout({
      payment: {
        amount: '$25.00',
        receiptUrl: null,
        status: 'pending',
        statusLabel: 'Pending',
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Checkout could not load.'
    );

    rerender(
      <EventPaymentCheckout
        clientSecretAction={vi.fn(defaultClientSecretAction)}
        labels={labels}
        payment={retryPayment}
        publishableKey="pk_test_checkout"
        title="Pay for Intro Sail"
      />
    );

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(stripeMocks.mount).toHaveBeenCalledTimes(1);
    });
  });

  it('shows review state without a Stripe checkout for needs_review payments', () => {
    render(
      <EventPaymentCheckout
        clientSecretAction={vi.fn(defaultClientSecretAction)}
        labels={labels}
        payment={{
          amount: '$120.00',
          receiptUrl: null,
          status: 'needs_review',
          statusLabel: 'Needs review',
        }}
        publishableKey="pk_test_checkout"
        title="Pay for Intro Sail"
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Payment needs review' })
    ).toBeVisible();
    expect(
      screen.getByText(
        'MIT Sailing is reviewing an existing payment record for this registration.'
      )
    ).toBeVisible();
    expect(stripeMocks.loadStripe).not.toHaveBeenCalled();
    expect(stripeMocks.createEmbeddedCheckoutPage).not.toHaveBeenCalled();
  });

  it('shows handled state without a receipt link when receipt is absent for terminal payments', () => {
    render(
      <EventPaymentCheckout
        clientSecretAction={vi.fn(defaultClientSecretAction)}
        labels={labels}
        payment={{
          amount: '$25.00',
          receiptUrl: null,
          status: 'refunded',
          statusLabel: 'Refunded',
        }}
        publishableKey="pk_test_checkout"
        title="Pay for Intro Sail"
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Payment handled' })
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'View receipt' })
    ).not.toBeInTheDocument();
    expect(stripeMocks.loadStripe).not.toHaveBeenCalled();
  });

  it('keeps checkout mounted across parent rerenders', async () => {
    const clientSecretAction = vi.fn(defaultClientSecretAction);
    const payment: EventPaymentCheckoutPayment = {
      amount: '$25.00',
      receiptUrl: null,
      status: 'pending',
      statusLabel: 'Pending',
    };
    const { rerender } = render(
      <EventPaymentCheckout
        clientSecretAction={clientSecretAction}
        labels={labels}
        payment={payment}
        publishableKey="pk_test_checkout"
        title="Pay for Intro Sail"
      />
    );

    await waitFor(() => {
      expect(stripeMocks.createEmbeddedCheckoutPage).toHaveBeenCalledTimes(1);
    });
    rerender(
      <EventPaymentCheckout
        clientSecretAction={clientSecretAction}
        labels={labels}
        payment={payment}
        publishableKey="pk_test_checkout"
        title="Pay for Intro Sail"
      />
    );

    await Promise.resolve();
    expect(stripeMocks.createEmbeddedCheckoutPage).toHaveBeenCalledTimes(1);
  });
});
