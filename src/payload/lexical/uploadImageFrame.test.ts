import { describe, expect, it } from 'vitest';
import { uploadImageFrame } from '@/payload/lexical/uploadImageFrame';
import {
  clampUploadImageWidth,
  uploadImageLayout,
  widthForWrapAlign,
} from '@/payload/lexical/uploadImageLayout';

describe('uploadImageLayout', () => {
  it('maps align and width like WordPress', () => {
    expect(uploadImageLayout({ align: 'none', width: 100 })).toEqual({
      align: 'none',
      width: 100,
    });
    expect(uploadImageLayout({ align: 'left', width: 40 })).toEqual({
      align: 'left',
      width: 40,
    });
    expect(uploadImageLayout({ align: 'right', width: 55 })).toEqual({
      align: 'right',
      width: 55,
    });
  });

  it('defaults wrap width when align is set without width', () => {
    expect(uploadImageLayout({ align: 'left' }).width).toBe(50);
  });

  it('maps legacy size and side when align is missing', () => {
    expect(uploadImageLayout({ side: 'left', size: 'small' })).toEqual({
      align: 'left',
      width: 33,
    });
    expect(uploadImageLayout({ side: 'right', size: 'medium' })).toEqual({
      align: 'right',
      width: 50,
    });
    expect(uploadImageLayout({ size: 'large' })).toEqual({
      align: 'none',
      width: 100,
    });
  });

  it('clamps width and shrinks full-width images when wrapping', () => {
    expect(clampUploadImageWidth(5)).toBe(15);
    expect(clampUploadImageWidth(140)).toBe(100);
    expect(widthForWrapAlign(100)).toBe(50);
    expect(widthForWrapAlign(40)).toBe(40);
  });
});

describe('uploadImageFrame', () => {
  it('keeps a full-width image in the text column', () => {
    expect(uploadImageFrame({ align: 'none', width: 100 }).className).toBe(
      'my-4 block w-full'
    );
    expect(uploadImageFrame(null).className).toBe('my-4 block w-full');
  });

  it('floats a left-aligned image from the md breakpoint', () => {
    const frame = uploadImageFrame({ align: 'left', width: 40 });
    expect(frame.className).toContain('md:float-left');
    expect(frame.style).toMatchObject({
      '--upload-image-width': '40%',
    });
  });

  it('floats a right-aligned image from the md breakpoint', () => {
    const frame = uploadImageFrame({ align: 'right', width: 55 });
    expect(frame.className).toContain('md:float-right');
    expect(frame.style).toMatchObject({
      '--upload-image-width': '55%',
    });
  });

  it('keeps legacy size and side until align is set', () => {
    expect(
      uploadImageFrame({ side: 'left', size: 'small' }).className
    ).toContain('md:float-left');
    expect(
      uploadImageFrame({ side: 'right', size: 'medium' }).className
    ).toContain('md:float-right');
  });
});
