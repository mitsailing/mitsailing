import type * as React from 'react';
import { Heading, Link, Text } from 'react-email';
import sanitizeHtml from 'sanitize-html';

const allowedTags = [
  'a',
  'blockquote',
  'br',
  'em',
  'h2',
  'h3',
  'li',
  'ol',
  'p',
  'strong',
  'ul',
] satisfies string[];

const allowedAttributes: Record<string, string[]> = {
  a: ['href', 'rel', 'target'],
};

const headingTwo: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '20px',
  fontWeight: 700,
  lineHeight: '28px',
  margin: '20px 0 10px',
};

const headingThree: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '17px',
  fontWeight: 700,
  lineHeight: '24px',
  margin: '18px 0 8px',
};

const paragraph: React.CSSProperties = {
  color: '#334155',
  fontSize: '15px',
  lineHeight: '23px',
  margin: '0 0 16px',
};

const quote: React.CSSProperties = {
  ...paragraph,
  color: '#475569',
  fontStyle: 'italic',
};

const link: React.CSSProperties = {
  color: '#005f83',
  fontWeight: 700,
};

type BodyBlock = Readonly<{
  html: string;
  key: string;
  tag: 'blockquote' | 'h2' | 'h3' | 'li' | 'p';
}>;

function transformLink(tagName: string, attribs: Record<string, string>) {
  return {
    attribs: {
      ...attribs,
      rel: 'noopener noreferrer',
      target: '_blank',
    },
    tagName,
  };
}

export function sanitizeEmailTemplateBodyHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedAttributes,
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedTags: [...allowedTags],
    transformTags: {
      a: transformLink,
    },
  }).trim();
}

function plainTextFromHtml(value: string): string {
  return sanitizeHtml(value.replaceAll(/<br\s*\/?>/gi, '\n'), {
    allowedAttributes: {},
    allowedTags: [],
  }).trim();
}

function isBodyBlockTag(value: string): value is BodyBlock['tag'] {
  return ['blockquote', 'h2', 'h3', 'li', 'p'].includes(value);
}

function bodyBlocksFromHtml(html: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  const blockPattern =
    /<(blockquote|h2|h3|li|p)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let index = 0;
  for (const match of html.matchAll(blockPattern)) {
    const [, tag, content] = match;
    if (!content || !tag || !isBodyBlockTag(tag)) {
      continue;
    }
    const text = plainTextFromHtml(content);
    if (text.length === 0) {
      continue;
    }
    blocks.push({
      html: content,
      key: `${tag}-${index}`,
      tag,
    });
    index += 1;
  }

  if (blocks.length > 0) {
    return blocks;
  }

  const fallback = plainTextFromHtml(html);
  return fallback ? [{ html: fallback, key: 'p-0', tag: 'p' }] : [];
}

function linkHref(value: string): string | null {
  const match = /\bhref=(["'])(.*?)\1/i.exec(value);
  return match?.[2] ?? null;
}

function inlineNodesFromHtml(html: string, keyPrefix: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  const linkPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let cursor = 0;
  let index = 0;

  for (const match of html.matchAll(linkPattern)) {
    const [fullMatch, attributes = '', innerHtml = ''] = match;
    if (typeof match.index !== 'number') {
      continue;
    }

    const textBefore = plainTextFromHtml(html.slice(cursor, match.index));
    if (textBefore.length > 0) {
      nodes.push(textBefore);
    }

    const href = linkHref(attributes);
    const linkText = plainTextFromHtml(innerHtml);
    if (href && linkText.length > 0) {
      nodes.push(
        <Link href={href} key={`${keyPrefix}-link-${index}`} style={link}>
          {linkText}
        </Link>
      );
    } else if (linkText.length > 0) {
      nodes.push(linkText);
    }

    cursor = match.index + fullMatch.length;
    index += 1;
  }

  const textAfter = plainTextFromHtml(html.slice(cursor));
  if (textAfter.length > 0) {
    nodes.push(textAfter);
  }

  return nodes.length > 0 ? nodes : plainTextFromHtml(html);
}

function renderBodyBlock(block: BodyBlock) {
  const children = inlineNodesFromHtml(block.html, block.key);
  switch (block.tag) {
    case 'h2': {
      return (
        <Heading as="h2" key={block.key} style={headingTwo}>
          {children}
        </Heading>
      );
    }
    case 'h3': {
      return (
        <Heading as="h3" key={block.key} style={headingThree}>
          {children}
        </Heading>
      );
    }
    case 'blockquote': {
      return (
        <Text key={block.key} style={quote}>
          {children}
        </Text>
      );
    }
    case 'li': {
      return (
        <Text key={block.key} style={paragraph}>
          {'• '}
          {children}
        </Text>
      );
    }
    case 'p': {
      return (
        <Text key={block.key} style={paragraph}>
          {children}
        </Text>
      );
    }
    default: {
      throw new TypeError('Unhandled email body block');
    }
  }
}

export function SafeEmailTemplateBodyHtml(props: { html: string }) {
  const sanitized = sanitizeEmailTemplateBodyHtml(props.html);
  return <>{bodyBlocksFromHtml(sanitized).map(renderBodyBlock)}</>;
}
