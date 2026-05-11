'use client';

import { CalendarDays, HelpCircle, MapPinned, Send, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog } from 'radix-ui';
import type * as React from 'react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import { contactTopics } from '@/libs/mit-sailing/contactForm';
import type { ContactTopic } from '@/libs/mit-sailing/contactForm';

type ContactFormDialogProps = {
  currentYear: number;
  formAction: (formData: FormData) => Promise<void>;
  initialTopic?: ContactTopic;
  status?: 'error' | 'invalid' | 'sent';
};

type ContactCard = {
  topic: ContactTopic;
  translationKey: 'general' | 'reserve' | 'visit';
  icon: typeof HelpCircle;
};

type ContactCardContent = {
  title: string;
  description: string;
  examples: string[];
  buttonLabel: string;
};

const contactCards: readonly ContactCard[] = [
  {
    topic: 'General questions',
    translationKey: 'general',
    icon: HelpCircle,
  },
  {
    topic: 'Visit the Pavilion',
    translationKey: 'visit',
    icon: MapPinned,
  },
  {
    topic: 'Reserve Pavilion',
    translationKey: 'reserve',
    icon: CalendarDays,
  },
] as const;

const labelClassName = 'text-mit-text';
const helperClassName = 'text-sm leading-relaxed text-muted-foreground';
const fieldClassName = 'space-y-2';

function contactTopicLabel(
  t: ReturnType<typeof useTranslations<'MitSailingContact'>>,
  topic: ContactTopic
): string {
  if (topic === 'Visit the Pavilion') {
    return t('topic_visit');
  }
  if (topic === 'Reserve Pavilion') {
    return t('topic_reserve');
  }
  return t('topic_general');
}

function contactCardContent(
  t: ReturnType<typeof useTranslations<'MitSailingContact'>>,
  key: ContactCard['translationKey']
): ContactCardContent {
  if (key === 'visit') {
    return {
      buttonLabel: t('card_visit_button'),
      description: t('card_visit_description'),
      examples: [
        t('card_visit_example_0'),
        t('card_visit_example_1'),
        t('card_visit_example_2'),
      ],
      title: t('card_visit_title'),
    };
  }
  if (key === 'reserve') {
    return {
      buttonLabel: t('card_reserve_button'),
      description: t('card_reserve_description'),
      examples: [
        t('card_reserve_example_0'),
        t('card_reserve_example_1'),
        t('card_reserve_example_2'),
      ],
      title: t('card_reserve_title'),
    };
  }
  return {
    buttonLabel: t('card_general_button'),
    description: t('card_general_description'),
    examples: [
      t('card_general_example_0'),
      t('card_general_example_1'),
      t('card_general_example_2'),
    ],
    title: t('card_general_title'),
  };
}

function StatusMessage(props: { status?: ContactFormDialogProps['status'] }) {
  const t = useTranslations('MitSailingContact');
  if (props.status === 'sent') {
    return (
      <p
        className="rounded-lg border border-green-700/20 bg-green-50 px-4 py-3 text-sm font-medium text-green-950"
        role="status"
      >
        {t('status_sent')}
      </p>
    );
  }
  if (props.status === 'invalid') {
    return (
      <p
        className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-red-950"
        role="alert"
      >
        {t('status_invalid')}
      </p>
    );
  }
  if (props.status === 'error') {
    return (
      <p
        className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-red-950"
        role="alert"
      >
        {t('status_error')}
      </p>
    );
  }
  return null;
}

function ContactCardButton(props: {
  card: ContactCard;
  onSelect: (topic: ContactTopic) => void;
}) {
  const t = useTranslations('MitSailingContact');
  const Icon = props.card.icon;
  const key = props.card.translationKey;
  const content = contactCardContent(t, key);
  return (
    <section className="flex min-h-80 flex-col rounded-lg border border-mit-line bg-background p-5 shadow-sm">
      <div className="mb-5 flex size-11 items-center justify-center rounded-lg bg-mit-red-highlight text-primary-ink">
        <Icon aria-hidden className="size-5" />
      </div>
      <h3 className="mb-3 font-mit-serif text-xl font-semibold text-mit-text">
        {content.title}
      </h3>
      <p className="text-sm leading-relaxed text-mit-text">
        {content.description}
      </p>
      <ul className="mt-5 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {content.examples.map((example) => (
          <li className="flex gap-2" key={example}>
            <span
              aria-hidden
              className="mt-2 size-1.5 rounded-full bg-mit-red"
            />
            <span>{example}</span>
          </li>
        ))}
      </ul>
      <Button
        className="mt-auto h-10 w-full"
        onClick={() => {
          props.onSelect(props.card.topic);
        }}
        type="button"
        variant="mit"
      >
        <Send aria-hidden className="size-4" />
        {content.buttonLabel}
      </Button>
    </section>
  );
}

function ContactForm(
  props: ContactFormDialogProps & {
    topic: ContactTopic;
    topicRef: React.RefObject<HTMLSelectElement | null>;
  }
) {
  const tCommon = useTranslations('Common');
  const t = useTranslations('MitSailingContact');

  return (
    <form
      action={props.formAction}
      className="space-y-5"
      id="contact-form"
      key={props.topic}
    >
      <StatusMessage status={props.status} />
      <div className={fieldClassName}>
        <Label className={labelClassName} htmlFor="topic">
          {t('field_topic')}
        </Label>
        <select
          className={adminNativeSelectClassName}
          defaultValue={props.topic}
          id="topic"
          name="topic"
          ref={props.topicRef}
          required
        >
          {contactTopics.map((topic) => (
            <option key={topic} value={topic}>
              {contactTopicLabel(t, topic)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className={fieldClassName}>
          <Label className={labelClassName} htmlFor="name">
            {t('field_name')}
          </Label>
          <Input autoComplete="name" id="name" name="name" required />
        </div>
        <div className={fieldClassName}>
          <Label className={labelClassName} htmlFor="email">
            {t('field_email')}
          </Label>
          <Input
            autoComplete="email"
            id="email"
            name="email"
            required
            type="email"
          />
          <p className={helperClassName}>{t('field_email_help')}</p>
        </div>
      </div>
      <div className={fieldClassName}>
        <Label className={labelClassName} htmlFor="subject">
          {t('field_subject')}
        </Label>
        <Input id="subject" name="subject" required />
      </div>
      <div className={fieldClassName}>
        <Label className={labelClassName} htmlFor="message">
          {t('field_message')}
        </Label>
        <Textarea className="min-h-32" id="message" name="message" required />
      </div>
      <div className={fieldClassName}>
        <Label className={labelClassName} htmlFor="currentYear">
          {t('field_current_year')}
        </Label>
        <Input
          className="max-w-40"
          id="currentYear"
          inputMode="numeric"
          name="currentYear"
          pattern={`^${props.currentYear}$`}
          required
        />
        <p className={helperClassName}>{t('field_current_year_help')}</p>
      </div>
      <SubmitButton
        className="h-10 px-4"
        pendingLabel={tCommon('pending_sending')}
        variant="mit"
      >
        <Send aria-hidden className="size-4" />
        {t('send_message')}
      </SubmitButton>
    </form>
  );
}

/**
 * Renders topic cards and a focused modal contact form.
 *
 * @param props - Form action, submit status, optional topic from redirect, and server current year
 * @returns Three action cards plus modal form
 */
export function ContactFormDialog(props: ContactFormDialogProps) {
  const t = useTranslations('MitSailingContact');
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<ContactTopic>(
    () => props.initialTopic ?? 'General questions'
  );
  const [isOpen, setIsOpen] = useState(() => Boolean(props.status));

  function openForm(topic: ContactTopic): void {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setSelectedTopic(topic);
    setIsOpen(true);
  }

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-3">
        {contactCards.map((card) => (
          <ContactCardButton card={card} key={card.topic} onSelect={openForm} />
        ))}
      </div>

      <Dialog.Root modal onOpenChange={setIsOpen} open={isOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-8 outline-none"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              previouslyFocusedRef.current?.focus();
            }}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              firstFieldRef.current?.focus();
            }}
          >
            <div className="w-full max-w-2xl rounded-lg border border-mit-line bg-background shadow-xl">
              <div className="flex items-start justify-between gap-4 border-b border-mit-line px-5 py-4">
                <div>
                  <p className="mb-1 text-xs font-bold tracking-widest text-primary-ink uppercase">
                    {t('dialog_eyebrow')}
                  </p>
                  <Dialog.Title className="font-mit-serif text-2xl font-semibold text-mit-text">
                    {contactTopicLabel(t, selectedTopic)}
                  </Dialog.Title>
                </div>
                <Dialog.Close asChild>
                  <Button
                    aria-label={t('close_contact_form')}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <X aria-hidden className="size-5" />
                  </Button>
                </Dialog.Close>
              </div>
              <div className="px-5 py-5">
                <ContactForm
                  currentYear={props.currentYear}
                  formAction={props.formAction}
                  status={props.status}
                  topic={selectedTopic}
                  topicRef={firstFieldRef}
                />
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
