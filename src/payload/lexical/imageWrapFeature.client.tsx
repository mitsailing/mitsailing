'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $isUploadNode,
  createClientFeature,
} from '@payloadcms/richtext-lexical/client';
import type { LexicalNode } from 'lexical';
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
} from 'lexical';
import { useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { UploadImageAlign } from '@/payload/lexical/uploadImageLayout';
import {
  clampUploadImageWidth,
  uploadImageLayout,
  widthForWrapAlign,
} from '@/payload/lexical/uploadImageLayout';

const ALIGN_CHOICES: { label: string; value: UploadImageAlign }[] = [
  { label: 'None', value: 'none' },
  { label: 'Align left', value: 'left' },
  { label: 'Align right', value: 'right' },
];

type ResizeCorner = 'ne' | 'nw' | 'se' | 'sw';

const CORNERS: {
  className: string;
  corner: ResizeCorner;
  cursor: string;
}[] = [
  {
    className: 'upload-image-resize-handle--nw',
    corner: 'nw',
    cursor: 'nwse-resize',
  },
  {
    className: 'upload-image-resize-handle--ne',
    corner: 'ne',
    cursor: 'nesw-resize',
  },
  {
    className: 'upload-image-resize-handle--sw',
    corner: 'sw',
    cursor: 'nesw-resize',
  },
  {
    className: 'upload-image-resize-handle--se',
    corner: 'se',
    cursor: 'nwse-resize',
  },
];

function collectUploads(node: LexicalNode, found: LexicalNode[]) {
  if ($isUploadNode(node)) {
    found.push(node);
  }
  if (!$isElementNode(node)) {
    return;
  }
  for (const child of node.getChildren()) {
    collectUploads(child, found);
  }
}

/**
 * Applies WordPress-style float and width on the upload decorator element.
 *
 * @param element - Upload decorator DOM node
 * @param fields - Upload node fields (`align` / `width`)
 */
function applyUploadLayout(element: HTMLElement, fields: unknown) {
  const layout = uploadImageLayout(fields);
  element.classList.add('upload-image-framed');
  let floatValue = 'none';
  let marginValue = '1em 0';
  if (layout.align === 'left') {
    floatValue = 'left';
    marginValue = '1em 1em 0 0';
  } else if (layout.align === 'right') {
    floatValue = 'right';
    marginValue = '1em 0 0 1em';
  }
  element.style.float = floatValue;
  element.style.clear = layout.align === 'none' ? 'both' : '';
  element.style.width = `${layout.width}%`;
  element.style.maxWidth = '100%';
  element.style.height = 'auto';
  element.style.margin = marginValue;
}

function writeUploadFields(
  editor: ReturnType<typeof useLexicalComposerContext>[0],
  nodeKey: string,
  next: { align?: UploadImageAlign; width?: number }
) {
  editor.update(() => {
    const node = $getNodeByKey(nodeKey);
    if (!$isUploadNode(node)) {
      return;
    }
    const data = node.getData();
    const current = uploadImageLayout(data.fields);
    node.setData({
      ...data,
      fields: {
        ...data.fields,
        align: next.align ?? current.align,
        width: next.width ?? current.width,
      },
    });
  });
}

function ImageWrapPlugin() {
  const [editor] = useLexicalComposerContext();
  const [selected, setSelected] = useState<{
    align: UploadImageAlign;
    element: HTMLElement;
    key: string;
    width: number;
  } | null>(null);

  useEffect(() => {
    const paint = () => {
      let next: {
        align: UploadImageAlign;
        element: HTMLElement;
        key: string;
        width: number;
      } | null = null;
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        const selectedNode = $isNodeSelection(selection)
          ? selection.getNodes().find((node) => $isUploadNode(node))
          : undefined;
        const uploads: LexicalNode[] = [];
        collectUploads($getRoot(), uploads);
        for (const node of uploads) {
          if (!$isUploadNode(node)) {
            continue;
          }
          const element = editor.getElementByKey(node.getKey());
          if (!element) {
            continue;
          }
          const { fields } = node.getData();
          applyUploadLayout(element, fields);
          if (!selectedNode || node.getKey() !== selectedNode.getKey()) {
            continue;
          }
          const layout = uploadImageLayout(fields);
          next = {
            align: layout.align,
            element,
            key: node.getKey(),
            width: layout.width,
          };
        }
      });
      setSelected(next);
    };
    paint();
    return editor.registerUpdateListener(() => {
      paint();
    });
  }, [editor]);

  if (!selected) {
    return null;
  }

  const startResize = (
    event: ReactPointerEvent<HTMLButtonElement>,
    corner: ResizeCorner
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const nodeKey = selected.key;
    const { element } = selected;
    const root = editor.getRootElement();
    const rootWidth =
      root?.getBoundingClientRect().width ?? element.offsetWidth;
    const originX = event.clientX;
    const originWidth = element.getBoundingClientRect().width;
    const { align } = selected;
    const fromEast = corner === 'ne' || corner === 'se';

    const onMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - originX;
      const signed = fromEast ? delta : -delta;
      const nextPx = Math.max(80, originWidth + signed);
      const percent = clampUploadImageWidth((nextPx / rootWidth) * 100);
      element.style.width = `${percent}%`;
      element.dataset.uploadResizeWidth = String(percent);
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      const raw = element.dataset.uploadResizeWidth;
      delete element.dataset.uploadResizeWidth;
      const percent = clampUploadImageWidth(
        raw
          ? Number(raw)
          : (element.getBoundingClientRect().width / rootWidth) * 100
      );
      writeUploadFields(editor, nodeKey, {
        align,
        width: percent,
      });
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  return createPortal(
    <>
      <div
        aria-label="Image alignment"
        className="upload-image-align-toolbar"
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        role="toolbar"
      >
        {ALIGN_CHOICES.map((choice) => (
          <button
            aria-pressed={selected.align === choice.value}
            className={
              selected.align === choice.value
                ? 'upload-image-align-choice is-active'
                : 'upload-image-align-choice'
            }
            key={choice.value}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const width =
                choice.value === 'none'
                  ? selected.width
                  : widthForWrapAlign(selected.width);
              writeUploadFields(editor, selected.key, {
                align: choice.value,
                width,
              });
            }}
            type="button"
          >
            {choice.label}
          </button>
        ))}
      </div>
      {CORNERS.map((corner) => (
        <button
          aria-label="Resize image"
          className={`upload-image-resize-handle ${corner.className}`}
          key={corner.className}
          onPointerDown={(event) => {
            startResize(event, corner.corner);
          }}
          style={{ cursor: corner.cursor }}
          type="button"
        />
      ))}
    </>,
    selected.element
  );
}

/**
 * WordPress-style resize handles and align controls on the selected upload.
 */
export const ImageWrapFeatureClient = createClientFeature({
  plugins: [
    {
      Component: ImageWrapPlugin,
      position: 'normal',
    },
  ],
});
