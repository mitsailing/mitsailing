import type * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'react-email';

export type NewsletterBroadcastTemplateProps = {
  body: string;
  listName: string;
  manageUrl: string;
  postalAddress: string;
  previewText: string;
  subject: string;
  unsubscribeUrl: string;
};

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#f4f5f7',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,sans-serif',
  margin: 0,
  padding: '24px 12px',
};

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: '620px',
  overflow: 'hidden',
};

const header: React.CSSProperties = {
  backgroundColor: '#8a1538',
  padding: '22px 28px',
};

const brand: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: 700,
  margin: 0,
};

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

const footer: React.CSSProperties = {
  padding: '18px 28px 28px',
};

const muted: React.CSSProperties = {
  color: '#64748b',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0 0 8px',
};

const link: React.CSSProperties = {
  color: '#8a1538',
};

function bodyParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
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
  const paragraphs = bodyParagraphs(props.body);
  return (
    <Html lang="en">
      <Head />
      <Preview>{props.previewText}</Preview>
      <Body style={bodyStyle}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>MIT Sailing</Text>
          </Section>
          <Section style={content}>
            <Heading as="h1" style={heading}>
              {props.subject}
            </Heading>
            {paragraphs.map((text) => (
              <Text key={text} style={paragraph}>
                {text}
              </Text>
            ))}
          </Section>
          <Hr />
          <Section style={footer}>
            <Text style={muted}>
              You received this {props.listName} broadcast because you
              subscribed to MIT Sailing newsletters.
            </Text>
            <Text style={muted}>
              <Link href={props.unsubscribeUrl} style={link}>
                Unsubscribe from {props.listName}
              </Link>
              {' · '}
              <Link href={props.manageUrl} style={link}>
                Manage email newsletters
              </Link>
            </Text>
            <Text style={muted}>{props.postalAddress}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
