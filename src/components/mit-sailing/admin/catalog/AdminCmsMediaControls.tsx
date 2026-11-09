'use client';

import { ArrowDown, ArrowUp, ImageIcon, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import NextImage from 'next/image';
import type * as React from 'react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { authClient } from '@/libs/auth-client';
import { CMS_MEDIA_BROWSER_IMAGE_ACCEPT } from '@/libs/mit-sailing/cmsMediaValidation';
import { ariaInvalidWhenShown } from '@/utils/ariaInvalidWhenShown';
import type { CmsMediaAsset } from './AdminCmsMediaControlsApi';
import {
  isAdminImagePath,
  isAdminVideoPath,
  isCmsMediaPdfPath,
  loadCmsMediaAssets,
  parseImageListValue,
  uploadCmsMediaFile,
} from './AdminCmsMediaControlsApi';

export type { CmsMediaAsset } from './AdminCmsMediaControlsApi';
export {
  cmsMediaAssetFromUnknown,
  cmsMediaAssetsFromUnknown,
  isAdminImagePath,
  isCmsMediaPath,
  isCmsMediaPdfPath,
  loadCmsMediaAssets,
  stringField,
  uploadCmsMediaFile,
} from './AdminCmsMediaControlsApi';

function MediaAssetThumbnail(props: { asset: CmsMediaAsset }) {
  if (
    isCmsMediaPdfPath(props.asset.publicPath) ||
    props.asset.mimeType === 'application/pdf'
  ) {
    return (
      <span
        aria-hidden
        className="flex size-12 shrink-0 items-center justify-center rounded-sm bg-muted text-[0.625rem] font-semibold tracking-wide text-muted-foreground"
      >
        PDF
      </span>
    );
  }
  if (isAdminVideoPath(props.asset.publicPath)) {
    return (
      <video
        aria-hidden
        className="size-12 rounded-sm object-cover"
        muted
        playsInline
        preload="metadata"
        src={props.asset.publicPath}
      />
    );
  }
  return (
    <NextImage
      alt=""
      className="size-12 rounded-sm object-cover"
      height={48}
      src={props.asset.publicPath}
      width={48}
    />
  );
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
      <MediaAssetThumbnail asset={props.asset} />
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

function imagePreview(src: string, alt: string) {
  if (isAdminVideoPath(src)) {
    return (
      <video
        aria-label={alt}
        className="size-14 rounded-sm object-cover"
        muted
        playsInline
        preload="metadata"
        src={src}
      />
    );
  }
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
  const { data: sessionData } = authClient.useSession();
  const signedInUserId =
    sessionData?.user && typeof sessionData.user.id === 'string'
      ? sessionData.user.id
      : null;
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    try {
      const loaded = await loadCmsMediaAssets({
        userId: signedInUserId,
      });
      if (!loaded.ok) {
        setMediaError(loaded.failure.error || t('rich_text_media_error'));
        return;
      }
      setAssets(
        loaded.assets.filter((asset) => isAdminImagePath(asset.publicPath))
      );
      setPickerOpen(true);
    } catch (error: unknown) {
      setMediaError(
        error instanceof Error ? error.message : t('rich_text_media_error')
      );
    } finally {
      setMediaBusy(false);
    }
  }

  async function uploadImage(file: File) {
    setMediaBusy(true);
    setMediaError(null);
    try {
      const result = await uploadCmsMediaFile({
        file,
        userId: signedInUserId,
      });
      if (!result.ok) {
        if ('formError' in result) {
          setMediaError(
            result.formError === 'too_large'
              ? t('rich_text_media_too_large')
              : t('rich_text_media_unsupported_type')
          );
          return;
        }
        setMediaError(result.failure.error || t('rich_text_media_error'));
        return;
      }
      if (!isAdminImagePath(result.asset.publicPath)) {
        setMediaError(t('rich_text_media_error'));
        return;
      }
      setFieldValue(result.asset.publicPath);
      setPickerOpen(false);
    } catch (error: unknown) {
      setMediaError(
        error instanceof Error ? error.message : t('rich_text_media_error')
      );
    } finally {
      setMediaBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 text-sm">
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
          aria-invalid={ariaInvalidWhenShown({
            shown: Boolean(props.errorMessage),
            invalid: true,
          })}
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
          onClick={() => {
            // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the picker promise.
            void openPicker();
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
        accept={CMS_MEDIA_BROWSER_IMAGE_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (file) {
            // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the upload promise.
            void uploadImage(file);
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
  errorId?: string;
  errorMessage?: string | null;
  fieldId: string;
  fieldKey: string;
  label: string;
  required?: boolean;
}) {
  const t = useTranslations('AdminCatalogResource');
  const { data: sessionData } = authClient.useSession();
  const signedInUserId =
    sessionData?.user && typeof sessionData.user.id === 'string'
      ? sessionData.user.id
      : null;
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    try {
      const loaded = await loadCmsMediaAssets({
        userId: signedInUserId,
      });
      if (!loaded.ok) {
        setMediaError(loaded.failure.error || t('rich_text_media_error'));
        return;
      }
      setAssets(
        loaded.assets.filter(
          (asset) =>
            isAdminImagePath(asset.publicPath) ||
            isAdminVideoPath(asset.publicPath)
        )
      );
      setPickerOpen(true);
    } catch (error: unknown) {
      setMediaError(
        error instanceof Error ? error.message : t('rich_text_media_error')
      );
    } finally {
      setMediaBusy(false);
    }
  }

  async function uploadImage(file: File) {
    setMediaBusy(true);
    setMediaError(null);
    try {
      const result = await uploadCmsMediaFile({
        file,
        userId: signedInUserId,
      });
      if (!result.ok) {
        if ('formError' in result) {
          setMediaError(
            result.formError === 'too_large'
              ? t('rich_text_media_too_large')
              : t('rich_text_media_unsupported_type')
          );
          return;
        }
        setMediaError(result.failure.error || t('rich_text_media_error'));
        return;
      }
      if (
        !(
          isAdminImagePath(result.asset.publicPath) ||
          isAdminVideoPath(result.asset.publicPath)
        )
      ) {
        setMediaError(t('rich_text_media_error'));
        return;
      }
      addImage(result.asset.publicPath);
    } catch (error: unknown) {
      setMediaError(
        error instanceof Error ? error.message : t('rich_text_media_error')
      );
    } finally {
      setMediaBusy(false);
    }
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
    <div className="flex flex-col gap-2 text-sm">
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
          aria-describedby={props.errorMessage ? props.errorId : undefined}
          aria-invalid={ariaInvalidWhenShown({
            shown: Boolean(props.errorMessage),
            invalid: true,
          })}
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
          aria-describedby={props.errorMessage ? props.errorId : undefined}
          aria-invalid={ariaInvalidWhenShown({
            shown: Boolean(props.errorMessage),
            invalid: true,
          })}
          disabled={mediaBusy}
          onClick={() => {
            // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the picker promise.
            void openPicker();
          }}
          type="button"
          variant="outline"
        >
          <ImageIcon aria-hidden size={16} />
          {t('media_select')}
        </Button>
      </div>
      <input
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
        className="sr-only"
        data-testid={
          props.fieldKey === 'imagePaths'
            ? 'sailing-class-gallery-upload'
            : `${props.fieldKey}-upload`
        }
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (file) {
            // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the upload promise.
            void uploadImage(file);
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
            if (
              isAdminImagePath(asset.publicPath) ||
              isAdminVideoPath(asset.publicPath)
            ) {
              addImage(asset.publicPath);
            }
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
