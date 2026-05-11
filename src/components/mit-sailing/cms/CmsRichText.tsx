import { cn } from '@/lib/utils';
import { sanitizeCmsRichTextHtml } from '@/libs/mit-sailing/cmsRichText';

type CmsRichTextProps = {
  className?: string;
} & (
  | { html: string | null | undefined; sanitizedHtml?: undefined }
  | { html?: undefined; sanitizedHtml: string }
);

export function CmsRichText(props: CmsRichTextProps) {
  const html = props.sanitizedHtml ?? sanitizeCmsRichTextHtml(props.html);
  if (!html) {
    return null;
  }
  return (
    <div
      className={cn('cms-rich-text', props.className)}
      // eslint-disable-next-line react/no-danger -- sanitized CMS rich text subset
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
