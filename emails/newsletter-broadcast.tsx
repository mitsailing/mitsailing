import type * as React from 'react';
import { Heading, Section, Text } from 'react-email';
import { SafeEmailTemplateBodyHtml } from '@/libs/email-templates/emailTemplateBodyHtml';
import { MarketingEmailLayout } from './email-layout';

export type NewsletterBroadcastTemplateProps = Readonly<{
  body: string;
  listName: string;
  manageUrl: string;
  postalAddress: string;
  previewText: string;
  subject: string;
  unsubscribeUrl: string;
}>;

const content: React.CSSProperties = {
  padding: '30px 28px 26px',
};

const heading: React.CSSProperties = {
  color: '#171717',
  fontSize: '24px',
  fontWeight: 700,
  lineHeight: '32px',
  margin: '0 0 18px',
};

const paragraph: React.CSSProperties = {
  color: '#262626',
  fontSize: '16px',
  lineHeight: '25px',
  margin: '0 0 16px',
};

function bodyParagraphs(body: string): string[] {
  return body
    .replaceAll('\r\n', '\n')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function bodyParagraphItems(body: string): { key: string; text: string }[] {
  return bodyParagraphs(body).map((text, index) => ({
    key: `p-${index}`,
    text,
  }));
}

function containsHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/**
 * Resend-style marketing broadcast email with local preference links.
 *
 * @param props - Broadcast content and compliance links
 * @returns Complete HTML email document tree
 */
export function NewsletterBroadcastTemplate(
  props: NewsletterBroadcastTemplateProps
) {
  const paragraphs = bodyParagraphItems(props.body);
  const isEditorHtml = containsHtml(props.body);
  return (
    <MarketingEmailLayout
      listName={props.listName}
      manageUrl={props.manageUrl}
      postalAddress={props.postalAddress}
      previewText={props.previewText}
      unsubscribeUrl={props.unsubscribeUrl}
    >
      <Section style={content}>
        <Heading as="h1" style={heading}>
          {props.subject}
        </Heading>
        {isEditorHtml ? (
          <SafeEmailTemplateBodyHtml html={props.body} />
        ) : (
          paragraphs.map((item) => (
            <Text key={item.key} style={paragraph}>
              {item.text}
            </Text>
          ))
        )}
      </Section>
    </MarketingEmailLayout>
  );
}
