'use client';

import { RotateCcw, Save } from 'lucide-react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import type { NewsletterPreferenceActionResult } from '@/libs/newsletter/newsletterActions';

type NewsletterPreferenceFormState =
  | NewsletterPreferenceActionResult
  | { ok: null };

type NewsletterPreferenceFormProps = Readonly<{
  action: (formData: FormData) => Promise<NewsletterPreferenceActionResult>;
  errorLabel: string;
  legendLabel: string;
  lists: {
    description: string | null;
    id: string;
    name: string;
    subscribed: boolean;
  }[];
  successLabel: string;
  submitLabel: string;
}>;

type NewsletterOneClickResubscribeFormProps = Readonly<{
  action: (formData: FormData) => Promise<NewsletterPreferenceActionResult>;
  errorLabel: string;
  listIds: string[];
  submitLabel: string;
  successLabel: string;
}>;

const initialState: NewsletterPreferenceFormState = { ok: null };

function SubmitButton(props: Readonly<{ label: string }>) {
  const status = useFormStatus();
  return (
    <Button
      className="gap-2"
      disabled={status.pending}
      type="submit"
      variant="mit"
    >
      <Save aria-hidden className="size-4" />
      {props.label}
    </Button>
  );
}

function ResubscribeButton(props: Readonly<{ label: string }>) {
  const status = useFormStatus();
  return (
    <Button
      className="gap-2"
      disabled={status.pending}
      type="submit"
      variant="mit"
    >
      <RotateCcw aria-hidden className="size-4" />
      {props.label}
    </Button>
  );
}

/**
 * One-click resubscribe form for the list that was just unsubscribed.
 *
 * @param props - Resubscribe action config
 * @returns Server-action form
 */
export function NewsletterOneClickResubscribeForm(
  props: NewsletterOneClickResubscribeFormProps
) {
  const [state, formAction] = useActionState(
    async (
      _previousState: NewsletterPreferenceFormState,
      formData: FormData
    ): Promise<NewsletterPreferenceFormState> => {
      const result = await props.action(formData);
      return result;
    },
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row">
      {props.listIds.map((listId) => (
        <input key={listId} name="listId" type="hidden" value={listId} />
      ))}
      <ResubscribeButton label={props.submitLabel} />
      {state.ok === true ? (
        <output className="rounded-lg border border-mit-success/30 bg-mit-success/10 px-4 py-3 text-sm font-medium text-mit-success-ink">
          {props.successLabel}
        </output>
      ) : null}
      {state.ok === false ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          role="alert"
        >
          {props.errorLabel}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Newsletter preference checkbox form.
 *
 * @param props - Preference form config
 * @returns Server-action form
 */
export function NewsletterPreferenceForm(props: NewsletterPreferenceFormProps) {
  const [state, formAction] = useActionState(
    async (
      _previousState: NewsletterPreferenceFormState,
      formData: FormData
    ): Promise<NewsletterPreferenceFormState> => {
      const result = await props.action(formData);
      return result;
    },
    initialState
  );
  const errorId =
    state.ok === false ? 'newsletter-preference-error' : undefined;

  return (
    <form action={formAction} className="space-y-5">
      {state.ok === true ? (
        <output className="rounded-lg border border-mit-success/30 bg-mit-success/10 px-4 py-3 text-sm font-medium text-mit-success-ink">
          {props.successLabel}
        </output>
      ) : null}
      {state.ok === false ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          id="newsletter-preference-error"
          role="alert"
        >
          {props.errorLabel}
        </p>
      ) : null}
      <fieldset aria-describedby={errorId}>
        <legend className="sr-only">{props.legendLabel}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {props.lists.map((list) => (
            <div
              className="rounded-lg border border-border bg-card p-4 text-sm"
              key={list.id}
            >
              <span className="flex items-start gap-3">
                <input
                  aria-describedby={
                    list.description
                      ? `newsletter-preference-${list.id}-description`
                      : undefined
                  }
                  className="mt-1"
                  defaultChecked={list.subscribed}
                  id={`newsletter-preference-${list.id}`}
                  name="listId"
                  type="checkbox"
                  value={list.id}
                />
                <span>
                  <label
                    className="block font-medium text-foreground"
                    htmlFor={`newsletter-preference-${list.id}`}
                  >
                    {list.name}
                  </label>
                  {list.description ? (
                    <span
                      className="mt-1 block text-muted-foreground"
                      id={`newsletter-preference-${list.id}-description`}
                    >
                      {list.description}
                    </span>
                  ) : null}
                </span>
              </span>
            </div>
          ))}
        </div>
      </fieldset>
      <SubmitButton label={props.submitLabel} />
    </form>
  );
}
