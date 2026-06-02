'use client';

import { EmailEditor } from '@react-email/editor';
import type { EmailEditorRef } from '@react-email/editor';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AdminEmailTemplateEditorText = Readonly<{
  bodyLabel: string;
  previewTextLabel: string;
  saveDraft: string;
  sendTest: string;
  subjectLabel: string;
  testEmailLabel: string;
}>;

type StoredDraft = Readonly<{
  content: string;
  previewText: string;
  subject: string;
}>;

type AdminEmailTemplateEditorProps = Readonly<{
  clearDraftOnMount?: boolean;
  content: string;
  previewText: string;
  saveAction: (formData: FormData) => Promise<void>;
  sendTestAction: (formData: FormData) => Promise<void>;
  subject: string;
  templateKey: string;
  testEmail: string;
  text: AdminEmailTemplateEditorText;
}>;

function draftStorageKey(templateKey: string) {
  return `admin-email-template-draft:${templateKey}`;
}

function storedDraft(value: string | null): StoredDraft | null {
  if (!value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof Reflect.get(parsed, 'content') === 'string' &&
      typeof Reflect.get(parsed, 'previewText') === 'string' &&
      typeof Reflect.get(parsed, 'subject') === 'string'
    ) {
      return {
        content: Reflect.get(parsed, 'content'),
        previewText: Reflect.get(parsed, 'previewText'),
        subject: Reflect.get(parsed, 'subject'),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function AdminEmailTemplateEditor(props: AdminEmailTemplateEditorProps) {
  const editorRef = useRef<EmailEditorRef>(null);
  const storageKey = draftStorageKey(props.templateKey);
  const [content, setContent] = useState(props.content);
  const [previewText, setPreviewText] = useState(props.previewText);
  const [subject, setSubject] = useState(props.subject);

  function currentEditorContent() {
    return editorRef.current?.editor?.getHTML() ?? content;
  }

  function persistDraft(next: Partial<StoredDraft>) {
    globalThis.localStorage.setItem(
      storageKey,
      JSON.stringify({
        content: next.content ?? currentEditorContent(),
        previewText: next.previewText ?? previewText,
        subject: next.subject ?? subject,
      })
    );
  }

  async function prepareFormData(formData: FormData) {
    const bodyHtml =
      (await editorRef.current?.getEmailHTML()) ?? currentEditorContent();
    const text = (await editorRef.current?.getEmailText()) ?? '';
    const json = editorRef.current?.getJSON() ?? null;
    formData.set('editorBodyHtml', bodyHtml);
    formData.set('renderedText', text);
    formData.set('editorJson', JSON.stringify(json));
  }

  useEffect(() => {
    if (props.clearDraftOnMount) {
      globalThis.localStorage.removeItem(storageKey);
      return;
    }

    const draft = storedDraft(globalThis.localStorage.getItem(storageKey));
    if (!draft) {
      return;
    }
    setContent(draft.content);
    setPreviewText(draft.previewText);
    setSubject(draft.subject);
  }, [props.clearDraftOnMount, storageKey]);

  return (
    <form
      action={async (formData) => {
        await prepareFormData(formData);
        await props.saveAction(formData);
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email-template-subject">
            {props.text.subjectLabel}
          </Label>
          <Input
            id="email-template-subject"
            name="subject"
            onChange={(event) => {
              setSubject(event.target.value);
              persistDraft({ subject: event.target.value });
            }}
            required
            value={subject}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email-template-preview-text">
            {props.text.previewTextLabel}
          </Label>
          <Input
            id="email-template-preview-text"
            name="previewText"
            onChange={(event) => {
              setPreviewText(event.target.value);
              persistDraft({ previewText: event.target.value });
            }}
            required
            value={previewText}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{props.text.bodyLabel}</Label>
        <div className="min-h-[420px] rounded-lg border border-border bg-card p-3">
          <EmailEditor
            content={content}
            key={content}
            onUpdate={(ref) => {
              persistDraft({ content: ref.editor?.getHTML() ?? content });
            }}
            ref={editorRef}
            theme="basic"
          />
        </div>
      </div>

      <input name="editorBodyHtml" type="hidden" />
      <input name="renderedText" type="hidden" />
      <input name="editorJson" type="hidden" />

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email-template-test-email">
            {props.text.testEmailLabel}
          </Label>
          <Input
            defaultValue={props.testEmail}
            id="email-template-test-email"
            name="email"
            type="email"
          />
        </div>
        <Button
          className="self-end"
          formAction={async (formData) => {
            await prepareFormData(formData);
            await props.sendTestAction(formData);
          }}
          type="submit"
          variant="outline"
        >
          {props.text.sendTest}
        </Button>
        <Button className="self-end" type="submit" variant="mit">
          {props.text.saveDraft}
        </Button>
      </div>
    </form>
  );
}
