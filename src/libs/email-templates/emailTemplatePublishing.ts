import { editableEmailTemplateKeys } from '@/libs/email-templates/emailTemplateKeys';
import type { EditableEmailTemplateKey } from '@/libs/email-templates/emailTemplateKeys';

const editableEmailTemplateKeySet: ReadonlySet<string> = new Set(
  editableEmailTemplateKeys
);

type RevisionStatus = 'archived' | 'draft' | 'published';

type PublishableRevision = Readonly<{
  id: string;
  publishedAt: Date | null;
  status: RevisionStatus;
}>;

type PublishedRevision<TRevision extends PublishableRevision> = TRevision &
  Readonly<{ publishedAt: Date; status: 'published' }>;

function isPublishedRevision<TRevision extends PublishableRevision>(
  revision: TRevision
): revision is PublishedRevision<TRevision> {
  return revision.status === 'published' && revision.publishedAt !== null;
}

export function isEditableEmailTemplateKey(
  value: string
): value is EditableEmailTemplateKey {
  return editableEmailTemplateKeySet.has(value);
}

export function choosePublishedRevision<TRevision extends PublishableRevision>(
  revisions: readonly TRevision[]
): TRevision | null {
  const published = revisions.filter(isPublishedRevision);
  return (
    published.toSorted(
      (left, right) => right.publishedAt.getTime() - left.publishedAt.getTime()
    )[0] ?? null
  );
}
