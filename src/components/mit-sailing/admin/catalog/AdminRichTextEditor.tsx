'use client';

import { Image as TiptapImage } from '@tiptap/extension-image';
import { Link as TiptapLink } from '@tiptap/extension-link';
import { NodeSelection } from '@tiptap/pm/state';
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
import type { RefObject } from 'react';
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

type RichTextEditorInstance = NonNullable<ReturnType<typeof useEditor>>;
type SyncRichTextEditorState = (editor: RichTextEditorInstance) => void;

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

function selectedImagePosition(editor: RichTextEditorInstance): number | null {
  const { selection } = editor.state;
  if (
    selection instanceof NodeSelection &&
    selection.node.type.name === 'image'
  ) {
    return selection.from;
  }
  return null;
}

function imageWidthSelectValue(
  editor: RichTextEditorInstance,
  lastImagePos: number | null
): string {
  const imagePos = selectedImagePosition(editor) ?? lastImagePos;
  const node = imagePos === null ? null : editor.state.doc.nodeAt(imagePos);
  const width =
    node?.type.name === 'image'
      ? nodeNumberAttribute(node.attrs, 'width')
      : nodeNumberAttribute(editor.getAttributes('image'), 'width');
  return width ? String(width) : 'reset';
}

function activeBlockKind(editor: RichTextEditorInstance) {
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

function imageAlignmentAt(
  editor: RichTextEditorInstance,
  imagePos: number | null
): 'left' | 'center' | 'right' | null {
  const node = imagePos === null ? null : editor.state.doc.nodeAt(imagePos);
  if (node?.type.name !== 'image') {
    return null;
  }
  const align = nodeStringAttribute(node.attrs, 'align');
  if (align === 'left' || align === 'right') {
    return align;
  }
  return 'center';
}

function activeImageAlignment(
  editor: RichTextEditorInstance,
  lastImagePos: number | null
): 'left' | 'center' | 'right' | null {
  return (
    imageAlignmentAt(editor, selectedImagePosition(editor)) ??
    imageAlignmentAt(editor, lastImagePos)
  );
}

function findInsertedImagePosition(props: {
  editor: RichTextEditorInstance;
  from: number;
  src: string;
}): number | null {
  let firstMatchAtOrAfterSelection: number | null = null;
  let lastMatch: number | null = null;
  props.editor.state.doc.descendants((node, pos) => {
    if (
      node.type.name === 'image' &&
      nodeStringAttribute(node.attrs, 'src') === props.src
    ) {
      if (pos >= props.from && firstMatchAtOrAfterSelection === null) {
        firstMatchAtOrAfterSelection = pos;
      }
      lastMatch = pos;
    }
    return true;
  });
  return firstMatchAtOrAfterSelection ?? lastMatch;
}

function editorAttributes(props: {
  errorId?: string;
  errorMessage?: string | null;
  label: string;
}): Record<string, string> {
  const attributes: Record<string, string> = {
    'aria-label': props.label,
    class:
      'cms-rich-text min-h-[220px] px-3 py-3 outline-none focus-visible:ring-0',
  };
  if (props.errorMessage && props.errorId) {
    attributes['aria-describedby'] = props.errorId;
    attributes['aria-invalid'] = 'true';
  }
  return attributes;
}

function updateImageAttributesAtPosition(props: {
  attributes: Record<string, number | string | null>;
  editor: RichTextEditorInstance;
  imagePos: number;
}): boolean {
  return props.editor.commands.command(({ tr }) => {
    const node = tr.doc.nodeAt(props.imagePos);
    if (node?.type.name !== 'image') {
      return false;
    }
    tr.setNodeMarkup(props.imagePos, undefined, {
      ...node.attrs,
      ...props.attributes,
    });
    return true;
  });
}

function activeImageAlignmentFor(
  editor: RichTextEditorInstance | null,
  lastImagePos: number | null
): 'left' | 'center' | 'right' | null {
  return editor ? activeImageAlignment(editor, lastImagePos) : null;
}

function selectEditorBlockStyle(
  editor: RichTextEditorInstance | null,
  value: string
) {
  if (!editor) {
    return;
  }
  if (value === 'paragraph') {
    editor.chain().focus().setParagraph().run();
    return;
  }
  const level = Number.parseInt(value.slice(1), 10);
  if (level === 2 || level === 3 || level === 4) {
    editor.chain().focus().toggleHeading({ level }).run();
  }
}

function mutateEditor(props: {
  editor: RichTextEditorInstance | null;
  mutate: (editor: RichTextEditorInstance) => void;
  syncEditorState: SyncRichTextEditorState;
}) {
  if (!props.editor) {
    return;
  }
  props.mutate(props.editor);
  props.syncEditorState(props.editor);
}

function selectImageWidthValue(
  value: string,
  resizeImage: (width: number | null) => void
) {
  if (value === 'reset') {
    resizeImage(null);
    return;
  }
  const width = Number.parseInt(value, 10);
  if (Number.isFinite(width)) {
    resizeImage(width);
  }
}

async function toggleMediaPicker(props: {
  loadAssets: () => Promise<void>;
  pickerOpen: boolean;
  setPickerOpen: (next: boolean) => void;
}) {
  if (props.pickerOpen) {
    props.setPickerOpen(false);
    return;
  }
  await props.loadAssets();
}

async function handleFileInputChange(props: {
  event: React.ChangeEvent<HTMLInputElement>;
  handleMediaFailure: () => void;
  uploadImage: (file: File) => Promise<void>;
}) {
  const file = props.event.target.files?.[0];
  props.event.currentTarget.value = '';
  if (!file) {
    return;
  }
  try {
    await props.uploadImage(file);
  } catch {
    props.handleMediaFailure();
  }
}

function AdminRichTextFormatControls(props: {
  disabled: boolean;
  editor: RichTextEditorInstance | null;
  onOpenLinkEditor: () => void;
  syncEditorState: SyncRichTextEditorState;
}) {
  const t = useTranslations('AdminCatalogResource');
  const handleOpenLinkEditor = props.onOpenLinkEditor;

  return (
    <>
      <Button
        aria-label={t('rich_text_bold')}
        aria-pressed={props.editor?.isActive('bold') ?? false}
        disabled={props.disabled}
        onClick={() => {
          mutateEditor({
            editor: props.editor,
            mutate: (currentEditor) => {
              currentEditor.chain().focus().toggleBold().run();
            },
            syncEditorState: props.syncEditorState,
          });
        }}
        size="icon"
        title={t('rich_text_bold')}
        type="button"
        variant={props.editor?.isActive('bold') ? 'secondary' : 'ghost'}
      >
        <Bold aria-hidden />
      </Button>
      <Button
        aria-label={t('rich_text_italic')}
        aria-pressed={props.editor?.isActive('italic') ?? false}
        disabled={props.disabled}
        onClick={() => {
          mutateEditor({
            editor: props.editor,
            mutate: (currentEditor) => {
              currentEditor.chain().focus().toggleItalic().run();
            },
            syncEditorState: props.syncEditorState,
          });
        }}
        size="icon"
        title={t('rich_text_italic')}
        type="button"
        variant={props.editor?.isActive('italic') ? 'secondary' : 'ghost'}
      >
        <Italic aria-hidden />
      </Button>
      <Button
        aria-label={t('rich_text_bullet_list')}
        aria-pressed={props.editor?.isActive('bulletList') ?? false}
        disabled={props.disabled}
        onClick={() => {
          mutateEditor({
            editor: props.editor,
            mutate: (currentEditor) => {
              currentEditor.chain().focus().toggleBulletList().run();
            },
            syncEditorState: props.syncEditorState,
          });
        }}
        size="icon"
        title={t('rich_text_bullet_list')}
        type="button"
        variant={props.editor?.isActive('bulletList') ? 'secondary' : 'ghost'}
      >
        <List aria-hidden />
      </Button>
      <Button
        aria-label={t('rich_text_ordered_list')}
        aria-pressed={props.editor?.isActive('orderedList') ?? false}
        disabled={props.disabled}
        onClick={() => {
          mutateEditor({
            editor: props.editor,
            mutate: (currentEditor) => {
              currentEditor.chain().focus().toggleOrderedList().run();
            },
            syncEditorState: props.syncEditorState,
          });
        }}
        size="icon"
        title={t('rich_text_ordered_list')}
        type="button"
        variant={props.editor?.isActive('orderedList') ? 'secondary' : 'ghost'}
      >
        <ListOrdered aria-hidden />
      </Button>
      <Button
        aria-label={t('rich_text_link')}
        disabled={props.disabled}
        onClick={handleOpenLinkEditor}
        size="icon"
        title={t('rich_text_link')}
        type="button"
        variant="ghost"
      >
        <Link aria-hidden />
      </Button>
      <Button
        aria-label={t('rich_text_unlink')}
        disabled={props.disabled}
        onClick={() => {
          mutateEditor({
            editor: props.editor,
            mutate: (currentEditor) => {
              currentEditor.chain().focus().unsetLink().run();
            },
            syncEditorState: props.syncEditorState,
          });
        }}
        size="icon"
        title={t('rich_text_unlink')}
        type="button"
        variant="ghost"
      >
        <Unlink aria-hidden />
      </Button>
    </>
  );
}

function AdminRichTextToolbar(props: {
  currentImageAlignment: 'left' | 'center' | 'right' | null;
  disabled: boolean;
  editor: RichTextEditorInstance | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleMediaFailure: () => void;
  lastImagePos: number | null;
  loadAssets: () => Promise<void>;
  mediaBusy: boolean;
  onOpenLinkEditor: () => void;
  pickerOpen: boolean;
  resizeImage: (width: number | null) => void;
  setPickerOpen: (next: boolean) => void;
  syncEditorState: SyncRichTextEditorState;
  updateImageAttributes: (
    attributes: Record<string, number | string | null>
  ) => void;
  uploadImage: (file: File) => Promise<void>;
}) {
  const t = useTranslations('AdminCatalogResource');

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/50 p-1.5 dark:bg-muted/30">
      <select
        aria-label={t('rich_text_block_style')}
        className={`${adminNativeSelectClassName} h-8 w-auto min-w-[9rem]`}
        disabled={props.disabled}
        onChange={(event) => {
          selectEditorBlockStyle(props.editor, event.target.value);
        }}
        value={props.editor ? activeBlockKind(props.editor) : 'paragraph'}
      >
        <option value="paragraph">{t('rich_text_paragraph')}</option>
        <option value="h2">{t('rich_text_heading_2')}</option>
        <option value="h3">{t('rich_text_heading_3')}</option>
        <option value="h4">{t('rich_text_heading_4')}</option>
      </select>
      <AdminRichTextFormatControls
        disabled={props.disabled}
        editor={props.editor}
        onOpenLinkEditor={props.onOpenLinkEditor}
        syncEditorState={props.syncEditorState}
      />
      <Button
        aria-label={t('rich_text_upload_image')}
        disabled={props.disabled || props.mediaBusy}
        onClick={() => props.fileInputRef.current?.click()}
        size="icon"
        title={t('rich_text_upload_image')}
        type="button"
        variant="ghost"
      >
        <Upload aria-hidden />
      </Button>
      <Button
        aria-expanded={props.pickerOpen}
        aria-label={t('rich_text_select_image')}
        disabled={props.disabled || props.mediaBusy}
        onClick={() => {
          // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the picker promise.
          void toggleMediaPicker({
            loadAssets: props.loadAssets,
            pickerOpen: props.pickerOpen,
            setPickerOpen: props.setPickerOpen,
          });
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
        aria-pressed={props.currentImageAlignment === 'left'}
        disabled={props.disabled}
        onClick={() => {
          props.updateImageAttributes({ align: 'left' });
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
        aria-pressed={props.currentImageAlignment === 'center'}
        disabled={props.disabled}
        onClick={() => {
          props.updateImageAttributes({ align: 'center' });
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
        aria-pressed={props.currentImageAlignment === 'right'}
        disabled={props.disabled}
        onClick={() => {
          props.updateImageAttributes({ align: 'right' });
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
        disabled={props.disabled}
        onChange={(event) => {
          selectImageWidthValue(event.target.value, props.resizeImage);
        }}
        value={
          props.editor
            ? imageWidthSelectValue(props.editor, props.lastImagePos)
            : 'reset'
        }
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
        onChange={(event) => {
          // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the upload promise.
          void handleFileInputChange({
            event,
            handleMediaFailure: props.handleMediaFailure,
            uploadImage: props.uploadImage,
          });
        }}
        ref={props.fileInputRef}
        type="file"
      />
    </div>
  );
}

export function AdminRichTextEditor(props: {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorShellRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(props.defaultValue);
  const [assets, setAssets] = useState<CmsMediaAsset[]>([]);
  const [lastImagePos, setLastImagePos] = useState<number | null>(null);
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkHref, setLinkHref] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [uploadingFilename, setUploadingFilename] = useState<string | null>(
    null
  );
  const [, setToolbarRevision] = useState(0);
  const attributes = editorAttributes({
    errorId: props.errorId,
    errorMessage: props.errorMessage,
    label: props.label,
  });

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
      attributes,
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
      const imagePos = selectedImagePosition(currentEditor);
      if (imagePos !== null) {
        setLastImagePos(imagePos);
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
    const {
      selection: { from },
    } = editor.state;
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
    setLastImagePos(
      findInsertedImagePosition({
        editor,
        from,
        src: asset.publicPath,
      })
    );
    syncEditorState(editor);
    setPickerOpen(false);
  }

  async function loadAssets() {
    setMediaBusy(true);
    setMediaError(null);
    try {
      const pageId = currentPageId(
        editorShellRef.current?.closest('form') ?? null
      );
      const loadedAssets = await loadCmsMediaAssets({ pageId });
      if (!loadedAssets) {
        setMediaError(t('rich_text_media_error'));
        return;
      }
      setAssets(loadedAssets);
      setPickerOpen(true);
    } catch {
      setMediaError(t('rich_text_media_error'));
    } finally {
      setMediaBusy(false);
    }
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

  function updateImageAttributes(
    imageAttributes: Record<string, number | string | null>
  ) {
    if (!editor) {
      return;
    }
    const imagePos = selectedImagePosition(editor) ?? lastImagePos;
    if (
      imagePos !== null &&
      updateImageAttributesAtPosition({
        attributes: imageAttributes,
        editor,
        imagePos,
      })
    ) {
      setLastImagePos(imagePos);
    }
    syncEditorState(editor);
  }

  function resizeImage(width: number | null) {
    updateImageAttributes({ height: null, width });
  }

  const disabled = !editor;

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <Label className="text-foreground" htmlFor={props.fieldId}>
        {props.label}
      </Label>
      <div
        className="overflow-hidden rounded-lg border border-input bg-background text-foreground shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input-background dark:contrast-more:border-white"
        ref={editorShellRef}
      >
        <AdminRichTextToolbar
          currentImageAlignment={activeImageAlignmentFor(editor, lastImagePos)}
          disabled={disabled}
          editor={editor}
          fileInputRef={fileInputRef}
          handleMediaFailure={handleMediaFailure}
          lastImagePos={lastImagePos}
          loadAssets={loadAssets}
          mediaBusy={mediaBusy}
          onOpenLinkEditor={openLinkEditor}
          pickerOpen={pickerOpen}
          resizeImage={resizeImage}
          setPickerOpen={setPickerOpen}
          syncEditorState={syncEditorState}
          updateImageAttributes={updateImageAttributes}
          uploadImage={uploadImage}
        />
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
      {props.errorMessage ? (
        <p className="text-sm text-destructive" id={props.errorId} role="alert">
          {props.errorMessage}
        </p>
      ) : null}
    </div>
  );
}
