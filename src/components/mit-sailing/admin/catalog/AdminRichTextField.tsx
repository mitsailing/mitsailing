'use client';

import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import {
  Bold,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Images,
  Italic,
  Link2,
  List,
  ListOrdered,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { fetchAdminUploadListPage } from '@/components/mit-sailing/admin/catalog/adminRichTextMediaLibrary';
import type { AdminUploadListItem } from '@/components/mit-sailing/admin/catalog/adminRichTextMediaLibrary';
import { AdminRichTextMediaLibraryModal } from '@/components/mit-sailing/admin/catalog/AdminRichTextMediaLibraryModal';

type AdminRichTextFieldProps = {
  name: string;
  label: string;
  initialHtml: string;
  fieldId: string;
  required?: boolean;
};

const toolbarButtonClassName =
  'inline-flex size-8 items-center justify-center rounded border border-slate-200 bg-white text-mit-text hover:bg-mit-red-highlight focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:outline-none';
const toolbarButtonActiveClassName =
  'border-mit-red bg-mit-red-highlight ring-1 ring-mit-red/30';

function parseUploadJsonUrl(parsed: unknown): string | null {
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const url = Reflect.get(parsed, 'url');
  if (typeof url !== 'string') {
    return null;
  }
  return url;
}

async function postAdminImageUpload(file: File): Promise<string | null> {
  const body = new FormData();
  body.append('file', file);
  const idempotencyKey = crypto.randomUUID();
  const res = await fetch('/api/admin/uploads', {
    method: 'POST',
    body,
    credentials: 'include',
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
  if (!res.ok) {
    return null;
  }
  const parsed: unknown = await res.json();
  return parseUploadJsonUrl(parsed);
}

/**
 * Tiptap-based rich text editor for catalog forms; syncs HTML to a hidden input
 * for native `FormData` submission.
 *
 * @param props - Field name, label, initial HTML, and DOM id
 * @returns Labeled editor with toolbar and hidden input
 */
export function AdminRichTextField(props: AdminRichTextFieldProps) {
  const t = useTranslations('AdminRichText');
  const hiddenRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkHrefDraft, setLinkHrefDraft] = useState('');
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<AdminUploadListItem[]>([]);
  const [mediaNextCursor, setMediaNextCursor] = useState<string | null>(null);
  const [mediaListPhase, setMediaListPhase] = useState<
    'idle' | 'loading' | 'loadingMore' | 'ready' | 'error'
  >('idle');
  const mediaDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mediaLibraryOpen && mediaDialogRef.current) {
      mediaDialogRef.current.focus();
    }
  }, [mediaLibraryOpen]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        heading: { levels: [2, 3, 4] },
      }),
      Link.configure({
        autolink: true,
        openOnClick: false,
        defaultProtocol: 'https',
        HTMLAttributes: {
          class:
            'font-semibold text-mit-red underline decoration-mit-red/30 underline-offset-2 hover:decoration-mit-red',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: 'my-4 max-h-[420px] max-w-full rounded-lg object-contain',
        },
      }),
    ],
    content: props.initialHtml || '',
    editorProps: {
      attributes: {
        'data-testid': `catalog-rich-text-${props.name}`,
        id: props.fieldId,
        class:
          'max-w-none min-h-[120px] text-mit-text focus:outline-none [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:font-mit-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:font-mit-serif [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mt-4 [&_h4]:mb-1 [&_h4]:font-mit-serif [&_h4]:text-base [&_h4]:font-semibold [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_ul]:ml-6 [&_ol]:ml-6 [&_ul]:list-disc [&_ol]:list-decimal',
      },
    },
    onCreate: ({ editor: ed }) => {
      if (hiddenRef.current) {
        hiddenRef.current.value = ed.getHTML();
      }
    },
    onUpdate: ({ editor: ed }) => {
      if (hiddenRef.current) {
        hiddenRef.current.value = ed.getHTML();
      }
    },
  });

  async function onImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !editor) {
      return;
    }
    const url = await postAdminImageUpload(file);
    if (!url) {
      return;
    }
    editor.chain().focus().setImage({ src: url }).run();
  }

  function openLinkDialog(): void {
    if (!editor) {
      return;
    }
    setMediaLibraryOpen(false);
    const hrefRaw = editor.getAttributes('link').href;
    const previous =
      typeof hrefRaw === 'string' && hrefRaw.length > 0 ? hrefRaw : 'https://';
    setLinkHrefDraft(previous);
    setLinkDialogOpen(true);
  }

  function closeLinkDialog(): void {
    setLinkDialogOpen(false);
  }

  function applyLinkFromDialog(): void {
    if (!editor) {
      return;
    }
    const trimmed = linkHrefDraft.trim();
    if (trimmed.length === 0) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: trimmed })
        .run();
    }
    closeLinkDialog();
  }

  function removeLinkFromDialog(): void {
    if (!editor) {
      return;
    }
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    closeLinkDialog();
  }

  function onLinkDialogKeyDown(
    event: React.KeyboardEvent<HTMLDivElement>
  ): void {
    if (event.key === 'Escape') {
      closeLinkDialog();
    }
  }

  function closeMediaLibrary(): void {
    setMediaLibraryOpen(false);
    setMediaListPhase('idle');
  }

  async function openMediaLibrary(): Promise<void> {
    if (!editor) {
      return;
    }
    setLinkDialogOpen(false);
    setMediaLibraryOpen(true);
    setMediaItems([]);
    setMediaNextCursor(null);
    setMediaListPhase('loading');
    const page = await fetchAdminUploadListPage(null);
    if (!page) {
      setMediaListPhase('error');
      return;
    }
    setMediaItems(page.items);
    setMediaNextCursor(page.nextCursor);
    setMediaListPhase('ready');
  }

  async function loadMoreMediaLibrary(): Promise<void> {
    if (mediaNextCursor === null || mediaListPhase === 'loadingMore') {
      return;
    }
    const cursor = mediaNextCursor;
    setMediaListPhase('loadingMore');
    const page = await fetchAdminUploadListPage(cursor);
    if (!page) {
      setMediaListPhase('error');
      return;
    }
    setMediaItems((prev) => [...prev, ...page.items]);
    setMediaNextCursor(page.nextCursor);
    setMediaListPhase('ready');
  }

  function pickMediaImage(item: AdminUploadListItem): void {
    if (!editor) {
      return;
    }
    editor.chain().focus().setImage({ src: item.url, alt: '' }).run();
    closeMediaLibrary();
  }

  const dialogButtonClassName =
    'rounded-md px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:outline-none';

  return (
    <div className="flex max-w-2xl flex-col gap-2 text-sm">
      <label className="font-medium text-mit-text" htmlFor={props.fieldId}>
        {props.label}
      </label>
      <input
        defaultValue={props.initialHtml}
        name={props.name}
        readOnly
        ref={hiddenRef}
        required={props.required}
        type="hidden"
      />
      <input
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={onImageChange}
        ref={fileRef}
        tabIndex={-1}
        type="file"
      />
      <div
        aria-label={t('toolbar_label')}
        className="flex flex-wrap gap-1 rounded-md border border-slate-200 bg-slate-50 p-1"
        role="toolbar"
      >
        <button
          aria-label={t('toolbar_bold')}
          className={`${toolbarButtonClassName} ${editor?.isActive('bold') ? toolbarButtonActiveClassName : ''}`}
          disabled={!editor}
          onClick={() => {
            editor?.chain().focus().toggleBold().run();
          }}
          type="button"
        >
          <Bold aria-hidden size={16} />
        </button>
        <button
          aria-label={t('toolbar_italic')}
          className={`${toolbarButtonClassName} ${editor?.isActive('italic') ? toolbarButtonActiveClassName : ''}`}
          disabled={!editor}
          onClick={() => {
            editor?.chain().focus().toggleItalic().run();
          }}
          type="button"
        >
          <Italic aria-hidden size={16} />
        </button>
        <span aria-hidden className="mx-0.5 w-px self-stretch bg-slate-200" />
        <button
          aria-label={t('toolbar_heading_2')}
          className={`${toolbarButtonClassName} ${editor?.isActive('heading', { level: 2 }) ? toolbarButtonActiveClassName : ''}`}
          disabled={!editor}
          onClick={() => {
            editor?.chain().focus().toggleHeading({ level: 2 }).run();
          }}
          type="button"
        >
          <Heading2 aria-hidden size={16} />
        </button>
        <button
          aria-label={t('toolbar_heading_3')}
          className={`${toolbarButtonClassName} ${editor?.isActive('heading', { level: 3 }) ? toolbarButtonActiveClassName : ''}`}
          disabled={!editor}
          onClick={() => {
            editor?.chain().focus().toggleHeading({ level: 3 }).run();
          }}
          type="button"
        >
          <Heading3 aria-hidden size={16} />
        </button>
        <button
          aria-label={t('toolbar_heading_4')}
          className={`${toolbarButtonClassName} ${editor?.isActive('heading', { level: 4 }) ? toolbarButtonActiveClassName : ''}`}
          disabled={!editor}
          onClick={() => {
            editor?.chain().focus().toggleHeading({ level: 4 }).run();
          }}
          type="button"
        >
          <Heading4 aria-hidden size={16} />
        </button>
        <span aria-hidden className="mx-0.5 w-px self-stretch bg-slate-200" />
        <button
          aria-label={t('toolbar_bullet_list')}
          className={`${toolbarButtonClassName} ${editor?.isActive('bulletList') ? toolbarButtonActiveClassName : ''}`}
          disabled={!editor}
          onClick={() => {
            editor?.chain().focus().toggleBulletList().run();
          }}
          type="button"
        >
          <List aria-hidden size={16} />
        </button>
        <button
          aria-label={t('toolbar_ordered_list')}
          className={`${toolbarButtonClassName} ${editor?.isActive('orderedList') ? toolbarButtonActiveClassName : ''}`}
          disabled={!editor}
          onClick={() => {
            editor?.chain().focus().toggleOrderedList().run();
          }}
          type="button"
        >
          <ListOrdered aria-hidden size={16} />
        </button>
        <span aria-hidden className="mx-0.5 w-px self-stretch bg-slate-200" />
        <button
          aria-label={t('toolbar_link')}
          className={`${toolbarButtonClassName} ${editor?.isActive('link') ? toolbarButtonActiveClassName : ''}`}
          disabled={!editor}
          onClick={openLinkDialog}
          type="button"
        >
          <Link2 aria-hidden size={16} />
        </button>
        <button
          aria-label={t('toolbar_image')}
          className={toolbarButtonClassName}
          disabled={!editor}
          onClick={() => fileRef.current?.click()}
          type="button"
        >
          <ImagePlus aria-hidden size={16} />
        </button>
        <button
          aria-label={t('toolbar_media_library')}
          className={toolbarButtonClassName}
          disabled={!editor}
          onClick={openMediaLibrary}
          type="button"
        >
          <Images aria-hidden size={16} />
        </button>
      </div>
      <div className="rounded-md border border-slate-300 bg-white px-2 py-1 shadow-sm focus-within:border-mit-red focus-within:ring-2 focus-within:ring-mit-red/25">
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div
            aria-hidden
            className="min-h-[120px] animate-pulse rounded bg-slate-100"
          />
        )}
      </div>
      {linkDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeLinkDialog}
          onKeyDown={onLinkDialogKeyDown}
          role="presentation"
        >
          <div
            aria-labelledby={`${props.fieldId}-link-dialog-title`}
            aria-modal
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
            onClick={(event) => {
              event.stopPropagation();
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
            }}
            role="dialog"
            tabIndex={-1}
          >
            <h3
              className="mb-3 font-semibold text-mit-text"
              id={`${props.fieldId}-link-dialog-title`}
            >
              {t('link_dialog_title')}
            </h3>
            <label className="flex flex-col gap-1 text-sm text-mit-text">
              <span className="font-medium">{t('link_href_label')}</span>
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-mit-text shadow-sm focus-visible:border-mit-red focus-visible:ring-2 focus-visible:ring-mit-red/25 focus-visible:outline-none"
                onChange={(event) => {
                  setLinkHrefDraft(event.target.value);
                }}
                type="url"
                value={linkHrefDraft}
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={`${dialogButtonClassName} bg-mit-red text-white hover:bg-mit-red-hover`}
                onClick={applyLinkFromDialog}
                type="button"
              >
                {t('link_apply')}
              </button>
              <button
                className={`${dialogButtonClassName} border border-slate-300 bg-white hover:bg-mit-red-highlight`}
                onClick={removeLinkFromDialog}
                type="button"
              >
                {t('link_remove')}
              </button>
              <button
                className={`${dialogButtonClassName} border border-slate-300 bg-white hover:bg-mit-red-highlight`}
                onClick={closeLinkDialog}
                type="button"
              >
                {t('link_cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <AdminRichTextMediaLibraryModal
        dialogRef={mediaDialogRef}
        fieldId={props.fieldId}
        items={mediaItems}
        nextCursor={mediaNextCursor}
        onClose={closeMediaLibrary}
        onLoadMore={loadMoreMediaLibrary}
        onPick={pickMediaImage}
        open={mediaLibraryOpen}
        phase={mediaListPhase}
      />
    </div>
  );
}
