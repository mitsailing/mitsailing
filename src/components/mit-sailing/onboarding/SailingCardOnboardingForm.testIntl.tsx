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

type RichParseResult = {
  readonly nextIndex: number;
  readonly node: React.ReactNode;
};

const parseRichOpeningPart = (props: {
  readonly chunks: Record<
    string,
    (children: React.ReactNode) => React.ReactNode
  >;
  readonly index: number;
  readonly part: string;
  readonly parts: string[];
}): RichParseResult | undefined => {
  if (
    props.part !== '<terms>' &&
    props.part !== '<privacy>' &&
    props.part !== '<membership>'
  ) {
    return undefined;
  }

  const closingTag = closingTagFor(props.part);
  const closingIndex = props.parts.indexOf(closingTag, props.index + 1);
  if (closingIndex === -1) {
    return {
      nextIndex: props.index + 1,
      node: props.part,
    };
  }

  const content = props.parts.slice(props.index + 1, closingIndex).join('');
  const formatter = formatterFor(props.part, props.chunks);

  return {
    nextIndex: closingIndex + 1,
    node: formatter ? formatter(content) : content,
  };
};

const isRichClosingPart = (part: string) =>
  part === '</terms>' || part === '</privacy>' || part === '</membership>';

type Translator = {
  (key: string, values?: Record<string, number | string>): string;
  rich: (
    key: string,
    chunks: Record<string, (children: React.ReactNode) => React.ReactNode>
  ) => React.ReactNode[];
};

export function useOnboardingTestTranslations(): Translator {
  const translate = Object.assign(
    (key: string, values: Record<string, number | string> = {}) => {
      let message = onboardingMessages[key] ?? key;
      for (const [name, value] of Object.entries(values)) {
        message = message.replaceAll(`{${name}}`, String(value));
      }
      return message;
    },
    {
      rich: (
        key: string,
        chunks: Record<string, (children: React.ReactNode) => React.ReactNode>
      ) => {
        const message = onboardingMessages[key] ?? key;
        const parts = message.split(
          /(<terms>|<\/terms>|<privacy>|<\/privacy>|<membership>|<\/membership>)/
        );
        const nodes: React.ReactNode[] = [];

        let index = 0;
        while (index < parts.length) {
          const part = parts[index] ?? '';
          const parsedPart = parseRichOpeningPart({
            chunks,
            index,
            part,
            parts,
          });

          if (parsedPart) {
            nodes.push(parsedPart.node);
            index = parsedPart.nextIndex;
            continue;
          }

          if (!isRichClosingPart(part)) {
            nodes.push(part);
          }

          index += 1;
        }

        return nodes;
      },
    }
  );
  return translate;
}
