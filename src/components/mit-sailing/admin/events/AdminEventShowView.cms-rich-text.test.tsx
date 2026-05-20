import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminEventShowDto } from '@/libs/admin/events/eventAdminQueries';
import messages from '@/locales/en.json';
import { AdminEventShowView } from './AdminEventShowView';

type CmsRichTextMockProps = {
  className?: string;
  html?: string | null | undefined;
  sanitizedHtml?: string;
};

const mocks = vi.hoisted(() => ({
  cmsRichText: vi.fn(),
}));

vi.mock('@/components/mit-sailing/cms/CmsRichText', () => ({
  CmsRichText: mocks.cmsRichText,
}));

vi.mock(
  '@/components/mit-sailing/admin/events/AdminEventRegistrationsView',
  () => ({
    AdminEventRegistrationsView: () => <div data-testid="registrations" />,
  })
);

vi.mock('@/libs/admin/events/eventAdminActions', () => ({
  updateAdminEventRegistrationStatusAction: vi.fn(),
}));

vi.mock('@/libs/I18nNavigation', () => ({
  Link: (props: React.ComponentProps<'a'>) => {
    const { children, ...anchorProps } = props;
    return <a {...anchorProps}>{children}</a>;
  },
}));

const t = createTranslator({
  locale: 'en',
  messages,
  namespace: 'AdminEvents',
});

const eventFixture = {
  accessMode: 'editable',
  admins: [],
  category: { id: 'category-1', name: 'Clinic' },
  dates: [],
  description: 'Learn how to sail.',
  detailPageKind: 'standard',
  externalDetailUrl: null,
  externalEntriesUrl: null,
  externalRegistrationUrl: null,
  entryFees: [],
  id: 'event-1',
  isPublished: true,
  isSpecial: false,
  maxParticipants: null,
  name: 'Intro Sail',
  publicContentSections: [],
  registrationCounts: {
    approved: 0,
    cancelled: 0,
    pending: 0,
  },
  registrationEnd: null,
  registrationMode: 'standard',
  registrationStart: null,
  registrations: [],
  requiresApproval: false,
  requiresPhone: false,
  usesTeamRegistration: false,
  boatsPerTeam: 1,
  personsPerBoat: 1,
  allowRepeatTeamCaptain: false,
  shortName: 'Intro',
  slug: 'intro-sail',
  questions: [],
} satisfies AdminEventShowDto;

describe('AdminEventShowView CMS rich text', () => {
  beforeEach(() => {
    mocks.cmsRichText.mockImplementation((props: CmsRichTextMockProps) => (
      <div
        data-html={props.html ?? ''}
        data-sanitized-html={props.sanitizedHtml ?? ''}
        data-testid="cms-rich-text"
      />
    ));
  });

  it('passes public content bodies as sanitized html', () => {
    const body = '<p>Ask the <strong>race desk</strong>.</p>';

    render(
      <AdminEventShowView
        errorCode={null}
        event={{
          ...eventFixture,
          publicContentSections: [
            {
              body,
              id: 'faq',
              titleKey: 'content_faq_title',
            },
          ],
        }}
        filter="all"
        locale="en"
        t={t}
      />
    );

    expect(screen.getByTestId('cms-rich-text')).toHaveAttribute(
      'data-sanitized-html',
      body
    );
    expect(screen.getByTestId('cms-rich-text')).toHaveAttribute(
      'data-html',
      ''
    );
  });
});
