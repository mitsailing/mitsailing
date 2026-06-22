import type * as React from 'react';
import { Link } from '@/libs/I18nNavigation';

type AdminPaginationParams = Record<string, string | number | null | undefined>;

export function adminPaginationPage(value: unknown): number {
  if (typeof value !== 'string') {
    return 1;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function paginationHref(props: {
  readonly basePath: string;
  readonly page: number;
  readonly pageParamName: string;
  readonly params: AdminPaginationParams;
}) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(props.params)) {
    if (
      key === props.pageParamName ||
      value === null ||
      value === undefined ||
      value === ''
    ) {
      continue;
    }
    searchParams.set(key, String(value));
  }
  if (props.page > 1) {
    searchParams.set(props.pageParamName, String(props.page));
  }
  const query = searchParams.toString();
  return query ? `${props.basePath}?${query}` : props.basePath;
}

function PaginationLink(props: {
  readonly children: React.ReactNode;
  readonly disabled: boolean;
  readonly href: string;
}) {
  const className =
    'inline-flex h-9 items-center rounded-md border border-input px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted';
  return props.disabled ? (
    <span
      aria-disabled="true"
      className={`${className} cursor-not-allowed opacity-50`}
    >
      {props.children}
    </span>
  ) : (
    <Link className={className} href={props.href}>
      {props.children}
    </Link>
  );
}

export function AdminPagination(
  props: Readonly<{
    basePath: string;
    labels: {
      next: string;
      previous: string;
      summary: string;
    };
    page: number;
    pageParamName?: string;
    pageSize: number;
    params?: AdminPaginationParams;
    total: number;
  }>
) {
  const pageParamName = props.pageParamName ?? 'page';
  const totalPages = Math.max(1, Math.ceil(props.total / props.pageSize));
  if (props.total === 0 || totalPages <= 1) {
    return null;
  }
  const page = Math.min(Math.max(props.page, 1), totalPages);
  const previousPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);
  return (
    <nav
      aria-label={props.labels.summary}
      className="flex flex-col gap-3 border-t border-border pt-3 text-sm md:flex-row md:items-center md:justify-between"
    >
      <p className="m-0 text-mit-readable-ink">{props.labels.summary}</p>
      <div className="flex items-center gap-2">
        <PaginationLink
          disabled={page <= 1}
          href={paginationHref({
            basePath: props.basePath,
            page: previousPage,
            pageParamName,
            params: props.params ?? {},
          })}
        >
          {props.labels.previous}
        </PaginationLink>
        <PaginationLink
          disabled={page >= totalPages}
          href={paginationHref({
            basePath: props.basePath,
            page: nextPage,
            pageParamName,
            params: props.params ?? {},
          })}
        >
          {props.labels.next}
        </PaginationLink>
      </div>
    </nav>
  );
}
