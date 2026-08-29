import type * as React from 'react';

/**
 * Bordered admin table surface with optional footer (pagination).
 *
 * @param props - Table shell props
 * @returns Table container markup
 */
export function AdminTableSurface(props: {
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {props.children}
      {props.footer ? (
        <div className="border-t border-border px-3 py-3">{props.footer}</div>
      ) : null}
    </div>
  );
}
