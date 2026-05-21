import type * as React from 'react';
import { Heading, Link, Section, Text } from 'react-email';
import { safeCmsHref } from '@/libs/mit-sailing/cmsHref';
import { EmailLayout } from './email-layout';
import { heading, paragraph, section } from './email-styles';

type PaymentDetail = {
  href?: string;
  label: string;
  value: string;
};

type EventPaymentEmailTemplateProps = {
  actionHref?: string;
  actionLabel?: string;
  body: string;
  details: readonly PaymentDetail[];
  previewText: string;
  title: string;
};

const detailLabel: React.CSSProperties = {
  color: '#64748b',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.04em',
  margin: '16px 0 4px',
  textTransform: 'uppercase',
};

const detailValue: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '15px',
  lineHeight: '22px',
  margin: '0',
};

const actionLink: React.CSSProperties = {
  color: '#005f83',
  fontSize: '15px',
  fontWeight: 700,
};

function SafeEmailLink(props: {
  children: React.ReactNode;
  url: string;
  style: React.CSSProperties;
}): React.ReactNode {
  const href = safeCmsHref(props.url);
  if (!href) {
    return props.children;
  }
  // nosemgrep: typescript.react.security.audit.react-href-var.react-href-var
  return (
    <Link href={href} style={props.style}>
      {props.children}
    </Link>
  );
}

export function EventPaymentEmailTemplate(
  props: EventPaymentEmailTemplateProps
) {
  return (
    <EmailLayout previewText={props.previewText}>
      <Section style={section}>
        <Heading as="h1" style={heading}>
          {props.title}
        </Heading>
        <Text style={paragraph}>{props.body}</Text>
        {props.details.map((detail) => (
          <Section key={detail.label}>
            <Text style={detailLabel}>{detail.label}</Text>
            <Text style={detailValue}>
              {detail.href ? (
                <SafeEmailLink style={actionLink} url={detail.href}>
                  {detail.value}
                </SafeEmailLink>
              ) : (
                detail.value
              )}
            </Text>
          </Section>
        ))}
        {props.actionHref && props.actionLabel ? (
          <Text style={{ ...paragraph, marginTop: 24 }}>
            <SafeEmailLink style={actionLink} url={props.actionHref}>
              {props.actionLabel}
            </SafeEmailLink>
          </Text>
        ) : null}
      </Section>
    </EmailLayout>
  );
}
