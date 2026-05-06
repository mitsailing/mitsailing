'use client';

import { useTranslations } from 'next-intl';
import type { KeyboardEvent } from 'react';
import type { AdminUploadListItem } from '@/components/mit-sailing/admin/catalog/adminRichTextMediaLibrary';

type MediaListPhase = 'idle' | 'loading' | 'loadingMore' | 'ready' | 'error';

type AdminRichTextMediaLibraryModalProps = {
  fieldId: string;
  open: boolean;
  onClose: () => void;
  items: AdminUploadListItem[];
  nextCursor: string | null;
  phase: MediaListPhase;
  onLoadMore: () => void;
  onPick: (item: AdminUploadListItem) => void;
};

const dialogButtonClassName =
  'rounded-md px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:outline-none';

function MediaLibraryThumbnail(props: {
  item: AdminUploadListItem;
  pickLabel: string;
  onPick: (item: AdminUploadListItem) => void;
}) {
  return (
    <button
      aria-label={props.pickLabel}
      className="overflow-hidden rounded border border-slate-200 bg-slate-50 hover:bg-mit-red-highlight focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:outline-none"
      onClick={() => {
        props.onPick(props.item);
      }}
      type="button"
    >
      {/* Same-origin session-gated URLs; avoid next/image without explicit remotePatterns */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        className="h-24 w-full object-cover"
        height={96}
        loading="lazy"
        src={props.item.url}
        width={160}
      />
    </button>
  );
}

function MediaLibraryBody(props: {
  items: AdminUploadListItem[];
  phase: MediaListPhase;
  pickLabel: string;
  emptyLabel: string;
  onPick: (item: AdminUploadListItem) => void;
}) {
  if (props.phase === 'loading') {
    return null;
  }
  if (props.phase === 'error') {
    return null;
  }
  if (props.phase !== 'ready' && props.phase !== 'loadingMore') {
    return null;
  }
  if (props.items.length === 0) {
    return <p className="text-center text-mit-text">{props.emptyLabel}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {props.items.map((item) => (
        <MediaLibraryThumbnail
          item={item}
          key={item.id}
          onPick={props.onPick}
          pickLabel={props.pickLabel}
        />
      ))}
    </div>
  );
}

/**
 * Modal to browse prior CMS uploads and insert an image URL into the editor.
 *
 * @param props - Open state, items, pagination, and callbacks
 * @returns Modal overlay when `open`, otherwise `null`
 */
export function AdminRichTextMediaLibraryModal(
  props: AdminRichTextMediaLibraryModalProps
) {
  const t = useTranslations('AdminRichText');

  if (!props.open) {
    return null;
  }

  function onOverlayKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      props.onClose();
    }
  }

  const showLoadMore =
    props.nextCursor !== null &&
    props.phase !== 'loading' &&
    props.items.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={props.onClose}
      onKeyDown={onOverlayKeyDown}
      role="presentation"
    >
      <div
        aria-labelledby={`${props.fieldId}-media-dialog-title`}
        aria-modal
        className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg border border-slate-200 bg-white shadow-lg"
        onClick={(event) => {
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
        }}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h3
            className="font-semibold text-mit-text"
            id={`${props.fieldId}-media-dialog-title`}
          >
            {t('media_library_title')}
          </h3>
          <button
            className={`${dialogButtonClassName} border border-slate-300 bg-white hover:bg-mit-red-highlight`}
            onClick={props.onClose}
            type="button"
          >
            {t('media_library_close')}
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {props.phase === 'loading' ? (
            <p className="text-center text-mit-text">
              {t('media_library_loading')}
            </p>
          ) : null}
          {props.phase === 'error' ? (
            <p className="text-center text-mit-text" role="alert">
              {t('media_library_error')}
            </p>
          ) : null}
          <MediaLibraryBody
            emptyLabel={t('media_library_empty')}
            items={props.items}
            onPick={props.onPick}
            phase={props.phase}
            pickLabel={t('media_library_insert_aria')}
          />
          {showLoadMore ? (
            <div className="flex justify-center border-t border-slate-200 pt-3">
              <button
                className={`${dialogButtonClassName} border border-slate-300 bg-white hover:bg-mit-red-highlight disabled:opacity-50`}
                disabled={props.phase === 'loadingMore'}
                onClick={props.onLoadMore}
                type="button"
              >
                {props.phase === 'loadingMore'
                  ? t('media_library_loading_more')
                  : t('media_library_load_more')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
