'use client';

import { CalendarDays, HelpCircle, MapPinned, Send, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type * as React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
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
  status?: 'invalid' | 'sent';
};

type ContactCard = {
  topic: ContactTopic;
  title: string;
  description: string;
  examples: readonly string[];
  buttonLabel: string;
  icon: typeof HelpCircle;
};

const contactCards: readonly ContactCard[] = [
  {
    topic: 'General questions',
    title: 'General questions',
    description:
      'Classes, ratings, fleet access, membership, volunteering, and day-to-day Pavilion operations.',
    examples: ['Learning to sail', 'Membership help', 'Volunteer questions'],
    buttonLabel: 'Contact about general questions',
    icon: HelpCircle,
  },
  {
    topic: 'Visit the Pavilion',
    title: 'Visit the Pavilion',
    description:
      'Find the right waterfront location, confirm where to go, and avoid mixing up Pavilion and Mashnee events.',
    examples: ['Pavilion directions', 'Mashnee location', 'Visitor logistics'],
    buttonLabel: 'Contact about a visit',
    icon: MapPinned,
  },
  {
    topic: 'Reserve Pavilion',
    title: 'Reserve Pavilion',
    description:
      'Ask about facility reservations, hosted events, partnerships, and waterfront gathering options.',
    examples: ['Private events', 'MIT department events', 'Facility requests'],
    buttonLabel: 'Contact about reservations',
    icon: CalendarDays,
  },
] as const;

const labelClassName = 'text-mit-text';
const helperClassName = 'text-sm leading-relaxed text-muted-foreground';
const fieldClassName = 'space-y-2';

function StatusMessage(props: { status?: ContactFormDialogProps['status'] }) {
  if (props.status === 'sent') {
    return (
      <p className="rounded-lg border border-green-700/20 bg-green-50 px-4 py-3 text-sm font-medium text-green-950">
        Thanks. Your message has been sent to MIT Sailing.
      </p>
    );
  }
  if (props.status === 'invalid') {
    return (
      <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-red-950">
        Check the required fields and enter the current calendar year.
      </p>
    );
  }
  return null;
}

function ContactCardButton(props: {
  card: ContactCard;
  onSelect: (topic: ContactTopic) => void;
}) {
  const Icon = props.card.icon;
  return (
    <section className="flex min-h-80 flex-col rounded-lg border border-mit-line bg-background p-5 shadow-sm">
      <div className="mb-5 flex size-11 items-center justify-center rounded-lg bg-mit-red-highlight text-primary-ink">
        <Icon aria-hidden className="size-5" />
      </div>
      <h3 className="mb-3 font-mit-serif text-xl font-semibold text-mit-text">
        {props.card.title}
      </h3>
      <p className="text-sm leading-relaxed text-mit-text">
        {props.card.description}
      </p>
      <ul className="mt-5 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {props.card.examples.map((example) => (
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
        {props.card.buttonLabel}
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
          Topic
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
              {topic}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className={fieldClassName}>
          <Label className={labelClassName} htmlFor="name">
            Your name
          </Label>
          <Input autoComplete="name" id="name" name="name" required />
        </div>
        <div className={fieldClassName}>
          <Label className={labelClassName} htmlFor="email">
            Your email
          </Label>
          <Input
            autoComplete="email"
            id="email"
            name="email"
            required
            type="email"
          />
          <p className={helperClassName}>Required if you want a response.</p>
        </div>
      </div>
      <div className={fieldClassName}>
        <Label className={labelClassName} htmlFor="subject">
          Subject
        </Label>
        <Input id="subject" name="subject" required />
      </div>
      <div className={fieldClassName}>
        <Label className={labelClassName} htmlFor="message">
          Message
        </Label>
        <Textarea className="min-h-32" id="message" name="message" required />
      </div>
      <div className={fieldClassName}>
        <Label className={labelClassName} htmlFor="currentYear">
          Current year
        </Label>
        <Input
          className="max-w-40"
          id="currentYear"
          inputMode="numeric"
          name="currentYear"
          pattern={`^${props.currentYear}$`}
          required
        />
        <p className={helperClassName}>
          Enter the current calendar year to prove you are not a robot spammer.
        </p>
      </div>
      <SubmitButton
        className="h-10 px-4"
        pendingLabel={tCommon('pending_sending')}
        variant="mit"
      >
        <Send aria-hidden className="size-4" />
        Send message
      </SubmitButton>
    </form>
  );
}

/**
 * Renders topic cards and a focused modal contact form.
 *
 * @param props - Form action, submit status, and server current year
 * @returns Three action cards plus modal form
 */
export function ContactFormDialog(props: ContactFormDialogProps) {
  const titleId = useId();
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [selectedTopic, setSelectedTopic] =
    useState<ContactTopic>('General questions');
  const [isOpen, setIsOpen] = useState(Boolean(props.status));

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    firstFieldRef.current?.focus();
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setIsOpen(false);
        previouslyFocusedRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isOpen]);

  function openForm(topic: ContactTopic): void {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setSelectedTopic(topic);
    setIsOpen(true);
  }

  function closeForm(): void {
    setIsOpen(false);
    previouslyFocusedRef.current?.focus();
  }

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-3">
        {contactCards.map((card) => (
          <ContactCardButton card={card} key={card.topic} onSelect={openForm} />
        ))}
      </div>

      {isOpen ? (
        <div
          aria-labelledby={titleId}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 px-4 py-8"
          role="dialog"
        >
          <div className="w-full max-w-2xl rounded-lg border border-mit-line bg-background shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-mit-line px-5 py-4">
              <div>
                <p className="mb-1 text-xs font-bold tracking-widest text-primary-ink uppercase">
                  Contact MIT Sailing
                </p>
                <h2
                  className="font-mit-serif text-2xl font-semibold text-mit-text"
                  id={titleId}
                >
                  {selectedTopic}
                </h2>
              </div>
              <Button
                aria-label="Close contact form"
                onClick={closeForm}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X aria-hidden className="size-5" />
              </Button>
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
        </div>
      ) : null}
    </>
  );
}
