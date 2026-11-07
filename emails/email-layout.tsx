import type * as React from 'react';
import {
  Body,
  Container,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'react-email';
import { tokens } from '@/lib/mit-sailing/tokens';
import { getBaseUrl } from '@/utils/Helpers';

export type EmailLayoutProps = Readonly<{
  previewText: string;
  children: React.ReactNode;
}>;

export type MarketingEmailLayoutProps = Readonly<{
  children: React.ReactNode;
  listName: string;
  managePreferencesLabel: string;
  manageUrl: string;
  postalAddress: string;
  previewText: string;
  unsubscribeUrl: string;
}>;

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
  backgroundColor: tokens.colors.mitEmailRed,
  padding: '22px 24px',
};

const brandLogo: React.CSSProperties = {
  display: 'block',
  height: '34px',
  margin: 0,
  width: 'auto',
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
  color: tokens.colors.mitEmailRed,
};

/**
 * On-dark lockup for the red email header (absolute URL for clients).
 *
 * @returns Brand image for transactional and marketing chrome
 */
function EmailBrandLogo() {
  const src = `${getBaseUrl().replace(/\/$/, '')}/assets/images/logo-on-dark.png`;
  return (
    <Img
      alt="MIT Sailing"
      height={34}
      src={src}
      style={brandLogo}
      width={148}
    />
  );
}

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
      <Preview>{props.previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <EmailBrandLogo />
          </Section>
          {props.children}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={muted}>
              You received this email because of an action on your MIT Sailing
              account.
            </Text>
            <Text style={muted}>
              <Link href="mailto:support@mitsailing.com" style={link}>
                Contact MIT Sailing support
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/**
 * Shared compliance chrome for marketing newsletter templates.
 *
 * @param props - Layout configuration and unsubscribe links.
 * @returns Complete HTML email document tree.
 */
export function MarketingEmailLayout(props: MarketingEmailLayoutProps) {
  const unsubscribeLabel = `Unsubscribe from ${props.listName}`;
  return (
    <Html lang="en">
      <Preview>{props.previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <EmailBrandLogo />
          </Section>
          {props.children}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={muted}>
              You received this {props.listName} broadcast because you
              subscribed to MIT Sailing newsletters.
            </Text>
            <Text style={muted}>
              <Link href={props.unsubscribeUrl} style={link}>
                {unsubscribeLabel}
              </Link>
              {' · '}
              <Link href={props.manageUrl} style={link}>
                {props.managePreferencesLabel}
              </Link>
            </Text>
            <Text style={muted}>{props.postalAddress}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
