import type { getTranslations } from 'next-intl/server';
import * as React from 'react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type { AdminStatusSemanticTone } from '@/lib/mit-sailing/tokens';
import {
  adminEventListStatusBadgeBaseClassName,
  adminEventListStatusBadgeToneClassName,
} from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';

export type AdminEventsTranslations = Awaited<
  ReturnType<typeof getTranslations<'AdminEvents'>>
>;

/**
 * Bordered status chip for admin event surfaces; classes come from
 * {@link import("@/lib/mit-sailing/tokens").adminEventListStatusBadgeToneClassName}
 * so colors stay on theme tokens (`mit-theme.css` / `@theme inline`), not raw
 * palette utilities in call sites.
 *
 * @param props - Label content and semantic tone
 * @returns Inline badge element
 */
export function AdminEventListStatusBadge(props: {
  children: React.ReactNode;
  tone: AdminStatusSemanticTone;
}) {
  return (
    <span
      className={cn(
        adminEventListStatusBadgeBaseClassName,
        adminEventListStatusBadgeToneClassName[props.tone]
      )}
    >
      {props.children}
    </span>
  );
}

type AdminEventFormSectionProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
};

export function AdminEventFormSection(props: AdminEventFormSectionProps) {
  return (
    <Card aria-labelledby={props.id} className="rounded-lg">
      <CardHeader>
        <CardTitle>
          <h2 id={props.id}>{props.title}</h2>
        </CardTitle>
        {props.subtitle ? (
          <CardDescription className="max-w-3xl text-mit-readable-ink">
            {props.subtitle}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {props.children}
      </CardContent>
    </Card>
  );
}

export function AdminEventEmptyState(props: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-mit-readable-ink">
      {props.children}
    </div>
  );
}

type AdminEventFieldControlProps = {
  'aria-describedby'?: string;
};

type AdminEventFieldChildren =
  | React.ReactNode
  | ((controlProps: AdminEventFieldControlProps) => React.ReactNode);

/**
 * Merges prior `aria-describedby` tokens with a hint id; order kept, ids deduped.
 *
 * @param existing - Prior id reference list from the control, if any
 * @param hintId - Hint paragraph id when this field shows hint copy
 * @returns Combined space-separated ids, or undefined when none apply
 */
function mergeAriaDescribedBy(
  existing: string | undefined | null,
  hintId: string | undefined
): string | undefined {
  const existingTokens =
    typeof existing === 'string'
      ? existing.trim().split(/\s+/).filter(Boolean)
      : [];

  if (!hintId) {
    return existingTokens.length > 0 ? existingTokens.join(' ') : undefined;
  }

  const tokens = [...existingTokens, hintId];
  const seen = new Set<string>();
  const unique = tokens.filter((id) => {
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
  return unique.join(' ');
}

export function AdminEventField(props: {
  children: AdminEventFieldChildren;
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  className?: string;
}) {
  const hintId = useId();
  const resolvedHintId = props.hint ? hintId : undefined;

  const controlProps: AdminEventFieldControlProps = {
    'aria-describedby': mergeAriaDescribedBy(undefined, resolvedHintId),
  };

  let control: React.ReactNode;
  if (typeof props.children === 'function') {
    control = props.children(controlProps);
  } else if (
    React.isValidElement<{ 'aria-describedby'?: string }>(props.children) &&
    props.children.type !== React.Fragment
  ) {
    const priorDescribedBy = props.children.props['aria-describedby'];
    // eslint-disable-next-line react/no-clone-element -- Merge hint id into element children for `aria-describedby` without requiring a render-prop control.
    control = React.cloneElement(props.children, {
      'aria-describedby': mergeAriaDescribedBy(
        priorDescribedBy,
        resolvedHintId
      ),
    });
  } else {
    control = props.children;
  }

  return (
    <div className={cn('flex flex-col gap-1.5', props.className)}>
      <Label className="text-foreground" htmlFor={props.htmlFor}>
        {props.label}
      </Label>
      {control}
      {props.hint ? (
        <p className="text-xs text-mit-readable-ink" id={resolvedHintId}>
          {props.hint}
        </p>
      ) : null}
    </div>
  );
}

export function AdminEventCheckbox(props: {
  label: React.ReactNode;
  name: string;
  defaultChecked?: boolean;
  hint?: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-mit-readable-ink">
      <input name={props.name} type="hidden" value="false" />
      <input
        className="mt-0.5 size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
        defaultChecked={props.defaultChecked}
        name={props.name}
        type="checkbox"
        value="true"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">{props.label}</span>
        {props.hint ? (
          <span className="text-xs text-mit-readable-ink">{props.hint}</span>
        ) : null}
      </span>
    </label>
  );
}

export function AdminEventBackLink(props: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Button asChild className="w-fit" size="sm" variant="ghost">
      <Link href={props.href}>{props.children}</Link>
    </Button>
  );
}

type AdminEventReadOnlyNoticeTranslations = (
  key: 'read_only_notice_title' | 'read_only_notice_body'
) => string;

export function AdminEventReadOnlyNotice(props: {
  t: AdminEventReadOnlyNoticeTranslations;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
      <p className="text-sm font-semibold text-foreground">
        {props.t('read_only_notice_title')}
      </p>
      <p className="mt-1 text-sm text-mit-readable-ink">
        {props.t('read_only_notice_body')}
      </p>
    </div>
  );
}

export function adminEventFormErrorMessage(
  code: string | null | undefined,
  t: AdminEventsTranslations
): string | null {
  if (!code) {
    return null;
  }
  if (code === 'validation_failed') {
    return t('form_error_validation_failed');
  }
  if (code === 'invalid_event_fee_amount') {
    return t('form_error_invalid_event_fee_amount');
  }
  if (code === 'capacity_full') {
    return t('form_error_capacity_full');
  }
  if (code === 'duplicate_slug') {
    return t('form_error_duplicate_slug');
  }
  if (code === 'not_found') {
    return t('form_error_not_found');
  }
  if (code === 'foreign_key') {
    return t('form_error_foreign_key');
  }
  return t('form_error_unknown');
}
