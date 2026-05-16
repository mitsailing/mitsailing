import type * as React from 'react';
import { Heading, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';
import { heading, paragraph, section } from './email-styles';

export type PavilionReservationEmailCopy = {
  submitted_preview: string;
  submitted_subject: string;
  submitted_heading: string;
  submitted_body: string;
  status_preview: string;
  status_subject: string;
  status_heading: string;
  status_body: string;
  field_reference: string;
  field_event: string;
  field_status: string;
  field_schedule: string;
  footer_contact: string;
};

export type PavilionReservationEmailTemplateProps = {
  body: string;
  copy: PavilionReservationEmailCopy;
  eventName: string;
  previewText: string;
  referenceCode: string;
  scheduleLines: readonly string[];
  statusLabel?: string;
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

const referenceValue: React.CSSProperties = {
  ...detailValue,
  fontFamily: 'Menlo, Monaco, Consolas, monospace',
  fontWeight: 700,
};

/**
 * Builds stable React keys for schedule lines; duplicate line strings stay unique.
 *
 * @param lines - Human-readable schedule lines
 * @returns Same lines paired with sibling-unique keys
 */
function scheduleLinesWithKeys(lines: readonly string[]) {
  const occurrenceByLine = new Map<string, number>();
  return lines.map((line) => {
    const occurrence = occurrenceByLine.get(line) ?? 0;
    occurrenceByLine.set(line, occurrence + 1);
    return { key: `${line}#${occurrence}`, line };
  });
}

/**
 * Shared Pavilion reservation email template.
 *
 * @param props - Template data and localized copy
 * @returns The localized Pavilion reservation email markup.
 */
export function PavilionReservationEmailTemplate(
  props: PavilionReservationEmailTemplateProps
) {
  return (
    <EmailLayout previewText={props.previewText}>
      <Section style={section}>
        <Heading as="h1" style={heading}>
          {props.title}
        </Heading>
        <Text style={paragraph}>{props.body}</Text>

        <Text style={detailLabel}>{props.copy.field_reference}</Text>
        <Text style={referenceValue}>{props.referenceCode}</Text>

        <Text style={detailLabel}>{props.copy.field_event}</Text>
        <Text style={detailValue}>{props.eventName}</Text>

        {props.statusLabel ? (
          <>
            <Text style={detailLabel}>{props.copy.field_status}</Text>
            <Text style={detailValue}>{props.statusLabel}</Text>
          </>
        ) : null}

        {props.scheduleLines.length > 0 ? (
          <>
            <Text style={detailLabel}>{props.copy.field_schedule}</Text>
            {scheduleLinesWithKeys(props.scheduleLines).map((row) => (
              <Text key={row.key} style={detailValue}>
                {row.line}
              </Text>
            ))}
          </>
        ) : null}

        <Text style={{ ...paragraph, marginTop: 24 }}>
          {props.copy.footer_contact}
        </Text>
      </Section>
    </EmailLayout>
  );
}
