'use client';

import type { EmailEditorRef } from '@react-email/editor';
import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { AdminEmailEditorSurface } from '@/components/mit-sailing/admin/AdminEmailEditorSurface';
import { SubmitButton } from '@/components/ui/submit-button';

type AdminNewsletterBroadcastEditorText = Readonly<{
  bodyLabel: string;
  pendingQueueBroadcast: string;
  pendingSaveDraft: string;
  queueBroadcast: string;
  saveDraft: string;
}>;

type StoredDraft = Readonly<{
  body: string;
}>;

type AdminNewsletterBroadcastEditorProps = Readonly<{
  action: (formData: FormData) => Promise<void>;
  ariaDescribedBy?: string;
  children: React.ReactNode;
  initialBody: string;
  text: AdminNewsletterBroadcastEditorText;
}>;

const DRAFT_STORAGE_KEY = 'admin-newsletter-broadcast-draft';

function persistDraft(nextBody: string) {
  globalThis.localStorage.setItem(
    DRAFT_STORAGE_KEY,
    JSON.stringify({ body: nextBody })
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function storedDraft(value: string | null): StoredDraft | null {
  if (!value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) {
      return null;
    }
    const { body } = parsed;
    return typeof body === 'string' ? { body } : null;
  } catch {
    return null;
  }
}

export function AdminNewsletterBroadcastEditor(
  props: AdminNewsletterBroadcastEditorProps
) {
  const editorRef = useRef<EmailEditorRef>(null);
  const [body, setBody] = useState(props.initialBody);

  function currentBodyHtml() {
    return editorRef.current?.editor?.getHTML() ?? body;
  }

  async function prepareFormData(formData: FormData) {
    const bodyHtml = currentBodyHtml();
    const bodyText = (await editorRef.current?.getEmailText()) ?? '';
    const bodyJson = editorRef.current?.getJSON() ?? null;
    formData.set('body', bodyHtml);
    formData.set('bodyText', bodyText);
    formData.set('bodyJson', JSON.stringify(bodyJson));
  }

  useEffect(() => {
    const draft = storedDraft(
      globalThis.localStorage.getItem(DRAFT_STORAGE_KEY)
    );
    if (draft) {
      setBody(draft.body);
    }
  }, []);

  return (
    <form
      aria-describedby={props.ariaDescribedBy}
      action={async (formData) => {
        await prepareFormData(formData);
        await props.action(formData);
        globalThis.localStorage.removeItem(DRAFT_STORAGE_KEY);
      }}
      className="flex flex-col gap-5"
    >
      {props.children}
      <AdminEmailEditorSurface
        content={body}
        editorRef={editorRef}
        label={props.text.bodyLabel}
        onUpdate={(ref) => {
          const nextBody = ref.editor?.getHTML() ?? body;
          persistDraft(nextBody);
        }}
      />
      <input name="body" type="hidden" />
      <input name="bodyText" type="hidden" />
      <input name="bodyJson" type="hidden" />
      <div className="sticky bottom-0 z-20 grid gap-2 border-t border-border bg-background/95 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:static sm:flex sm:flex-wrap sm:justify-end sm:border-t-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <SubmitButton
          className="h-11 w-full sm:h-8 sm:w-auto"
          name="intent"
          pendingLabel={props.text.pendingSaveDraft}
          type="submit"
          value="draft"
          variant="outline"
        >
          {props.text.saveDraft}
        </SubmitButton>
        <SubmitButton
          className="h-11 w-full sm:h-8 sm:w-auto"
          name="intent"
          pendingLabel={props.text.pendingQueueBroadcast}
          type="submit"
          value="queue"
          variant="mit"
        >
          {props.text.queueBroadcast}
        </SubmitButton>
      </div>
    </form>
  );
}
