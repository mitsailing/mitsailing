import type { getTranslations } from 'next-intl/server';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';

export type AdminEventsTranslations = Awaited<
  ReturnType<typeof getTranslations<'AdminEvents'>>
>;

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
          <CardDescription className="max-w-3xl">
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
    <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
      {props.children}
    </div>
  );
}

export function AdminEventField(props: {
  children: React.ReactNode;
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', props.className)}>
      <Label className="text-foreground" htmlFor={props.htmlFor}>
        {props.label}
      </Label>
      {props.children}
      {props.hint ? (
        <p className="text-xs text-muted-foreground">{props.hint}</p>
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
    <label className="flex cursor-pointer items-start gap-2 text-sm text-mit-text">
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
          <span className="text-xs text-muted-foreground">{props.hint}</span>
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
