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
import NextImage from 'next/image';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';

type CmsMediaAsset = {
  id: string;
  originalFilename: string;
  publicPath: string;
  createdAt: string;
};

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

function isAllowedEditorHref(href: string): boolean {
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

function isCmsMediaPath(value: string | undefined): value is string {
  return typeof value === 'string' && value.startsWith('/cms-media/');
}

function currentPageId(form: HTMLFormElement | null): string {
  if (!form) {
    return '';
  }
  const value = new FormData(form).get('pageId');
  return typeof value === 'string' ? value : '';
}

function stringField(value: unknown, field: string): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  return typeof descriptor?.value === 'string' ? descriptor.value : undefined;
}

function cmsMediaAssetFromUnknown(value: unknown): CmsMediaAsset | null {
  const id = stringField(value, 'id');
  const originalFilename = stringField(value, 'originalFilename');
  const publicPath = stringField(value, 'publicPath');
  const createdAt = stringField(value, 'createdAt');
  if (!id || !originalFilename || !publicPath || !createdAt) {
    return null;
  }
  return { createdAt, id, originalFilename, publicPath };
}

function cmsMediaAssetsFromUnknown(value: unknown): CmsMediaAsset[] {
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, 'assets');
  if (!Array.isArray(descriptor?.value)) {
    return [];
  }
  return descriptor.value.flatMap((item: unknown) => {
    const asset = cmsMediaAssetFromUnknown(item);
    return asset ? [asset] : [];
  });
}

function nodeStringAttribute(
  value: unknown,
  field: string
): string | undefined {
  return stringField(value, field);
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
      }),
    ],
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      setHtml(currentEditor.getHTML());
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
    setHtml(editor.getHTML());
    setPickerOpen(false);
  }

  async function loadAssets() {
    setMediaBusy(true);
    setMediaError(null);
    const response = await fetch('/api/admin/cms-media');
    if (!response.ok) {
      setMediaBusy(false);
      setMediaError(t('rich_text_media_error'));
      return;
    }
    const data: unknown = await response.json();
    setAssets(cmsMediaAssetsFromUnknown(data));
    setPickerOpen(true);
    setMediaBusy(false);
  }

  async function uploadImage(file: File) {
    setMediaBusy(true);
    setMediaError(null);
    const formData = new FormData();
    formData.set('file', file);
    const pageId = currentPageId(
      editorShellRef.current?.closest('form') ?? null
    );
    if (pageId) {
      formData.set('pageId', pageId);
    }
    const response = await fetch('/api/admin/cms-media', {
      body: formData,
      method: 'POST',
    });
    if (!response.ok) {
      setMediaBusy(false);
      setMediaError(t('rich_text_media_error'));
      return;
    }
    const data: unknown = await response.json();
    const publicPath =
      stringField(data, 'publicPath') ?? stringField(data, 'url');
    if (!isCmsMediaPath(publicPath)) {
      setMediaBusy(false);
      setMediaError(t('rich_text_media_error'));
      return;
    }
    insertCmsImage({
      createdAt: new Date().toISOString(),
      id: publicPath,
      originalFilename: stringField(data, 'originalFilename') ?? file.name,
      publicPath,
    });
    setMediaBusy(false);
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
    setHtml(editor.getHTML());
    setLinkEditorOpen(false);
  }

  function alignImage(align: 'left' | 'center' | 'right') {
    if (!editor) {
      return;
    }
    const hasSelectedImage = editor.isActive('image');
    if (hasSelectedImage) {
      editor.chain().focus().updateAttributes('image', { align }).run();
    } else if (lastImageSrc) {
      editor.commands.command(({ tr }) => {
        let imagePos: number | null = null;
        let imageAlt = '';
        let imageSrc = lastImageSrc;
        tr.doc.descendants((node, pos) => {
          const src = nodeStringAttribute(node.attrs, 'src');
          if (node.type.name !== 'image' || src !== lastImageSrc) {
            return true;
          }
          imagePos = pos;
          imageAlt = nodeStringAttribute(node.attrs, 'alt') ?? '';
          imageSrc = src;
          return false;
        });
        if (imagePos === null || !imageSrc) {
          return false;
        }
        tr.setNodeMarkup(imagePos, undefined, {
          align,
          alt: imageAlt,
          src: imageSrc,
        });
        return true;
      });
    }
    setHtml(editor.getHTML());
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
                setHtml(editor.getHTML());
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
                setHtml(editor.getHTML());
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
                setHtml(editor.getHTML());
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
                setHtml(editor.getHTML());
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
                setHtml(editor.getHTML());
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
        {pickerOpen ? (
          <div className="grid max-h-56 gap-2 overflow-y-auto border-b border-border bg-background p-2 sm:grid-cols-2">
            {assets.length > 0 ? (
              assets.map((asset) => (
                <button
                  className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card p-2 text-left text-sm text-card-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  key={asset.id}
                  onClick={() => {
                    insertCmsImage(asset);
                  }}
                  type="button"
                >
                  <NextImage
                    alt=""
                    className="size-12 rounded-sm object-cover"
                    height={48}
                    src={asset.publicPath}
                    width={48}
                  />
                  <span className="min-w-0 truncate">
                    {asset.originalFilename}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-2 py-4 text-sm text-muted-foreground">
                {t('rich_text_media_empty')}
              </p>
            )}
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
      {mediaError ? (
        <p className="text-xs text-destructive" role="alert">
          {mediaError}
        </p>
      ) : null}
    </div>
  );
}
