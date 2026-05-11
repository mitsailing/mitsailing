import { cn } from '@/lib/utils';
import { sanitizeCmsRichTextHtml } from '@/libs/mit-sailing/cmsRichText';

export function CmsRichText(props: {
  className?: string;
  html: string | null | undefined;
}) {
  const html = sanitizeCmsRichTextHtml(props.html);
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
