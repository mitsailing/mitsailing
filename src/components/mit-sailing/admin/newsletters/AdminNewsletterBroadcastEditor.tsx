'use client';

import { EmailEditor } from '@react-email/editor';
import type { EmailEditorRef } from '@react-email/editor';
import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { AdminEmailEditorToolbar } from '@/components/mit-sailing/admin/email-templates/AdminEmailEditorToolbar';
import type { AdminEmailEditorToolbarText } from '@/components/mit-sailing/admin/email-templates/AdminEmailEditorToolbar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

type AdminNewsletterBroadcastEditorText = Readonly<{
  bodyLabel: string;
  queueBroadcast: string;
  saveDraft: string;
}> &
  AdminEmailEditorToolbarText;

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
      className="space-y-5 rounded-lg border border-border bg-card p-5"
    >
      {props.children}
      <div className="flex flex-col gap-1.5">
        <Label>{props.text.bodyLabel}</Label>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <AdminEmailEditorToolbar editorRef={editorRef} text={props.text} />
          <div className="min-h-[420px] p-3">
            <EmailEditor
              content={body}
              key={body}
              onUpdate={(ref) => {
                const nextBody = ref.editor?.getHTML() ?? body;
                persistDraft(nextBody);
              }}
              ref={editorRef}
              theme="basic"
            />
          </div>
        </div>
      </div>
      <input name="body" type="hidden" />
      <input name="bodyText" type="hidden" />
      <input name="bodyJson" type="hidden" />
      <div className="flex flex-wrap gap-2">
        <Button name="intent" type="submit" value="draft" variant="outline">
          {props.text.saveDraft}
        </Button>
        <Button name="intent" type="submit" value="queue" variant="mit">
          {props.text.queueBroadcast}
        </Button>
      </div>
    </form>
  );
}
