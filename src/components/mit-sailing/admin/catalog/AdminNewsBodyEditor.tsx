'use client';

import { Link as TiptapLink } from '@tiptap/extension-link';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Bold, Italic, Link, Unlink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { isAllowedEditorHref } from '@/components/mit-sailing/admin/catalog/AdminRichTextEditor';
import { AdminRichTextMarkButton } from '@/components/mit-sailing/admin/catalog/AdminRichTextMarkButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Module-scope so useEditor keeps a stable extensions identity across renders. */
const newsBodyExtensions = [
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
];

type NewsBodyEditorInstance = NonNullable<ReturnType<typeof useEditor>>;

function AdminNewsBodyToolbar(props: {
  disabled: boolean;
  editor: NewsBodyEditorInstance | null;
  onOpenLinkEditor: () => void;
}) {
  const t = useTranslations('AdminCatalogResource');
  const markState = useEditorState({
    editor: props.editor,
    selector: (ctx) => ({
      isBold: ctx.editor?.isActive('bold') ?? false,
      isItalic: ctx.editor?.isActive('italic') ?? false,
      isLink: ctx.editor?.isActive('link') ?? false,
    }),
  });

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-1.5">
      <AdminRichTextMarkButton
        active={markState?.isBold ?? false}
        disabled={props.disabled}
        Icon={Bold}
        label={t('rich_text_bold')}
        onClick={() => {
          props.editor?.chain().focus().toggleBold().run();
        }}
      />
      <AdminRichTextMarkButton
        active={markState?.isItalic ?? false}
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
        disabled={props.disabled || !(markState?.isLink ?? false)}
        Icon={Unlink}
        label={t('rich_text_unlink')}
        onClick={() => {
          props.editor
            ?.chain()
            .focus()
            .extendMarkRange('link')
            .unsetLink()
            .run();
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
  const [html, setHtml] = useState(props.defaultValue);
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkHref, setLinkHref] = useState('');
  const editorPropsRef = useRef({
    attributes: {} as Record<string, string>,
  });

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
  editorPropsRef.current.attributes = editorAttributes;

  const editor = useEditor({
    content: props.defaultValue || '<p></p>',
    editorProps: editorPropsRef.current,
    extensions: newsBodyExtensions,
    // Next.js SSR: avoid hydration mismatch (TipTap React / Next.js install guides)
    immediatelyRender: false,
    // TipTap v3 default; keep explicit so toolbar uses useEditorState instead of host re-renders
    shouldRerenderOnTransaction: false,
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
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setHtml(editor.getHTML());
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
