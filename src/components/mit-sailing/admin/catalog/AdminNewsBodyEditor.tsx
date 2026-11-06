'use client';

import { Link as TiptapLink } from '@tiptap/extension-link';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Bold, Italic, Link, Unlink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { isAllowedEditorHref } from '@/components/mit-sailing/admin/catalog/AdminRichTextEditor';
import { AdminRichTextMarkButton } from '@/components/mit-sailing/admin/catalog/AdminRichTextMarkButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { newsBodyEditorHtml } from '@/libs/mit-sailing/newsBodyEditorHtml';

type NewsBodyEditorInstance = NonNullable<ReturnType<typeof useEditor>>;

function AdminNewsBodyToolbar(props: {
  disabled: boolean;
  editor: NewsBodyEditorInstance | null;
  onOpenLinkEditor: () => void;
}) {
  const t = useTranslations('AdminCatalogResource');

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-1.5">
      <AdminRichTextMarkButton
        active={props.editor?.isActive('bold') ?? false}
        disabled={props.disabled}
        Icon={Bold}
        label={t('rich_text_bold')}
        onClick={() => {
          props.editor?.chain().focus().toggleBold().run();
        }}
      />
      <AdminRichTextMarkButton
        active={props.editor?.isActive('italic') ?? false}
        disabled={props.disabled}
        Icon={Italic}
        label={t('rich_text_italic')}
        onClick={() => {
          props.editor?.chain().focus().toggleItalic().run();
        }}
      />
      <AdminRichTextMarkButton
        disabled={props.disabled}
        Icon={Link}
        label={t('rich_text_link')}
        onClick={props.onOpenLinkEditor}
      />
      <AdminRichTextMarkButton
        disabled={props.disabled || !props.editor?.isActive('link')}
        Icon={Unlink}
        label={t('rich_text_unlink')}
        onClick={() => {
          props.editor?.chain().focus().unsetLink().run();
        }}
      />
    </div>
  );
}

function AdminNewsBodyLinkRow(props: {
  disabled: boolean;
  linkHref: string;
  onApply: () => void;
  onHrefChange: (value: string) => void;
}) {
  const t = useTranslations('AdminCatalogResource');

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background p-2">
      <Input
        aria-label={t('rich_text_link_url')}
        className="max-w-sm"
        onChange={(event) => {
          props.onHrefChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            props.onApply();
          }
        }}
        type="url"
        value={props.linkHref}
      />
      <Button
        disabled={props.disabled}
        onClick={props.onApply}
        type="button"
        variant="outline"
      >
        {t('rich_text_apply_link')}
      </Button>
    </div>
  );
}

/**
 * Limited TipTap body editor for news: paragraphs, bold, italic, and links.
 * Legacy plain-text newlines load as hard breaks. Enter starts a new
 * paragraph; Shift+Enter inserts a line break.
 *
 * @param props - Field wiring for the catalog form
 * @returns Labeled editor with a small toolbar and hidden HTML input
 */
export function AdminNewsBodyEditor(props: {
  defaultValue: string;
  errorId?: string;
  errorMessage?: string | null;
  fieldId: string;
  fieldKey: string;
  label: string;
  onChange?: (value: string) => void;
  required?: boolean;
}) {
  const [html, setHtml] = useState(props.defaultValue);
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkHref, setLinkHref] = useState('');

  const editorAttributes: Record<string, string> = {
    'aria-label': props.label,
    'aria-multiline': 'true',
    class:
      'cms-rich-text min-h-[160px] px-3 py-3 outline-none focus-visible:ring-0',
    role: 'textbox',
  };
  if (props.errorMessage && props.errorId) {
    editorAttributes['aria-describedby'] = props.errorId;
    editorAttributes['aria-invalid'] = 'true';
  }

  const editor = useEditor({
    content: newsBodyEditorHtml(props.defaultValue),
    editorProps: {
      attributes: editorAttributes,
    },
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        link: false,
        orderedList: false,
        strike: false,
      }),
      TiptapLink.configure({
        autolink: false,
        openOnClick: false,
        protocols: ['http', 'https', 'mailto'],
      }),
    ],
    // Next.js SSR: avoid hydration mismatch (TipTap React install guide)
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      const nextHtml = currentEditor.getHTML();
      setHtml(nextHtml);
      props.onChange?.(nextHtml);
    },
  });

  function openLinkEditor() {
    if (!editor) {
      return;
    }
    const currentHref = editor.getAttributes('link').href;
    setLinkHref(typeof currentHref === 'string' ? currentHref : '');
    setLinkEditorOpen(true);
  }

  function applyLink() {
    if (!editor) {
      return;
    }
    const trimmed = linkHref.trim();
    if (!isAllowedEditorHref(trimmed)) {
      editor.chain().focus().unsetLink().run();
      setLinkEditorOpen(false);
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: trimmed })
      .run();
    setLinkEditorOpen(false);
  }

  const disabled = !editor;

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <Label className="text-foreground" htmlFor={props.fieldId}>
        {props.label}
      </Label>
      <div className="overflow-hidden rounded-lg border border-input bg-background text-foreground shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input-background dark:contrast-more:border-white">
        <AdminNewsBodyToolbar
          disabled={disabled}
          editor={editor}
          onOpenLinkEditor={openLinkEditor}
        />
        {linkEditorOpen ? (
          <AdminNewsBodyLinkRow
            disabled={disabled}
            linkHref={linkHref}
            onApply={applyLink}
            onHrefChange={setLinkHref}
          />
        ) : null}
        <EditorContent editor={editor} id={props.fieldId} />
      </div>
      <input
        name={props.fieldKey}
        required={props.required}
        type="hidden"
        value={html}
      />
      {props.errorMessage ? (
        <p className="text-sm text-destructive" id={props.errorId} role="alert">
          {props.errorMessage}
        </p>
      ) : null}
    </div>
  );
}
