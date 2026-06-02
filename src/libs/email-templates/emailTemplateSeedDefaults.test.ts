import { describe, expect, it } from 'vitest';
import { editableEmailTemplateKeys } from '@/libs/email-templates/emailTemplateKeys';
import { defaultEmailTemplateRevisions } from '@/libs/email-templates/emailTemplateSeedDefaults';

function compareStrings(left: string, right: string) {
  return left.localeCompare(right);
}

describe('defaultEmailTemplateRevisions', () => {
  it('provides one default for every editable V1 template', () => {
    expect(
      defaultEmailTemplateRevisions
        .map((item) => item.key)
        .toSorted(compareStrings)
    ).toEqual([...editableEmailTemplateKeys].toSorted(compareStrings));
  });

  it('keeps each default publishable', () => {
    for (const item of defaultEmailTemplateRevisions) {
      expect(item.subject.length).toBeGreaterThan(0);
      expect(item.previewText.length).toBeGreaterThan(0);
      expect(item.editorBodyHtml.length).toBeGreaterThan(0);
      expect(item.renderedText.length).toBeGreaterThan(0);
    }
  });
});
