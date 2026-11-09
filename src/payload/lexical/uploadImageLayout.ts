export type UploadImageAlign = 'none' | 'left' | 'right';

export type UploadImageLayout = {
  align: UploadImageAlign;
  /** Percent of the text column width (15–100). */
  width: number;
};

const MIN_WIDTH = 15;
const MAX_WIDTH = 100;
const WRAP_DEFAULT_WIDTH = 50;

/**
 * Clamps a display width percent for an upload image.
 *
 * @param value - Raw width from fields or drag
 * @returns Width between 15 and 100
 */
export function clampUploadImageWidth(value: number): number {
  if (!Number.isFinite(value)) {
    return MAX_WIDTH;
  }
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(value)));
}

/**
 * Resolves align and width from upload node fields.
 *
 * Prefers `align` + `width`. Also reads `layout` (full/left/right). Legacy
 * `size` / `side` map to a float and a fixed width until an editor resizes.
 *
 * @param fields - Upload node fields
 * @returns Align and column width percent
 */
export function uploadImageLayout(fields: unknown): UploadImageLayout {
  if (!fields || typeof fields !== 'object') {
    return { align: 'none', width: MAX_WIDTH };
  }
  const record = fields as {
    align?: unknown;
    layout?: unknown;
    side?: unknown;
    size?: unknown;
    width?: unknown;
  };

  const widthFromField = (): number | undefined => {
    if (typeof record.width === 'number') {
      return clampUploadImageWidth(record.width);
    }
    if (typeof record.width === 'string' && record.width.trim().length > 0) {
      return clampUploadImageWidth(Number(record.width));
    }
    return undefined;
  };

  if (record.align === 'left' || record.align === 'right') {
    return {
      align: record.align,
      width: widthFromField() ?? WRAP_DEFAULT_WIDTH,
    };
  }
  if (record.align === 'none') {
    return { align: 'none', width: widthFromField() ?? MAX_WIDTH };
  }

  if (record.layout === 'left' || record.layout === 'right') {
    return {
      align: record.layout,
      width: widthFromField() ?? WRAP_DEFAULT_WIDTH,
    };
  }
  if (record.layout === 'full') {
    return { align: 'none', width: widthFromField() ?? MAX_WIDTH };
  }

  if (record.size === 'small' || record.size === 'medium') {
    return {
      align: record.side === 'right' ? 'right' : 'left',
      width:
        widthFromField() ?? (record.size === 'small' ? 33 : WRAP_DEFAULT_WIDTH),
    };
  }

  return { align: 'none', width: widthFromField() ?? MAX_WIDTH };
}

/**
 * Width to store when choosing left or right align (WordPress: shrink so text wraps).
 *
 * @param currentWidth - Current width percent
 * @returns Width to keep or default wrap width
 */
export function widthForWrapAlign(currentWidth: number): number {
  if (currentWidth < MAX_WIDTH) {
    return clampUploadImageWidth(currentWidth);
  }
  return WRAP_DEFAULT_WIDTH;
}
