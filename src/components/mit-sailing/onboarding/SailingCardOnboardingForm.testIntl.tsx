import type * as React from 'react';
import messages from '@/locales/en.json';

const onboardingMessages: Record<string, string> = messages.OnboardingPage;

const closingTagFor = (part: string) => {
  if (part === '<terms>') {
    return '</terms>';
  }
  if (part === '<privacy>') {
    return '</privacy>';
  }
  return '</membership>';
};

const formatterFor = (
  part: string,
  chunks: Record<string, (children: React.ReactNode) => React.ReactNode>
) => {
  if (part === '<terms>') {
    return chunks.terms;
  }
  if (part === '<privacy>') {
    return chunks.privacy;
  }
  return chunks.membership;
};

type Translator = {
  (key: string, values?: Record<string, number | string>): string;
  rich: (
    key: string,
    chunks: Record<string, (children: React.ReactNode) => React.ReactNode>
  ) => React.ReactNode[];
};

export function useOnboardingTestTranslations() {
  const translate = ((
    key: string,
    values: Record<string, number | string> = {}
  ) => {
    let message = onboardingMessages[key] ?? key;
    for (const [name, value] of Object.entries(values)) {
      message = message.replaceAll(`{${name}}`, String(value));
    }
    return message;
  }) as Translator;
  translate.rich = (
    key: string,
    chunks: Record<string, (children: React.ReactNode) => React.ReactNode>
  ) => {
    const message = onboardingMessages[key] ?? key;
    const parts = message.split(
      /(<terms>|<\/terms>|<privacy>|<\/privacy>|<membership>|<\/membership>)/
    );
    const nodes: React.ReactNode[] = [];

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      if (
        part === '<terms>' ||
        part === '<privacy>' ||
        part === '<membership>'
      ) {
        const closingTag = closingTagFor(part);
        const closingIndex = parts.indexOf(closingTag, index + 1);
        if (closingIndex === -1) {
          nodes.push(part);
          continue;
        }
        const content = parts.slice(index + 1, closingIndex).join('');
        const formatter = formatterFor(part, chunks);

        nodes.push(formatter ? formatter(content) : content);
        index = closingIndex;
        continue;
      }
      if (
        part !== '</terms>' &&
        part !== '</privacy>' &&
        part !== '</membership>'
      ) {
        nodes.push(part);
      }
    }

    return nodes;
  };
  return translate;
}
