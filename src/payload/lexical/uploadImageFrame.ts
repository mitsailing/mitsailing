import type { CSSProperties } from 'react';
import { uploadImageLayout } from '@/payload/lexical/uploadImageLayout';
import type { UploadImageLayout } from '@/payload/lexical/uploadImageLayout';

type UploadImageFrameStyle = CSSProperties & {
  '--upload-image-width'?: string;
};

type UploadImageFrame = {
  className: string;
  sizes: string;
  style?: UploadImageFrameStyle;
};

const fullWidth: UploadImageFrame = {
  className: 'my-4 block w-full',
  sizes: '(min-width: 768px) 64rem, 100vw',
};

/**
 * Builds public frame classes from a resolved layout.
 *
 * @param layout - Align and width percent
 * @returns Wrapper class, optional style, and `next/image` sizes
 */
export function uploadImageFrameFromLayout(
  layout: UploadImageLayout
): UploadImageFrame {
  if (layout.align === 'none') {
    if (layout.width >= 100) {
      return fullWidth;
    }
    return {
      className: 'my-4 block w-full md:w-[var(--upload-image-width)]',
      sizes: `(min-width: 768px) ${layout.width}vw, 100vw`,
      style: {
        '--upload-image-width': `${layout.width}%`,
      },
    };
  }

  const side =
    layout.align === 'right'
      ? 'md:float-right md:ml-6'
      : 'md:float-left md:mr-6';
  return {
    className: `my-2 block w-full ${side} md:w-[var(--upload-image-width)]`,
    sizes: `(min-width: 768px) ${layout.width}vw, 100vw`,
    style: {
      '--upload-image-width': `${layout.width}%`,
    },
  };
}

/**
 * Frame for a body image. Left and right wrap beside text from the md
 * breakpoint up (WordPress-style). Phones show every image full width.
 *
 * @param fields - Upload node fields (`align` / `width`, or legacy values)
 * @returns Wrapper class, optional style, and `next/image` sizes
 */
export function uploadImageFrame(fields: unknown): UploadImageFrame {
  return uploadImageFrameFromLayout(uploadImageLayout(fields));
}
