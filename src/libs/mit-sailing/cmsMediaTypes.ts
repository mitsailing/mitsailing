export const CMS_MEDIA_KINDS = ['image', 'file', 'video'] as const;

export type CmsMediaKind = (typeof CMS_MEDIA_KINDS)[number];
