import { describe, expect, it } from 'vitest';
import {
  parseCmsHomeOverviewBody,
  serializeCmsHomeOverviewBody,
} from '@/libs/mit-sailing/cmsHomeOverview';
import {
  cmsBlockInputSchema,
  cmsMenuItemInputSchema,
  cmsPageInputSchema,
  validateCmsMenuTree,
} from '@/libs/mit-sailing/cmsValidation';

describe('cms page validation', () => {
  it('normalizes internal page paths with trailing slashes', () => {
    const parsed = cmsPageInputSchema.parse({
      slug: 'about',
      path: '/about///',
      title: 'About',
      metaTitle: 'About',
      metaDescription: 'About MIT Sailing',
      isPublished: true,
    });

    expect(parsed.path).toBe('/about');
  });

  it('rejects protocol-relative paths', () => {
    const parsed = cmsPageInputSchema.safeParse({
      slug: 'bad',
      path: '//evil.test',
      title: 'Bad',
      metaTitle: 'Bad',
      metaDescription: 'Bad page',
      isPublished: true,
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects traversal and backslash paths', () => {
    for (const path of ['/about/../admin', '/about/.', '/\\evil.com']) {
      const parsed = cmsPageInputSchema.safeParse({
        slug: 'bad',
        path,
        title: 'Bad',
        metaTitle: 'Bad',
        metaDescription: 'Bad page',
        isPublished: true,
      });

      expect(parsed.success).toBe(false);
    }
  });
});

describe('cms block validation', () => {
  it('accepts complete optional groups', () => {
    const parsed = cmsBlockInputSchema.safeParse({
      pageId: 'page-1',
      kind: 'hero',
      title: 'Hero',
      ctaLabel: 'Classes',
      ctaUrl: '/classes',
      imageSrc: '/assets/images/home-hero-charles-sailing.jpg',
      imageAlt: 'Sailboats on the Charles',
      isVisible: true,
    });

    expect(parsed.success).toBe(true);
  });

  it('normalizes internal CTA URLs with trailing slashes', () => {
    const parsed = cmsBlockInputSchema.parse({
      pageId: 'page-1',
      kind: 'hero',
      title: 'Hero',
      ctaLabel: 'Classes',
      ctaUrl: '/classes/',
      imageSrc: '/assets/images/home-hero-charles-sailing.jpg',
      imageAlt: 'Sailboats on the Charles',
      isVisible: true,
    });

    expect(parsed.ctaUrl).toBe('/classes');
  });

  it('accepts contact CTA URLs', () => {
    for (const ctaUrl of ['mailto:sailing@mit.edu', 'tel:+16172534880']) {
      const parsed = cmsBlockInputSchema.parse({
        pageId: 'page-1',
        kind: 'hero',
        title: 'Hero',
        ctaLabel: 'Contact',
        ctaUrl,
        isVisible: true,
      });

      expect(parsed.ctaUrl).toBe(ctaUrl);
    }
  });

  it('preserves internal CTA query and fragment text', () => {
    const ctaUrl = '/classes/?next=/membership/#/';
    const parsed = cmsBlockInputSchema.parse({
      pageId: 'page-1',
      kind: 'hero',
      title: 'Hero',
      ctaLabel: 'Classes',
      ctaUrl,
      isVisible: true,
    });

    expect(parsed.ctaUrl).toBe('/classes?next=/membership/#/');
  });

  it('rejects unsafe image paths', () => {
    const parsed = cmsBlockInputSchema.safeParse({
      pageId: 'page-1',
      kind: 'hero',
      title: 'Hero',
      imageSrc: '/assets/../secret.jpg',
      imageAlt: 'Secret',
      isVisible: true,
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects partial optional groups', () => {
    const parsed = cmsBlockInputSchema.safeParse({
      pageId: 'page-1',
      kind: 'hero',
      title: 'Hero',
      ctaLabel: 'Classes',
      imageSrc: '/assets/images/home-hero-charles-sailing.jpg',
      isVisible: true,
    });

    expect(parsed.success).toBe(false);
  });

  it('clears optional group fields when toggles are off', () => {
    const parsed = cmsBlockInputSchema.parse({
      pageId: 'page-1',
      kind: 'hero',
      title: 'Hero',
      ctaLabel: 'Classes',
      ctaUrl: `${['java', 'script'].join('')}:alert(1)`,
      showCta: false,
      imageSrc: '/assets/../secret.jpg',
      imageAlt: 'Alt',
      showImage: false,
      isVisible: true,
    });

    expect(parsed.ctaLabel).toBeUndefined();
    expect(parsed.ctaUrl).toBeUndefined();
    expect(parsed.showCta).toBe(false);
    expect(parsed.imageSrc).toBeUndefined();
    expect(parsed.imageAlt).toBeUndefined();
    expect(parsed.showImage).toBe(false);
  });

  it('accepts pricing blocks with one option', () => {
    const parsed = cmsBlockInputSchema.safeParse({
      pageId: 'page-1',
      kind: 'pricing',
      title: 'Membership',
      body: JSON.stringify({
        plans: [
          {
            title: 'Students',
            price: 'Free',
            features: ['Full access to all boats'],
          },
        ],
      }),
      isVisible: true,
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects pricing blocks with more than four options', () => {
    const parsed = cmsBlockInputSchema.safeParse({
      pageId: 'page-1',
      kind: 'pricing',
      title: 'Membership',
      body: JSON.stringify({
        plans: Array.from({ length: 5 }, (_value, index) => ({
          title: `Option ${index + 1}`,
          price: '$10',
          features: ['Full access to all boats'],
        })),
      }),
      isVisible: true,
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects malformed pricing block options', () => {
    const parsed = cmsBlockInputSchema.safeParse({
      pageId: 'page-1',
      kind: 'pricing',
      title: 'Membership',
      body: JSON.stringify({
        plans: [
          {
            title: 'Students',
            price: 'Free',
            features: ['Full access to all boats', ''],
          },
        ],
      }),
      isVisible: true,
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts home overview blocks with structured panels', () => {
    const parsed = cmsBlockInputSchema.safeParse({
      pageId: 'page-1',
      kind: 'home_overview',
      title: 'Pavilion Hours',
      subtitle: 'Open 7 days a week',
      body: JSON.stringify({
        hoursNote: 'Hours follow sunset.',
        schedule: [{ day: 'Monday', hours: 'Noon – Sunset' }],
        stepsTitle: 'How to get on the water',
        steps: [
          {
            title: 'Create your account',
            description: 'Sign in before you sail.',
          },
        ],
        eventsTitle: 'Upcoming Events',
        eventCount: 4,
        eventsEmptyText: 'No events scheduled.',
        eventsCtaLabel: 'View all events',
        eventsCtaUrl: '/events',
      }),
      isVisible: true,
    });

    expect(parsed.success).toBe(true);
  });

  it('accepts home overview blocks with empty events text', () => {
    const parsed = cmsBlockInputSchema.safeParse({
      pageId: 'page-1',
      kind: 'home_overview',
      title: 'Pavilion Hours',
      body: JSON.stringify({
        schedule: [{ day: 'Monday', hours: 'Noon – Sunset' }],
        stepsTitle: 'How to get on the water',
        steps: [
          {
            title: 'Create your account',
            description: 'Sign in before you sail.',
          },
        ],
        eventsTitle: 'Upcoming Events',
        eventCount: 4,
        eventsEmptyText: '',
        eventsCtaLabel: 'View all events',
        eventsCtaUrl: '/events',
      }),
      isVisible: true,
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects home overview blocks without steps', () => {
    const parsed = cmsBlockInputSchema.safeParse({
      pageId: 'page-1',
      kind: 'home_overview',
      title: 'Pavilion Hours',
      body: JSON.stringify({
        schedule: [{ day: 'Monday', hours: 'Noon – Sunset' }],
        stepsTitle: 'How to get on the water',
        steps: [],
        eventsTitle: 'Upcoming Events',
        eventCount: 4,
        eventsEmptyText: 'No events scheduled.',
        eventsCtaLabel: 'View all events',
        eventsCtaUrl: '/events',
      }),
      isVisible: true,
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects malformed home overview rows', () => {
    const parsed = cmsBlockInputSchema.safeParse({
      pageId: 'page-1',
      kind: 'home_overview',
      title: 'Pavilion Hours',
      body: JSON.stringify({
        schedule: [{ day: 'Monday', hours: 'Noon – Sunset' }, { day: '' }],
        stepsTitle: 'How to get on the water',
        steps: [
          {
            title: 'Create your account',
            description: 'Sign in before you sail.',
          },
        ],
        eventsTitle: 'Upcoming Events',
        eventCount: 4,
        eventsEmptyText: 'No events scheduled.',
        eventsCtaLabel: 'View all events',
        eventsCtaUrl: '/events',
      }),
      isVisible: true,
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects unsafe home overview events cta urls', () => {
    const parsed = cmsBlockInputSchema.safeParse({
      pageId: 'page-1',
      kind: 'home_overview',
      title: 'Pavilion Hours',
      body: JSON.stringify({
        schedule: [{ day: 'Monday', hours: 'Noon – Sunset' }],
        stepsTitle: 'How to get on the water',
        steps: [
          {
            title: 'Create your account',
            description: 'Sign in before you sail.',
          },
        ],
        eventsTitle: 'Upcoming Events',
        eventCount: 4,
        eventsEmptyText: 'No events scheduled.',
        eventsCtaLabel: 'View all events',
        eventsCtaUrl: ['java', 'script:alert(1)'].join(''),
      }),
      isVisible: true,
    });

    expect(parsed.success).toBe(false);
  });
});

describe('cms home overview body', () => {
  it('serializes overview settings with events cta config', () => {
    const data = {
      hoursNote: '',
      schedule: [{ day: 'Monday', hours: 'Noon – Sunset' }],
      stepsTitle: 'How to get on the water',
      steps: [
        {
          title: 'Create your account',
          description: 'Sign in before you sail.',
        },
      ],
      eventsTitle: 'Upcoming Events',
      eventCount: 3,
      eventsEmptyText: '',
      eventsCtaLabel: 'View all events',
      eventsCtaUrl: '/events',
    };

    const parsed = parseCmsHomeOverviewBody(serializeCmsHomeOverviewBody(data));

    expect(parsed).toEqual({
      hoursNote: undefined,
      schedule: data.schedule,
      stepsTitle: data.stepsTitle,
      steps: data.steps,
      eventsTitle: data.eventsTitle,
      eventCount: data.eventCount,
      eventsEmptyText: data.eventsEmptyText,
      eventsCtaLabel: data.eventsCtaLabel,
      eventsCtaUrl: data.eventsCtaUrl,
    });
  });
});

describe('cms menu item validation', () => {
  it('accepts containers without links', () => {
    const parsed = cmsMenuItemInputSchema.safeParse({
      menuId: 'menu',
      label: 'Footer column',
      isExternal: false,
      isVisible: true,
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects javascript URLs', () => {
    const parsed = cmsMenuItemInputSchema.safeParse({
      menuId: 'menu',
      label: 'Bad',
      url: ['java', 'script:alert(1)'].join(''),
      isExternal: true,
      isVisible: true,
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects unsafe internal URLs', () => {
    for (const url of ['//evil.test', '/\\evil.test', '/about/../admin']) {
      const parsed = cmsMenuItemInputSchema.safeParse({
        menuId: 'menu',
        label: 'Bad',
        url,
        isExternal: false,
        isVisible: true,
      });

      expect(parsed.success).toBe(false);
    }
  });

  it('normalizes internal URLs with trailing slashes', () => {
    const parsed = cmsMenuItemInputSchema.parse({
      menuId: 'menu',
      label: 'About',
      url: '/about/',
      isExternal: false,
      isVisible: true,
    });

    expect(parsed.url).toBe('/about');
  });

  it('normalizes empty optional ids', () => {
    const parsed = cmsMenuItemInputSchema.parse({
      menuId: 'menu',
      parentId: '',
      linkedPageId: '',
      label: 'About',
      url: '/about',
      isExternal: false,
      isVisible: true,
      systemKey: '',
    });

    expect(parsed.parentId).toBeUndefined();
    expect(parsed.linkedPageId).toBeUndefined();
    expect(parsed.systemKey).toBeUndefined();
  });
});

describe('cms menu tree validation', () => {
  it('rejects cycles', () => {
    const result = validateCmsMenuTree([
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: 'a' },
    ]);

    expect(result).toEqual({ ok: false, code: 'cycle' });
  });

  it('rejects missing parents', () => {
    const result = validateCmsMenuTree([{ id: 'a', parentId: 'missing' }]);

    expect(result).toEqual({ ok: false, code: 'missing_parent' });
  });
});
