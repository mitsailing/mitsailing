'use client';

import { Link as TiptapLink } from '@tiptap/extension-link';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Bold, Italic, Link, Unlink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { isAllowedEditorHref } from '@/components/mit-sailing/admin/catalog/AdminRichTextEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Limited TipTap body editor for news: paragraphs, bold, italic, and links.
 * Enter starts a new paragraph; Shift+Enter inserts a line break.
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
  const t = useTranslations('AdminCatalogResource');
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
    content: props.defaultValue || '<p></p>',
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
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-1.5">
          <Button
            aria-label={t('rich_text_bold')}
            aria-pressed={editor?.isActive('bold') ?? false}
            disabled={disabled}
            onClick={() => {
              editor?.chain().focus().toggleBold().run();
            }}
            size="icon"
            title={t('rich_text_bold')}
            type="button"
            variant={editor?.isActive('bold') ? 'secondary' : 'ghost'}
          >
            <Bold aria-hidden />
          </Button>
          <Button
            aria-label={t('rich_text_italic')}
            aria-pressed={editor?.isActive('italic') ?? false}
            disabled={disabled}
            onClick={() => {
              editor?.chain().focus().toggleItalic().run();
            }}
            size="icon"
            title={t('rich_text_italic')}
            type="button"
            variant={editor?.isActive('italic') ? 'secondary' : 'ghost'}
          >
            <Italic aria-hidden />
          </Button>
          <Button
            aria-label={t('rich_text_link')}
            disabled={disabled}
            onClick={openLinkEditor}
            size="icon"
            title={t('rich_text_link')}
            type="button"
            variant="ghost"
          >
            <Link aria-hidden />
          </Button>
          <Button
            aria-label={t('rich_text_unlink')}
            disabled={disabled || !editor?.isActive('link')}
            onClick={() => {
              editor?.chain().focus().unsetLink().run();
            }}
            size="icon"
            title={t('rich_text_unlink')}
            type="button"
            variant="ghost"
          >
            <Unlink aria-hidden />
          </Button>
        </div>
        {linkEditorOpen ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background p-2">
            <Input
              aria-label={t('rich_text_link_url')}
              className="max-w-sm"
              onChange={(event) => {
                setLinkHref(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyLink();
                }
              }}
              type="url"
              value={linkHref}
            />
            <Button
              disabled={disabled}
              onClick={applyLink}
              type="button"
              variant="outline"
            >
              {t('rich_text_apply_link')}
            </Button>
          </div>
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
