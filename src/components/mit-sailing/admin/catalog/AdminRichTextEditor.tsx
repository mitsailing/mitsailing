'use client';

import { Image as TiptapImage } from '@tiptap/extension-image';
import { Link as TiptapLink } from '@tiptap/extension-link';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ImageIcon,
  Italic,
  Link,
  List,
  ListOrdered,
  Upload,
  Unlink,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import {
  AdminCmsMediaPickerPanel,
  currentPageId,
  isCmsMediaPath,
  loadCmsMediaAssets,
  stringField,
  uploadCmsMediaFile,
} from '@/components/mit-sailing/admin/catalog/AdminCmsMediaControls';
import type { CmsMediaAsset } from '@/components/mit-sailing/admin/catalog/AdminCmsMediaControls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';

export {
  cmsMediaAssetFromUnknown,
  cmsMediaAssetsFromUnknown,
  currentPageId,
  isCmsMediaPath,
  stringField,
} from '@/components/mit-sailing/admin/catalog/AdminCmsMediaControls';

const imageWidthOptions = [
  { value: 'reset', translationKey: 'rich_text_image_size_original' },
  { value: '320', translationKey: 'rich_text_image_size_small' },
  { value: '480', translationKey: 'rich_text_image_size_medium' },
  { value: '640', translationKey: 'rich_text_image_size_large' },
  { value: '960', translationKey: 'rich_text_image_size_full' },
] as const;

const CmsEditorImage = TiptapImage.extend({
  addAttributes() {
    const parentAttributes = this.parent?.() ?? {};
    return {
      ...parentAttributes,
      align: {
        default: 'center',
        parseHTML: (element: HTMLElement) => {
          const { align } = element.dataset;
          return align === 'left' || align === 'right' ? align : 'center';
        },
        renderHTML: (attributes: { align?: string }) => ({
          'data-align':
            attributes.align === 'left' || attributes.align === 'right'
              ? attributes.align
              : 'center',
        }),
      },
    };
  },
});

export function isAllowedEditorHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  const jsScheme = `${['java', 'script'].join('')}:`;
  const vbScheme = `${['vb', 'script'].join('')}:`;
  if (
    lower.startsWith(jsScheme) ||
    lower.startsWith(vbScheme) ||
    lower.startsWith('data:')
  ) {
    return false;
  }
  if (trimmed === '#') {
    return true;
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }
  return (
    lower.startsWith('https://') ||
    lower.startsWith('http://') ||
    lower.startsWith('mailto:')
  );
}

export function nodeStringAttribute(
  value: unknown,
  field: string
): string | undefined {
  return stringField(value, field);
}

export function nodeNumberAttribute(
  value: unknown,
  field: string
): number | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  return typeof descriptor?.value === 'number' ? descriptor.value : undefined;
}

function imageWidthSelectValue(
  editor: NonNullable<ReturnType<typeof useEditor>>
): string {
  const width = nodeNumberAttribute(editor.getAttributes('image'), 'width');
  return width ? String(width) : 'reset';
}

function activeBlockKind(editor: NonNullable<ReturnType<typeof useEditor>>) {
  if (editor.isActive('heading', { level: 2 })) {
    return 'h2';
  }
  if (editor.isActive('heading', { level: 3 })) {
    return 'h3';
  }
  if (editor.isActive('heading', { level: 4 })) {
    return 'h4';
  }
  return 'paragraph';
}

export function AdminRichTextEditor(props: {
  defaultValue: string;
  fieldId: string;
  fieldKey: string;
  label: string;
  onChange?: (value: string) => void;
  required?: boolean;
}) {
  const t = useTranslations('AdminCatalogResource');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorShellRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(props.defaultValue);
  const [assets, setAssets] = useState<CmsMediaAsset[]>([]);
  const [lastImageSrc, setLastImageSrc] = useState<string | null>(null);
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkHref, setLinkHref] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [uploadingFilename, setUploadingFilename] = useState<string | null>(
    null
  );
  const [, setToolbarRevision] = useState(0);

  function syncEditorState(
    currentEditor: NonNullable<ReturnType<typeof useEditor>>
  ) {
    const nextHtml = currentEditor.getHTML();
    setHtml(nextHtml);
    props.onChange?.(nextHtml);
    setToolbarRevision((revision) => revision + 1);
  }

  const editor = useEditor({
    content: props.defaultValue || '<p></p>',
    editorProps: {
      attributes: {
        'aria-label': props.label,
        class:
          'cms-rich-text min-h-[220px] px-3 py-3 outline-none focus-visible:ring-0',
      },
    },
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: { levels: [2, 3, 4] },
        horizontalRule: false,
        link: false,
        strike: false,
      }),
      TiptapLink.configure({
        autolink: false,
        openOnClick: false,
        protocols: ['http', 'https', 'mailto'],
      }),
      CmsEditorImage.configure({
        allowBase64: false,
        inline: false,
        resize: {
          alwaysPreserveAspectRatio: true,
          directions: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
          enabled: true,
          minHeight: 80,
          minWidth: 120,
        },
      }),
    ],
    immediatelyRender: false,
    onSelectionUpdate: ({ editor: currentEditor }) => {
      const selectedImageSrc = nodeStringAttribute(
        currentEditor.getAttributes('image'),
        'src'
      );
      if (selectedImageSrc) {
        setLastImageSrc(selectedImageSrc);
      }
      setToolbarRevision((revision) => revision + 1);
    },
    onUpdate: ({ editor: currentEditor }) => {
      syncEditorState(currentEditor);
    },
  });

  function insertCmsImage(asset: CmsMediaAsset) {
    if (!editor) {
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        attrs: {
          align: 'center',
          alt: asset.originalFilename,
          src: asset.publicPath,
        },
        type: 'image',
      })
      .run();
    setLastImageSrc(asset.publicPath);
    syncEditorState(editor);
    setPickerOpen(false);
  }

  async function loadAssets() {
    setMediaBusy(true);
    setMediaError(null);
    const loadedAssets = await loadCmsMediaAssets();
    if (!loadedAssets) {
      setMediaBusy(false);
      setMediaError(t('rich_text_media_error'));
      return;
    }
    setAssets(loadedAssets);
    setPickerOpen(true);
    setMediaBusy(false);
  }

  async function uploadImage(file: File) {
    setMediaBusy(true);
    setMediaError(null);
    setUploadingFilename(file.name);
    try {
      const pageId = currentPageId(
        editorShellRef.current?.closest('form') ?? null
      );
      const asset = await uploadCmsMediaFile({ file, pageId });
      if (!asset || !isCmsMediaPath(asset.publicPath)) {
        setMediaError(t('rich_text_media_error'));
        return;
      }
      insertCmsImage(asset);
    } finally {
      setMediaBusy(false);
      setUploadingFilename(null);
    }
  }

  function handleMediaFailure() {
    setMediaBusy(false);
    setMediaError(t('rich_text_media_error'));
  }

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
      syncEditorState(editor);
      setLinkEditorOpen(false);
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: trimmed })
      .run();
    syncEditorState(editor);
    setLinkEditorOpen(false);
  }

  function updateLastImageAttributes(
    attributes: Record<string, number | string | null>
  ) {
    if (!editor) {
      return;
    }
    editor.commands.command(({ tr }) => {
      let updated = false;
      tr.doc.descendants((node, pos) => {
        const src = nodeStringAttribute(node.attrs, 'src');
        if (node.type.name !== 'image' || src !== lastImageSrc) {
          return true;
        }
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attributes });
        updated = true;
        return false;
      });
      return updated;
    });
  }

  function updateImageAttributes(
    attributes: Record<string, number | string | null>
  ) {
    if (!editor) {
      return;
    }
    if (editor.isActive('image')) {
      editor.chain().focus().updateAttributes('image', attributes).run();
    } else if (lastImageSrc) {
      updateLastImageAttributes(attributes);
    }
    syncEditorState(editor);
  }

  function alignImage(align: 'left' | 'center' | 'right') {
    updateImageAttributes({ align });
  }

  function resizeImage(width: number | null) {
    updateImageAttributes({ height: null, width });
  }

  function selectImageWidth(value: string) {
    if (value === 'reset') {
      resizeImage(null);
      return;
    }
    const width = Number.parseInt(value, 10);
    if (Number.isFinite(width)) {
      resizeImage(width);
    }
  }

  const disabled = !editor;

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <Label className="text-foreground" htmlFor={props.fieldId}>
        {props.label}
      </Label>
      <div
        className="overflow-hidden rounded-lg border border-input bg-background text-foreground shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/20"
        ref={editorShellRef}
      >
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/50 p-1.5 dark:bg-muted/30">
          <select
            aria-label={t('rich_text_block_style')}
            className={`${adminNativeSelectClassName} h-8 w-auto min-w-[9rem]`}
            disabled={disabled}
            onChange={(event) => {
              if (!editor) {
                return;
              }
              if (event.target.value === 'paragraph') {
                editor.chain().focus().setParagraph().run();
                return;
              }
              const level = Number.parseInt(event.target.value.slice(1), 10);
              if (level === 2 || level === 3 || level === 4) {
                editor.chain().focus().toggleHeading({ level }).run();
              }
            }}
            value={editor ? activeBlockKind(editor) : 'paragraph'}
          >
            <option value="paragraph">{t('rich_text_paragraph')}</option>
            <option value="h2">{t('rich_text_heading_2')}</option>
            <option value="h3">{t('rich_text_heading_3')}</option>
            <option value="h4">{t('rich_text_heading_4')}</option>
          </select>
          <Button
            aria-label={t('rich_text_bold')}
            disabled={disabled}
            onClick={() => {
              editor?.chain().focus().toggleBold().run();
              if (editor) {
                syncEditorState(editor);
              }
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
            disabled={disabled}
            onClick={() => {
              editor?.chain().focus().toggleItalic().run();
              if (editor) {
                syncEditorState(editor);
              }
            }}
            size="icon"
            title={t('rich_text_italic')}
            type="button"
            variant={editor?.isActive('italic') ? 'secondary' : 'ghost'}
          >
            <Italic aria-hidden />
          </Button>
          <Button
            aria-label={t('rich_text_bullet_list')}
            disabled={disabled}
            onClick={() => {
              editor?.chain().focus().toggleBulletList().run();
              if (editor) {
                syncEditorState(editor);
              }
            }}
            size="icon"
            title={t('rich_text_bullet_list')}
            type="button"
            variant={editor?.isActive('bulletList') ? 'secondary' : 'ghost'}
          >
            <List aria-hidden />
          </Button>
          <Button
            aria-label={t('rich_text_ordered_list')}
            disabled={disabled}
            onClick={() => {
              editor?.chain().focus().toggleOrderedList().run();
              if (editor) {
                syncEditorState(editor);
              }
            }}
            size="icon"
            title={t('rich_text_ordered_list')}
            type="button"
            variant={editor?.isActive('orderedList') ? 'secondary' : 'ghost'}
          >
            <ListOrdered aria-hidden />
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
            disabled={disabled}
            onClick={() => {
              editor?.chain().focus().unsetLink().run();
              if (editor) {
                syncEditorState(editor);
              }
            }}
            size="icon"
            title={t('rich_text_unlink')}
            type="button"
            variant="ghost"
          >
            <Unlink aria-hidden />
          </Button>
          <Button
            aria-label={t('rich_text_upload_image')}
            disabled={disabled || mediaBusy}
            onClick={() => fileInputRef.current?.click()}
            size="icon"
            title={t('rich_text_upload_image')}
            type="button"
            variant="ghost"
          >
            <Upload aria-hidden />
          </Button>
          <Button
            aria-expanded={pickerOpen}
            aria-label={t('rich_text_select_image')}
            disabled={disabled || mediaBusy}
            onClick={async () => {
              if (pickerOpen) {
                setPickerOpen(false);
                return;
              }
              try {
                await loadAssets();
              } catch {
                handleMediaFailure();
              }
            }}
            size="icon"
            title={t('rich_text_select_image')}
            type="button"
            variant="ghost"
          >
            <ImageIcon aria-hidden />
          </Button>
          <Button
            aria-label={t('rich_text_align_left')}
            disabled={disabled}
            onClick={() => {
              alignImage('left');
            }}
            size="icon"
            title={t('rich_text_align_left')}
            type="button"
            variant="ghost"
          >
            <AlignLeft aria-hidden />
          </Button>
          <Button
            aria-label={t('rich_text_align_center')}
            disabled={disabled}
            onClick={() => {
              alignImage('center');
            }}
            size="icon"
            title={t('rich_text_align_center')}
            type="button"
            variant="ghost"
          >
            <AlignCenter aria-hidden />
          </Button>
          <Button
            aria-label={t('rich_text_align_right')}
            disabled={disabled}
            onClick={() => {
              alignImage('right');
            }}
            size="icon"
            title={t('rich_text_align_right')}
            type="button"
            variant="ghost"
          >
            <AlignRight aria-hidden />
          </Button>
          <select
            aria-label={t('rich_text_image_size')}
            className={`${adminNativeSelectClassName} h-8 w-auto min-w-[8.5rem]`}
            disabled={disabled}
            onChange={(event) => {
              selectImageWidth(event.target.value);
            }}
            value={editor ? imageWidthSelectValue(editor) : 'reset'}
          >
            {imageWidthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.translationKey)}
              </option>
            ))}
          </select>
          <input
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = '';
              if (file) {
                try {
                  await uploadImage(file);
                } catch {
                  handleMediaFailure();
                }
              }
            }}
            ref={fileInputRef}
            type="file"
          />
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
        {uploadingFilename ? (
          <div
            aria-live="polite"
            className="flex min-w-0 items-center gap-2 border-b border-border bg-background px-3 py-2 text-sm text-muted-foreground"
            role="status"
          >
            <span
              aria-hidden
              className="size-4 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
            />
            <span className="min-w-0 truncate">
              {t('rich_text_uploading_image', { filename: uploadingFilename })}
            </span>
          </div>
        ) : null}
        {pickerOpen ? (
          <AdminCmsMediaPickerPanel assets={assets} onSelect={insertCmsImage} />
        ) : null}
        <EditorContent editor={editor} id={props.fieldId} />
      </div>
      <input
        name={props.fieldKey}
        required={props.required}
        type="hidden"
        value={html}
      />
      {mediaError ? (
        <p className="text-xs text-destructive" role="alert">
          {mediaError}
        </p>
      ) : null}
    </div>
  );
}
