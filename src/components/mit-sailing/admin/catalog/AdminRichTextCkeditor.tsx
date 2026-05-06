'use client';

import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  AutoImage,
  AutoLink,
  Autosave,
  BlockQuote,
  Bold,
  ButtonView,
  ClassicEditor,
  CodeBlock,
  Essentials,
  Heading,
  IconImage,
  Image,
  ImageCaption,
  ImageInsert,
  ImageResize,
  ImageStyle,
  ImageTextAlternative,
  ImageToolbar,
  ImageUpload,
  Italic,
  Link,
  LinkImage,
  List,
  Paragraph,
  PasteFromOffice,
  Plugin,
  SimpleUploadAdapter,
} from 'ckeditor5';
import type { Editor, EditorConfig, ImageUploadCompleteEvent } from 'ckeditor5';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import {
  adminRichTextDefaultImageStyle,
  adminRichTextImageResizeOptions,
  adminRichTextImageStyleOptions,
  adminRichTextImageToolbarItems,
  adminRichTextToolbarItems,
} from '@/components/mit-sailing/admin/catalog/adminRichTextEditorConfig';
import { Env } from '@/libs/Env';

function editorConfigForLabels(props: {
  paragraph: string;
  heading2: string;
  heading3: string;
  heading4: string;
  mediaLibrary: string;
  onOpenMediaLibrary: () => void;
}) {
  class AdminMediaLibraryPlugin extends Plugin {
    public static get pluginName() {
      return 'AdminMediaLibrary' as const;
    }

    public init(): void {
      const { editor } = this;
      editor.ui.componentFactory.add('adminMediaLibrary', (locale) => {
        const button = new ButtonView(locale);
        button.set({
          icon: IconImage,
          label: props.mediaLibrary,
          tooltip: true,
        });
        button.on('execute', props.onOpenMediaLibrary);
        return button;
      });
    }
  }

  return {
    licenseKey: Env.NEXT_PUBLIC_CKEDITOR_LICENSE_KEY,
    plugins: [
      AutoImage,
      AutoLink,
      Autosave,
      BlockQuote,
      Bold,
      CodeBlock,
      Essentials,
      Heading,
      Image,
      ImageCaption,
      ImageInsert,
      ImageResize,
      ImageStyle,
      ImageTextAlternative,
      ImageToolbar,
      ImageUpload,
      Italic,
      Link,
      LinkImage,
      List,
      Paragraph,
      PasteFromOffice,
      SimpleUploadAdapter,
      AdminMediaLibraryPlugin,
    ],
    toolbar: {
      items: [...adminRichTextToolbarItems],
      shouldNotGroupWhenFull: true,
    },
    heading: {
      options: [
        {
          model: 'paragraph',
          title: props.paragraph,
          class: 'ck-heading_paragraph',
        },
        {
          model: 'heading2',
          view: 'h2',
          title: props.heading2,
          class: 'ck-heading_heading2',
        },
        {
          model: 'heading3',
          view: 'h3',
          title: props.heading3,
          class: 'ck-heading_heading3',
        },
        {
          model: 'heading4',
          view: 'h4',
          title: props.heading4,
          class: 'ck-heading_heading4',
        },
      ],
    },
    image: {
      resizeOptions: adminRichTextImageResizeOptions.map((option) => ({
        ...option,
      })),
      resizeUnit: '%',
      insert: {
        integrations: ['upload'],
        type: 'block',
      },
      upload: {
        types: ['jpeg', 'png', 'gif', 'webp'],
      },
      styles: {
        options: [...adminRichTextImageStyleOptions],
      },
      toolbar: adminRichTextImageToolbarItems.map((item) =>
        typeof item === 'string'
          ? item
          : {
              ...item,
              items: [...item.items],
            }
      ),
    },
    link: {
      addTargetToExternalLinks: true,
      defaultProtocol: 'https://',
    },
    simpleUpload: {
      uploadUrl: '/api/admin/uploads',
      withCredentials: true,
      headers: () => ({
        'Idempotency-Key': crypto.randomUUID(),
      }),
    },
    autosave: {
      async save(_editor: Editor): Promise<void> {
        await Promise.resolve();
      },
    },
  } satisfies EditorConfig;
}

function applyDefaultImageStyleToUploads(props: {
  editor: Editor;
  onChangeHtml: (html: string) => void;
}): void {
  const imageUploadEditing = props.editor.plugins.get('ImageUploadEditing');
  imageUploadEditing.on<ImageUploadCompleteEvent>(
    'uploadComplete',
    (_event, data) => {
      props.editor.model.change((writer) => {
        writer.setAttribute('alt', '', data.imageElement);
        writer.setAttribute(
          'imageStyle',
          adminRichTextDefaultImageStyle,
          data.imageElement
        );
      });
      props.onChangeHtml(props.editor.getData());
    }
  );
}

/**
 * CKEditor-backed CMS field body.
 *
 * @param props - Initial HTML and editor lifecycle callbacks
 * @returns CKEditor instance
 */
export function AdminRichTextCkeditor(props: {
  fieldId: string;
  initialHtml: string;
  onChangeHtml: (html: string) => void;
  onOpenMediaLibrary: () => void;
  onReady: (editor: Editor) => void;
  testId: string;
}) {
  const t = useTranslations('AdminRichText');
  const [initError, setInitError] = useState<string | null>(null);
  const initialHtmlRef = useRef(props.initialHtml);
  const configRef = useRef<EditorConfig | null>(null);
  configRef.current ??= editorConfigForLabels({
    paragraph: t('toolbar_paragraph'),
    heading2: t('toolbar_heading_2'),
    heading3: t('toolbar_heading_3'),
    heading4: t('toolbar_heading_4'),
    mediaLibrary: t('toolbar_media_library'),
    onOpenMediaLibrary: props.onOpenMediaLibrary,
  });

  if (initError) {
    return (
      <div
        className="min-h-[18rem] rounded bg-mit-red-highlight p-4 text-sm text-mit-text"
        role="alert"
      >
        <p className="font-semibold">{t('editor_load_error')}</p>
        <p className="mt-1 break-words text-slate-700">{initError}</p>
      </div>
    );
  }

  return (
    <CKEditor
      config={configRef.current}
      data={initialHtmlRef.current}
      editor={ClassicEditor}
      id={props.fieldId}
      onError={(error, details) => {
        if (details.phase === 'initialization') {
          setInitError(error.message);
        }
      }}
      onChange={(_event, editor) => {
        props.onChangeHtml(editor.getData());
      }}
      onReady={(editor) => {
        const root = editor.editing.view.document.getRoot();
        if (root) {
          editor.editing.view.change((writer) => {
            writer.setAttribute('data-testid', props.testId, root);
          });
        }
        props.onReady(editor);
        applyDefaultImageStyleToUploads({
          editor,
          onChangeHtml: props.onChangeHtml,
        });
        props.onChangeHtml(editor.getData());
      }}
    />
  );
}
