'use client';

import { Save } from 'lucide-react';
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
        <output className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-900">
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
