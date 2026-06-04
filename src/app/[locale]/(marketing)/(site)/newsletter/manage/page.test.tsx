import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  getPublicNewsletterLists: vi.fn(),
  getSubscriberPreferenceStateByToken: vi.fn(),
  getTranslations: vi.fn(),
  loggerWarn: vi.fn(),
  newsletterPreferenceRows: vi.fn(),
  preferenceFormProps: null as null | {
    action: (formData: FormData) => Promise<unknown>;
  },
  resubscribeTokenNewsletterListAction: vi.fn(),
  setRequestLocale: vi.fn(),
  unsubscribeTokenNewsletterListAction: vi.fn(),
  updateTokenNewsletterPreferencesAction: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('next/server', () => ({
  connection: mocks.connection,
}));

vi.mock('@/components/mit-sailing/newsletter/NewsletterPreferenceForm', () => ({
  NewsletterPreferenceForm: (props: {
    action: (formData: FormData) => Promise<unknown>;
  }): React.ReactNode => {
    mocks.preferenceFormProps = props;
    return null;
  },
}));

vi.mock('@/components/mit-sailing/SiteSectionMain', () => ({
  SiteSectionMain: (props: { children: React.ReactNode }): React.ReactNode =>
    props.children,
}));

vi.mock('@/components/mit-sailing/SiteSectionShell', () => ({
  SiteSectionShell: (props: { children: React.ReactNode }): React.ReactNode =>
    props.children,
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    warn: mocks.loggerWarn,
  },
}));

vi.mock('@/libs/newsletter/newsletterActions', () => ({
  resubscribeTokenNewsletterListAction:
    mocks.resubscribeTokenNewsletterListAction,
  unsubscribeTokenNewsletterListAction:
    mocks.unsubscribeTokenNewsletterListAction,
  updateTokenNewsletterPreferencesAction:
    mocks.updateTokenNewsletterPreferencesAction,
}));

vi.mock('@/libs/newsletter/newsletterPreferenceRows', () => ({
  newsletterPreferenceRows: mocks.newsletterPreferenceRows,
}));

vi.mock('@/libs/newsletter/newsletterSubscriptions', () => ({
  getPublicNewsletterLists: mocks.getPublicNewsletterLists,
  getSubscriberPreferenceStateByToken:
    mocks.getSubscriberPreferenceStateByToken,
}));

function pageProps(token?: string | string[]) {
  return {
    params: Promise.resolve({ locale: 'en' }),
    searchParams: Promise.resolve({ token }),
  };
}

function pagePropsWithSearchParams(searchParams: {
  action?: string | string[];
  list?: string | string[];
  resubscribed?: string | string[];
  token?: string | string[];
  unsubscribed?: string | string[];
}) {
  return {
    params: Promise.resolve({ locale: 'en' }),
    searchParams: Promise.resolve(searchParams),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublicNewsletterLists.mockResolvedValue([]);
  mocks.getSubscriberPreferenceStateByToken.mockResolvedValue(null);
  mocks.getTranslations.mockResolvedValue((key: string) => key);
  mocks.newsletterPreferenceRows.mockReturnValue([]);
  mocks.preferenceFormProps = null;
  mocks.resubscribeTokenNewsletterListAction.mockImplementation(async () => {
    await Promise.resolve();
  });
  mocks.unsubscribeTokenNewsletterListAction.mockImplementation(async () => {
    await Promise.resolve();
  });
  mocks.updateTokenNewsletterPreferencesAction.mockResolvedValue({ ok: true });
});

describe('NewsletterManagePage', () => {
  it('binds the single token to preference updates', async () => {
    const pageModule = await import('./page');
    mocks.getSubscriberPreferenceStateByToken.mockResolvedValue({
      email: 'sailor@example.com',
      id: 'subscriber_123',
    });

    renderToStaticMarkup(await pageModule.default(pageProps('token_123')));
    const formData = new FormData();
    await mocks.preferenceFormProps?.action(formData);

    expect(mocks.getSubscriberPreferenceStateByToken).toHaveBeenCalledWith(
      'token_123'
    );
    expect(mocks.updateTokenNewsletterPreferencesAction).toHaveBeenCalledWith(
      'token_123',
      'en',
      formData
    );
  });

  it('rejects repeated token params before token lookup', async () => {
    const pageModule = await import('./page');

    renderToStaticMarkup(
      await pageModule.default(pageProps(['token_123', 'token_456']))
    );

    expect(mocks.getSubscriberPreferenceStateByToken).not.toHaveBeenCalled();
    expect(mocks.getPublicNewsletterLists).not.toHaveBeenCalled();
    expect(mocks.updateTokenNewsletterPreferencesAction).not.toHaveBeenCalled();
    expect(mocks.preferenceFormProps).toBeNull();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Rejected newsletter manage request with repeated token params',
      { tokenCount: 2 }
    );
  });

  it('trims token params before token lookup', async () => {
    const pageModule = await import('./page');
    mocks.getSubscriberPreferenceStateByToken.mockResolvedValue({
      email: 'sailor@example.com',
      id: 'subscriber_123',
    });

    renderToStaticMarkup(await pageModule.default(pageProps(' token_123 ')));

    expect(mocks.getSubscriberPreferenceStateByToken).toHaveBeenCalledWith(
      'token_123'
    );
  });

  it('renders a safe unsubscribe confirmation for email footer links', async () => {
    const pageModule = await import('./page');
    mocks.getPublicNewsletterLists.mockResolvedValue([
      { id: 'list_123', name: 'General' },
    ]);
    mocks.getSubscriberPreferenceStateByToken.mockResolvedValue({
      email: 'sailor@example.com',
      id: 'subscriber_123',
    });

    const html = renderToStaticMarkup(
      await pageModule.default(
        pagePropsWithSearchParams({
          action: 'unsubscribe',
          list: 'list_123',
          token: 'token_123',
        })
      )
    );

    expect(html).toContain('manage_unsubscribe_heading');
    expect(html).toContain('manage_unsubscribe_submit');
    expect(html).not.toContain('preferences_submit');
  });

  it('renders a one-button resubscribe option after unsubscribe', async () => {
    const pageModule = await import('./page');
    mocks.getPublicNewsletterLists.mockResolvedValue([
      { id: 'list_123', name: 'General' },
    ]);
    mocks.getSubscriberPreferenceStateByToken.mockResolvedValue({
      email: 'sailor@example.com',
      id: 'subscriber_123',
    });

    const html = renderToStaticMarkup(
      await pageModule.default(
        pagePropsWithSearchParams({
          list: 'list_123',
          token: 'token_123',
          unsubscribed: '1',
        })
      )
    );

    expect(html).toContain('manage_unsubscribed_heading');
    expect(html).toContain('manage_resubscribe_submit');
    expect(html).not.toContain('preferences_submit');
  });

  it('skips public list lookup without token', async () => {
    const pageModule = await import('./page');

    renderToStaticMarkup(await pageModule.default(pageProps()));

    expect(mocks.getSubscriberPreferenceStateByToken).not.toHaveBeenCalled();
    expect(mocks.getPublicNewsletterLists).not.toHaveBeenCalled();
    expect(mocks.preferenceFormProps).toBeNull();
  });

  it('skips public list lookup when token has no subscriber', async () => {
    const pageModule = await import('./page');

    renderToStaticMarkup(await pageModule.default(pageProps('token_123')));

    expect(mocks.getSubscriberPreferenceStateByToken).toHaveBeenCalledWith(
      'token_123'
    );
    expect(mocks.getPublicNewsletterLists).not.toHaveBeenCalled();
    expect(mocks.preferenceFormProps).toBeNull();
  });
});
