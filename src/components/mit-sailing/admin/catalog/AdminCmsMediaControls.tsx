'use client';

import { ArrowDown, ArrowUp, ImageIcon, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import NextImage from 'next/image';
import type * as React from 'react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export type CmsMediaAsset = {
  id: string;
  originalFilename: string;
  publicPath: string;
  createdAt: string;
};

export function isCmsMediaPath(value: string | undefined): value is string {
  return typeof value === 'string' && value.startsWith('/cms-media/');
}

function isAdminImagePath(value: string | undefined): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  return /^\/(?!\/).+\.(?:gif|jpe?g|png|webp)$/iu.test(value.trim());
}

export function currentPageId(form: HTMLFormElement | null): string {
  if (!form) {
    return '';
  }
  const value = new FormData(form).get('pageId');
  return typeof value === 'string' ? value : '';
}

export function stringField(value: unknown, field: string): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  return typeof descriptor?.value === 'string' ? descriptor.value : undefined;
}

export function cmsMediaAssetFromUnknown(value: unknown): CmsMediaAsset | null {
  const id = stringField(value, 'id');
  const originalFilename = stringField(value, 'originalFilename');
  const publicPath = stringField(value, 'publicPath');
  const createdAt = stringField(value, 'createdAt');
  if (!id || !originalFilename || !publicPath || !createdAt) {
    return null;
  }
  return { createdAt, id, originalFilename, publicPath };
}

export function cmsMediaAssetsFromUnknown(value: unknown): CmsMediaAsset[] {
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

export async function loadCmsMediaAssets(): Promise<CmsMediaAsset[] | null> {
  const response = await fetch('/api/admin/cms-media');
  if (!response.ok) {
    return null;
  }
  const data: unknown = await response.json();
  return cmsMediaAssetsFromUnknown(data);
}

export async function uploadCmsMediaFile(props: {
  file: File;
  pageId?: string;
}): Promise<CmsMediaAsset | null> {
  const formData = new FormData();
  formData.set('file', props.file);
  if (props.pageId) {
    formData.set('pageId', props.pageId);
  }
  const response = await fetch('/api/admin/cms-media', {
    body: formData,
    method: 'POST',
  });
  if (!response.ok) {
    return null;
  }
  const data: unknown = await response.json();
  const publicPath =
    stringField(data, 'publicPath') ?? stringField(data, 'url');
  if (!isCmsMediaPath(publicPath)) {
    return null;
  }
  return {
    createdAt: stringField(data, 'createdAt') ?? new Date().toISOString(),
    id: stringField(data, 'id') ?? publicPath,
    originalFilename: stringField(data, 'originalFilename') ?? props.file.name,
    publicPath,
  };
}

function MediaAssetButton(props: {
  asset: CmsMediaAsset;
  onSelect: (asset: CmsMediaAsset) => void;
}) {
  return (
    <button
      className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card p-2 text-left text-sm text-card-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={() => {
        props.onSelect(props.asset);
      }}
      type="button"
    >
      <NextImage
        alt=""
        className="size-12 rounded-sm object-cover"
        height={48}
        src={props.asset.publicPath}
        width={48}
      />
      <span className="min-w-0 truncate">{props.asset.originalFilename}</span>
    </button>
  );
}

export function AdminCmsMediaPickerPanel(props: {
  assets: CmsMediaAsset[];
  onSelect: (asset: CmsMediaAsset) => void;
}) {
  const t = useTranslations('AdminCatalogResource');
  return (
    <div className="grid max-h-56 gap-2 overflow-y-auto border border-border bg-background p-2 sm:grid-cols-2">
      {props.assets.length > 0 ? (
        props.assets.map((asset) => (
          <MediaAssetButton
            asset={asset}
            key={asset.id}
            onSelect={props.onSelect}
          />
        ))
      ) : (
        <p className="px-2 py-4 text-sm text-muted-foreground">
          {t('rich_text_media_empty')}
        </p>
      )}
    </div>
  );
}

function parseImageListValue(value: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value.filter(isAdminImagePath);
  }
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(isAdminImagePath);
}

function imagePreview(src: string, alt: string) {
  return (
    <NextImage
      alt={alt}
      className="size-14 rounded-sm object-cover"
      height={56}
      src={src}
      width={56}
    />
  );
}

function mediaFieldError(error: string | null) {
  if (!error) {
    return null;
  }
  return (
    <p className="text-xs text-destructive" role="alert">
      {error}
    </p>
  );
}

export function AdminImageField(props: {
  defaultValue: string;
  errorId?: string;
  errorMessage?: string | null;
  fieldId: string;
  fieldKey: string;
  label: string;
  onChange?: (value: string) => void;
  required?: boolean;
  uploadButtonRef?: React.Ref<HTMLButtonElement>;
}) {
  const t = useTranslations('AdminCatalogResource');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(
    isAdminImagePath(props.defaultValue) ? props.defaultValue : ''
  );
  const [assets, setAssets] = useState<CmsMediaAsset[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  function setFieldValue(nextValue: string) {
    setValue(nextValue);
    props.onChange?.(nextValue);
  }

  async function openPicker() {
    if (pickerOpen) {
      setPickerOpen(false);
      return;
    }
    setMediaBusy(true);
    setMediaError(null);
    let loaded: CmsMediaAsset[] | null;
    try {
      loaded = await loadCmsMediaAssets();
    } catch {
      loaded = null;
    }
    setMediaBusy(false);
    if (!loaded) {
      setMediaError(t('rich_text_media_error'));
      return;
    }
    setAssets(loaded);
    setPickerOpen(true);
  }

  async function uploadImage(file: File) {
    setMediaBusy(true);
    setMediaError(null);
    const pageId = currentPageId(shellRef.current?.closest('form') ?? null);
    let asset: CmsMediaAsset | null;
    try {
      asset = await uploadCmsMediaFile({ file, pageId });
    } catch {
      asset = null;
    }
    setMediaBusy(false);
    if (!asset) {
      setMediaError(t('rich_text_media_error'));
      return;
    }
    setFieldValue(asset.publicPath);
    setPickerOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5 text-sm" ref={shellRef}>
      <Label className="text-foreground" htmlFor={props.fieldId}>
        {props.label}
      </Label>
      <input
        id={props.fieldId}
        name={props.fieldKey}
        required={props.required}
        type="hidden"
        value={value}
      />
      <div className="flex flex-wrap items-center gap-2">
        {value ? imagePreview(value, props.label) : null}
        <Button
          aria-label={t('media_upload_for_field', { label: props.label })}
          aria-describedby={props.errorMessage ? props.errorId : undefined}
          aria-invalid={props.errorMessage ? true : undefined}
          disabled={mediaBusy}
          onClick={() => fileInputRef.current?.click()}
          ref={props.uploadButtonRef}
          type="button"
          variant="outline"
        >
          <Upload aria-hidden size={16} />
          {t('media_upload')}
        </Button>
        <Button
          aria-expanded={pickerOpen}
          aria-label={t('media_select_for_field', { label: props.label })}
          disabled={mediaBusy}
          onClick={async () => {
            await openPicker();
          }}
          type="button"
          variant="outline"
        >
          <ImageIcon aria-hidden size={16} />
          {t('media_select')}
        </Button>
        {value ? (
          <Button
            aria-label={t('media_remove_for_field', { label: props.label })}
            onClick={() => {
              setFieldValue('');
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden />
          </Button>
        ) : null}
      </div>
      <input
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (file) {
            await uploadImage(file);
          }
        }}
        ref={fileInputRef}
        type="file"
      />
      {pickerOpen ? (
        <AdminCmsMediaPickerPanel
          assets={assets}
          onSelect={(asset) => {
            setFieldValue(asset.publicPath);
            setPickerOpen(false);
          }}
        />
      ) : null}
      {props.errorMessage ? (
        <p className="text-sm text-destructive" id={props.errorId} role="alert">
          {props.errorMessage}
        </p>
      ) : null}
      {mediaFieldError(mediaError)}
    </div>
  );
}

export function AdminImageListField(props: {
  defaultValue: string | string[];
  fieldId: string;
  fieldKey: string;
  label: string;
  required?: boolean;
}) {
  const t = useTranslations('AdminCatalogResource');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState(() =>
    parseImageListValue(props.defaultValue)
  );
  const [assets, setAssets] = useState<CmsMediaAsset[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  function addImage(src: string) {
    setValues((prev) => (prev.includes(src) ? prev : [...prev, src]));
    setPickerOpen(false);
  }

  async function openPicker() {
    if (pickerOpen) {
      setPickerOpen(false);
      return;
    }
    setMediaBusy(true);
    setMediaError(null);
    let loaded: CmsMediaAsset[] | null;
    try {
      loaded = await loadCmsMediaAssets();
    } catch {
      loaded = null;
    }
    setMediaBusy(false);
    if (!loaded) {
      setMediaError(t('rich_text_media_error'));
      return;
    }
    setAssets(loaded);
    setPickerOpen(true);
  }

  async function uploadImage(file: File) {
    setMediaBusy(true);
    setMediaError(null);
    const pageId = currentPageId(shellRef.current?.closest('form') ?? null);
    let asset: CmsMediaAsset | null;
    try {
      asset = await uploadCmsMediaFile({ file, pageId });
    } catch {
      asset = null;
    }
    setMediaBusy(false);
    if (!asset) {
      setMediaError(t('rich_text_media_error'));
      return;
    }
    addImage(asset.publicPath);
  }

  function moveImage(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    setValues((prev) => {
      const current = prev[index];
      const target = prev[nextIndex];
      if (nextIndex < 0 || nextIndex >= prev.length || !current || !target) {
        return prev;
      }
      const next = [...prev];
      next[index] = target;
      next[nextIndex] = current;
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2 text-sm" ref={shellRef}>
      <Label className="text-foreground" htmlFor={props.fieldId}>
        {props.label}
      </Label>
      <input
        id={props.fieldId}
        name={props.fieldKey}
        required={props.required}
        type="hidden"
        value={values.join('\n')}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          aria-label={t('media_upload_for_field', { label: props.label })}
          disabled={mediaBusy}
          onClick={() => fileInputRef.current?.click()}
          type="button"
          variant="outline"
        >
          <Upload aria-hidden size={16} />
          {t('media_upload')}
        </Button>
        <Button
          aria-expanded={pickerOpen}
          aria-label={t('media_select_for_field', { label: props.label })}
          disabled={mediaBusy}
          onClick={async () => {
            await openPicker();
          }}
          type="button"
          variant="outline"
        >
          <ImageIcon aria-hidden size={16} />
          {t('media_select')}
        </Button>
      </div>
      <input
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        data-testid={
          props.fieldKey === 'imagePaths'
            ? 'sailing-class-gallery-upload'
            : `${props.fieldKey}-upload`
        }
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (file) {
            await uploadImage(file);
          }
        }}
        ref={fileInputRef}
        type="file"
      />
      {values.length > 0 ? (
        <ul className="m-0 grid list-none gap-2 p-0">
          {values.map((src, index) => (
            <li
              className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card p-2"
              key={src}
            >
              {imagePreview(src, props.label)}
              <span className="min-w-0 flex-1 truncate text-card-foreground">
                {src}
              </span>
              <Button
                aria-label={t('media_move_up')}
                disabled={index === 0}
                onClick={() => {
                  moveImage(index, -1);
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                aria-label={t('media_move_down')}
                disabled={index === values.length - 1}
                onClick={() => {
                  moveImage(index, 1);
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <ArrowDown aria-hidden />
              </Button>
              <Button
                aria-label={t('media_remove_image')}
                onClick={() => {
                  setValues((prev) => prev.filter((item) => item !== src));
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {pickerOpen ? (
        <AdminCmsMediaPickerPanel
          assets={assets}
          onSelect={(asset) => {
            addImage(asset.publicPath);
          }}
        />
      ) : null}
      {mediaFieldError(mediaError)}
    </div>
  );
}
