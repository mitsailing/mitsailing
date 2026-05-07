import * as React from 'react';
import { cn } from '@/lib/utils';

type AdminPageHeaderProps = {
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

/**
 * Standard admin list/section title row (h1 plus optional trailing actions).
 *
 * @param props - Header layout
 * @param props.title - Page or section title
 * @param props.actions - Optional trailing controls
 * @param props.className - Extra classes on the flex row
 * @returns Title row markup
 */
export function AdminPageHeader(props: AdminPageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-4',
        props.className
      )}
    >
      <h1 className="text-2xl font-semibold text-mit-text">{props.title}</h1>
      {props.actions ?? null}
    </div>
  );
}
