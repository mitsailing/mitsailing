import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import React from 'react';
import { afterEach, vi } from 'vitest';
import enMessages from '@/locales/en.json';
import {
  componentTestPathname,
  componentTestRouter,
  resetComponentTestRouter,
} from '@/test/component';

type TranslationValue = React.ReactNode | RichValue;
type TranslationValues = Record<string, TranslationValue>;
type RichValue = (chunks: React.ReactNode) => React.ReactNode;

const messageCatalog: Record<
  string,
  Record<string, string>
> = Object.fromEntries(Object.entries(enMessages));

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
  })),
});

function messageFor(namespace: string, key: string): string {
  return messageCatalog[namespace]?.[key] ?? key;
}

function interpolate(message: string, values: TranslationValues = {}): string {
  return message.replaceAll(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : '';
  });
}

function renderRich(message: string, values: TranslationValues = {}) {
  const nodes: React.ReactNode[] = [];
  const tagPattern = /<(\w+)>(.*?)<\/\1>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = tagPattern.exec(message);

  while (match) {
    const [raw, tag, inner] = match;
    if (match.index > lastIndex) {
      nodes.push(interpolate(message.slice(lastIndex, match.index), values));
    }

    const renderedInner = interpolate(inner ?? '', values);
    const renderer = values[tag ?? ''];
    nodes.push(
      typeof renderer === 'function' ? renderer(renderedInner) : renderedInner
    );
    lastIndex = match.index + raw.length;
    match = tagPattern.exec(message);
  }

  if (lastIndex < message.length) {
    nodes.push(interpolate(message.slice(lastIndex), values));
  }

  return React.createElement(React.Fragment, null, ...nodes);
}

function createTranslator(namespace: string) {
  const translate = (key: string, values?: TranslationValues) =>
    interpolate(messageFor(namespace, key), values);
  translate.rich = (key: string, values?: TranslationValues) =>
    renderRich(messageFor(namespace, key), values);
  return translate;
}

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: string) => createTranslator(namespace),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => componentTestRouter(),
}));

vi.mock('@/libs/I18nNavigation', () => ({
  Link: (props: React.ComponentProps<'a'>) => (
    <a {...props} href={String(props.href ?? '')}>
      {props.children}
    </a>
  ),
  usePathname: () => componentTestPathname(),
}));

afterEach(() => {
  cleanup();
  resetComponentTestRouter();
});
