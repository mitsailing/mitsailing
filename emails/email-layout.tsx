import type * as React from 'react';
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'react-email';

export type EmailLayoutProps = {
  children: React.ReactNode;
  copy: EmailLayoutCopy;
  previewText: string;
};

export type EmailLayoutCopy = {
  brand_name: string;
  footer_domain: string;
  footer_received: string;
};

const body: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,sans-serif',
  margin: 0,
  padding: '24px 12px',
};

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: '560px',
  overflow: 'hidden',
  padding: '0',
};

const header: React.CSSProperties = {
  backgroundColor: '#0f172a',
  padding: '20px 24px',
};

const brand: React.CSSProperties = {
  color: '#f8fafc',
  fontSize: '18px',
  fontWeight: 600,
  margin: 0,
};

const footer: React.CSSProperties = {
  padding: '16px 24px 24px',
};

const muted: React.CSSProperties = {
  color: '#64748b',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0 0 8px',
};

const hr: React.CSSProperties = {
  borderColor: '#e2e8f0',
  margin: 0,
};

const link: React.CSSProperties = {
  color: '#2563eb',
};

/**
 * Shared chrome (header, footer, container) for transactional templates.
 * @param props - Layout configuration.
 * @param props.previewText - Short inbox preview line.
 * @param props.children - Inner template sections.
 * @returns Complete HTML email document tree.
 */
export function EmailLayout(props: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{props.previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>{props.copy.brand_name}</Text>
          </Section>
          {props.children}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={muted}>{props.copy.footer_received}</Text>
            <Text style={muted}>
              <Link href="https://mitsailing.com" style={link}>
                {props.copy.footer_domain}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
