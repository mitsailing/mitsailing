'use client';

import '../src/styles/storybook-tailwind-anchor';
import type { AbstractIntlMessages } from 'next-intl';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import messages from '../src/locales/en.json';

const storybookMessages = messages as AbstractIntlMessages;

type StorybookIntlRootProps = {
  children: ReactNode;
};

/**
 * Mirrors app `[locale]` intl wiring so Storybook stories can use `useTranslations`.
 *
 * @param props - Root props
 * @param props.children - Story tree
 * @returns Provider-wrapped subtree
 */
export function StorybookIntlRoot(props: StorybookIntlRootProps) {
  return (
    <NextIntlClientProvider locale="en" messages={storybookMessages}>
      {props.children}
    </NextIntlClientProvider>
  );
}
