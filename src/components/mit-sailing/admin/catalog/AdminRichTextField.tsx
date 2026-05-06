'use client';

import type { Editor } from 'ckeditor5';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { adminRichTextDefaultImageStyle } from '@/components/mit-sailing/admin/catalog/adminRichTextEditorConfig';
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

type MediaListPhase = 'idle' | 'loading' | 'loadingMore' | 'ready' | 'error';

async function loadAdminRichTextCkeditor() {
  const mod =
    await import('@/components/mit-sailing/admin/catalog/AdminRichTextCkeditor');
  return mod.AdminRichTextCkeditor;
}

const AdminRichTextCkeditor = dynamic(loadAdminRichTextCkeditor, {
  ssr: false,
  loading: () => (
    <div aria-hidden className="min-h-[60vh] animate-pulse bg-slate-100" />
  ),
});

/**
 * CKEditor rich text editor for catalog forms; syncs HTML to a hidden input
 * for native `FormData` submission.
 *
 * @param props - Field name, label, initial HTML, and DOM id
 * @returns Labeled editor with WordPress-style toolbar and media controls
 */
export function AdminRichTextField(props: AdminRichTextFieldProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<AdminUploadListItem[]>([]);
  const [mediaNextCursor, setMediaNextCursor] = useState<string | null>(null);
  const [mediaListPhase, setMediaListPhase] = useState<MediaListPhase>('idle');

  function syncHtml(html: string): void {
    if (hiddenRef.current) {
      hiddenRef.current.value = html;
    }
  }

  function insertImage(url: string, alt: string): void {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    editor.execute('insertImage', {
      source: { src: url, alt, imageStyle: adminRichTextDefaultImageStyle },
      imageType: 'imageBlock',
    });
    syncHtml(editor.getData());
  }

  function closeMediaLibrary(): void {
    setMediaLibraryOpen(false);
    setMediaListPhase('idle');
  }

  async function openMediaLibrary(): Promise<void> {
    if (!editorRef.current) {
      return;
    }
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
    insertImage(item.url, '');
    closeMediaLibrary();
  }

  return (
    <div className="flex w-full flex-col gap-2 text-sm">
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
      <div className="admin-rich-text-ckeditor overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm focus-within:border-mit-red focus-within:ring-2 focus-within:ring-mit-red/25">
        <AdminRichTextCkeditor
          fieldId={props.fieldId}
          initialHtml={props.initialHtml}
          onChangeHtml={syncHtml}
          onOpenMediaLibrary={openMediaLibrary}
          onReady={(editor) => {
            editorRef.current = editor;
          }}
          testId={`catalog-rich-text-${props.name}`}
        />
      </div>
      <AdminRichTextMediaLibraryModal
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
