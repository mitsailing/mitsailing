import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import React from 'react';
import { afterEach, vi } from 'vitest';
import enMessages from '@/locales/en.json';
import {
  componentTestPathname,
  componentTestRouter,
  componentTestSearchParams,
  resetComponentTestState,
} from '@/test/component';

type TranslationValue = React.ReactNode | RichValue;
type TranslationValues = Record<string, TranslationValue>;
type RichValue = (chunks: React.ReactNode) => React.ReactNode;

const messageCatalog: Record<string, Record<string, string>> = enMessages;

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
  function parseNodes(
    startIndex = 0,
    endTag?: string
  ): {
    index: number;
    nodes: React.ReactNode[];
  } {
    const nodes: React.ReactNode[] = [];
    let index = startIndex;

    while (index < message.length) {
      const nextTagIndex = message.indexOf('<', index);
      if (nextTagIndex === -1) {
        nodes.push(interpolate(message.slice(index), values));
        return { index: message.length, nodes };
      }

      if (nextTagIndex > index) {
        nodes.push(interpolate(message.slice(index, nextTagIndex), values));
      }

      const closeMatch = message.slice(nextTagIndex).match(/^<\/(\w+)>/u);
      if (closeMatch) {
        const tag = closeMatch[1] ?? '';
        const closeIndex = nextTagIndex + closeMatch[0].length;
        if (tag === endTag) {
          return { index: closeIndex, nodes };
        }
        nodes.push(
          interpolate(message.slice(nextTagIndex, closeIndex), values)
        );
        index = closeIndex;
        continue;
      }

      const openMatch = message.slice(nextTagIndex).match(/^<(\w+)>/u);
      if (!openMatch) {
        nodes.push(interpolate(message[nextTagIndex] ?? '', values));
        index = nextTagIndex + 1;
        continue;
      }

      const tag = openMatch[1] ?? '';
      const innerStart = nextTagIndex + openMatch[0].length;
      const inner = parseNodes(innerStart, tag);
      const renderer = values[tag];
      nodes.push(
        typeof renderer === 'function'
          ? renderer(React.createElement(React.Fragment, null, ...inner.nodes))
          : React.createElement(React.Fragment, null, ...inner.nodes)
      );
      index = inner.index === innerStart ? innerStart : inner.index;
    }

    return { index, nodes };
  }

  return React.createElement(React.Fragment, null, ...parseNodes(0).nodes);
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

vi.mock('next/navigation', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Vitest `importOriginal` needs the module type for the spread.
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    useRouter: () => componentTestRouter(),
    useSearchParams: () => componentTestSearchParams(),
  };
});

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
  resetComponentTestState();
});
