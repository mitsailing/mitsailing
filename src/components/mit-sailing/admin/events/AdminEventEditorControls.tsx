'use client';

import * as React from 'react';
import {
  EventDetailPageKind,
  EventRegistrationMode,
} from '@/generated/prisma/enums';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';

function registrationModeFromValue(value: string): EventRegistrationMode {
  if (value === EventRegistrationMode.external) {
    return EventRegistrationMode.external;
  }
  if (value === EventRegistrationMode.none) {
    return EventRegistrationMode.none;
  }
  return EventRegistrationMode.standard;
}

function AdminEventFieldShell(props: {
  children: React.ReactNode;
  controlId: string;
  label: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-sm">
      <label className="font-medium text-foreground" htmlFor={props.controlId}>
        {props.label}
      </label>
      {props.children}
    </div>
  );
}

export function AdminEventDisclosureSection(props: {
  children: React.ReactNode;
  defaultOpen: boolean;
  enableName?: string;
  summary: string;
}) {
  const [open, setOpen] = React.useState(props.defaultOpen);
  return (
    <details
      className="rounded-lg border border-border bg-card px-4 py-3"
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
      open={open}
    >
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        {props.summary}
      </summary>
      {props.enableName ? (
        <input name={props.enableName} type="hidden" value={String(open)} />
      ) : null}
      <div className="mt-4 flex flex-col gap-4">{props.children}</div>
    </details>
  );
}

export function AdminEventDetailPageKindFields(props: {
  defaultValue: EventDetailPageKind;
  externalField: React.ReactNode;
  externalHint: string;
  externalLabel: string;
  fieldLabel: string;
  standardHint: string;
  standardLabel: string;
}) {
  const [detailPageKind, setDetailPageKind] = React.useState(
    props.defaultValue
  );
  const showExternalField = detailPageKind === EventDetailPageKind.external;
  return (
    <>
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">{props.fieldLabel}</legend>
        <label
          aria-label={props.standardLabel}
          className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          htmlFor="event-detail-page-kind-standard"
        >
          <input
            checked={detailPageKind === EventDetailPageKind.standard}
            className="mt-0.5"
            id="event-detail-page-kind-standard"
            name="detailPageKind"
            onChange={() => {
              setDetailPageKind(EventDetailPageKind.standard);
            }}
            type="radio"
            value={EventDetailPageKind.standard}
          />
          <span className="flex flex-col gap-0.5">
            <span
              className="font-medium"
              id="event-detail-page-kind-standard-label"
            >
              {props.standardLabel}
            </span>
            <span className="text-xs text-mit-readable-ink">
              {props.standardHint}
            </span>
          </span>
        </label>
        <label
          aria-label={props.externalLabel}
          className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          htmlFor="event-detail-page-kind-external"
        >
          <input
            checked={detailPageKind === EventDetailPageKind.external}
            className="mt-0.5"
            id="event-detail-page-kind-external"
            name="detailPageKind"
            onChange={() => {
              setDetailPageKind(EventDetailPageKind.external);
            }}
            type="radio"
            value={EventDetailPageKind.external}
          />
          <span className="flex flex-col gap-0.5">
            <span
              className="font-medium"
              id="event-detail-page-kind-external-label"
            >
              {props.externalLabel}
            </span>
            <span className="text-xs text-mit-readable-ink">
              {props.externalHint}
            </span>
          </span>
        </label>
      </fieldset>
      {showExternalField ? props.externalField : null}
    </>
  );
}

export function AdminEventRegistrationModeFields(props: {
  defaultValue: EventRegistrationMode;
  externalFields: React.ReactNode;
  externalLabel: string;
  fieldLabel: string;
  noneLabel: string;
  standardFields: React.ReactNode;
  standardLabel: string;
}) {
  const [registrationMode, setRegistrationMode] = React.useState(
    props.defaultValue
  );
  return (
    <>
      <AdminEventFieldShell
        controlId="event-registration-mode"
        label={props.fieldLabel}
      >
        <select
          className={adminNativeSelectClassName}
          id="event-registration-mode"
          name="registrationMode"
          onChange={(event) => {
            setRegistrationMode(registrationModeFromValue(event.target.value));
          }}
          value={registrationMode}
        >
          <option value={EventRegistrationMode.standard}>
            {props.standardLabel}
          </option>
          <option value={EventRegistrationMode.external}>
            {props.externalLabel}
          </option>
          <option value={EventRegistrationMode.none}>{props.noneLabel}</option>
        </select>
      </AdminEventFieldShell>
      {registrationMode === EventRegistrationMode.standard
        ? props.standardFields
        : null}
      {registrationMode === EventRegistrationMode.external
        ? props.externalFields
        : null}
    </>
  );
}
