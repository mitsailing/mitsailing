import type * as React from 'react';
import { cn } from '@/lib/utils';

export type AdminDataRowItem = Readonly<{
  label: string;
  value: React.ReactNode;
}>;

export type AdminMetricStripItem = Readonly<{
  label: string;
  value: React.ReactNode;
}>;

export function AdminPageSection(
  props: Readonly<{
    children: React.ReactNode;
    id?: string;
    subtitle?: React.ReactNode;
    title: React.ReactNode;
  }>
) {
  return (
    <section
      aria-labelledby={props.id}
      className="grid gap-4 border-y border-border py-5"
    >
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold text-foreground" id={props.id}>
          {props.title}
        </h2>
        {props.subtitle ? (
          <p className="m-0 max-w-3xl text-sm text-mit-readable-ink">
            {props.subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-4">{props.children}</div>
    </section>
  );
}

export function AdminDetailRows(
  props: Readonly<{
    labelWidthClassName?: string;
    rows: readonly AdminDataRowItem[];
  }>
) {
  return (
    <dl className="m-0 divide-y divide-border border-y border-border text-sm">
      {props.rows.map((row) => (
        <div
          className={cn(
            'grid gap-1 py-3 md:gap-4',
            props.labelWidthClassName ?? 'md:grid-cols-[12rem_minmax(0,1fr)]'
          )}
          key={row.label}
        >
          <dt className="font-medium text-muted-foreground">{row.label}</dt>
          <dd className="m-0 min-w-0 break-words text-foreground">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminSummaryRows(
  props: Readonly<{
    rows: readonly (readonly AdminDataRowItem[])[];
  }>
) {
  return (
    <dl className="m-0 divide-y divide-border border-y border-border text-sm">
      {props.rows.map((row) => (
        <div
          className="grid gap-3 py-3 md:grid-cols-3"
          key={row.map((item) => item.label).join(':')}
        >
          {row.map((item) => (
            <div className="min-w-0" key={item.label}>
              <dt className="text-xs font-medium text-muted-foreground">
                {item.label}
              </dt>
              <dd className="m-0 mt-1 min-w-0 break-words text-foreground">
                {item.value}
              </dd>
            </div>
          ))}
        </div>
      ))}
    </dl>
  );
}

export function AdminMetricStrip(
  props: Readonly<{
    columnsClassName?: string;
    metrics: readonly AdminMetricStripItem[];
  }>
) {
  return (
    <dl
      className={cn(
        'grid border-y border-border text-sm sm:divide-x sm:divide-border',
        props.columnsClassName ?? 'sm:grid-cols-4'
      )}
    >
      {props.metrics.map((metric) => (
        <div className="py-3 sm:px-4" key={metric.label}>
          <dt className="text-sm font-medium text-mit-readable-ink">
            {metric.label}
          </dt>
          <dd className="mt-1 text-xl font-semibold text-foreground tabular-nums">
            {metric.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminResponsiveColumnLabel(props: Readonly<{ label: string }>) {
  return (
    <p className="m-0 text-xs font-medium text-muted-foreground md:hidden">
      {props.label}
    </p>
  );
}

export function AdminTableContainer(
  props: Readonly<{
    children: React.ReactNode;
    className?: string;
  }>
) {
  return (
    <div className={cn('border-y border-border', props.className)}>
      {props.children}
    </div>
  );
}
