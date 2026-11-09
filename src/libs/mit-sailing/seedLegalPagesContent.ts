import {
  participationTermsHtml,
  participationTermsHtmlTitle,
} from '@/data/mit-sailing/participationTermsHtml';
import { logger } from '@/libs/Logger';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';
import { lexicalFromHtml } from '@/libs/payload/lexicalFromHtml';

function sampleSectionsToHtml(
  sections: {
    title: string;
    body: string;
    subtitle?: string;
  }[]
): string {
  return sections
    .map((section) => {
      const subtitle = section.subtitle
        ? `<p><em>${section.subtitle}</em></p>`
        : '';
      const paragraphs = section.body
        .split(/\n\n+/)
        .map((part) => `<p>${part.replaceAll('\n', '<br/>')}</p>`)
        .join('');
      return `<h2>${section.title}</h2>${subtitle}${paragraphs}`;
    })
    .join('\n');
}

const PRIVACY_HTML = sampleSectionsToHtml([
  {
    title: 'Privacy',
    subtitle: 'Sample content',
    body: 'Sample content: This page describes how MIT Sailing may collect, use, and manage information for website visitors, class participants, volunteers, and event guests.',
  },
  {
    title: 'Information we collect',
    subtitle: 'Sample content',
    body: 'We may collect information that you provide when you register for programs, contact the Pavilion, make a donation inquiry, or sign up for updates. This may include your name, email address, MIT affiliation, program interests, and messages sent through site forms.\n\nWe may also collect basic technical information, such as browser type, device information, referring pages, and pages visited, to help keep the website reliable and useful.',
  },
  {
    title: 'How we use information',
    subtitle: 'Sample content',
    body: 'We use information to respond to requests, coordinate classes and events, maintain safety and membership records, improve website content, and support MIT Sailing operations.\n\nWe do not use sample website content as legal guidance. Production privacy language should be reviewed by the appropriate MIT offices before publication.',
  },
  {
    title: 'Questions and update requests',
    subtitle: 'Sample content',
    body: 'If you have questions about information associated with MIT Sailing programs, contact the Pavilion staff. We will route requests to the appropriate team when records are managed by another MIT office or service provider.',
  },
]);

const ACCESSIBILITY_HTML = sampleSectionsToHtml([
  {
    title: 'Accessibility',
    subtitle: 'Sample content',
    body: 'Sample content: MIT Sailing aims to make website content, program information, and Pavilion communications usable by as many people as possible.',
  },
  {
    title: 'Our commitment',
    subtitle: 'Sample content',
    body: 'We strive to maintain clear navigation, readable content, keyboard-accessible controls, meaningful page structure, and useful alternative text for important images.\n\nAccessibility is an ongoing practice, and we welcome feedback when something on the site is difficult to use.',
  },
  {
    title: 'Access needs for programs',
    subtitle: 'Sample content',
    body: 'If you plan to attend a class, event, meeting, or Pavilion activity and have access needs, contact Pavilion staff as early as possible. We will work with you and MIT resources to identify reasonable options based on the activity, facility, and safety requirements.',
  },
  {
    title: 'Website feedback',
    subtitle: 'Sample content',
    body: 'To report an accessibility issue with the MIT Sailing website, include the page URL, a short description of the problem, and the browser or assistive technology you were using if that information is available.',
  },
]);

const LEGAL_PAGE_SEEDS = [
  {
    slug: 'terms',
    title: participationTermsHtmlTitle,
    html: participationTermsHtml,
  },
  {
    slug: 'privacy',
    title: 'Privacy',
    html: PRIVACY_HTML,
  },
  {
    slug: 'accessibility',
    title: 'Accessibility',
    html: ACCESSIBILITY_HTML,
  },
] as const;

async function ensureLegalPage(options: {
  html: string;
  slug: string;
  title: string;
}): Promise<void> {
  const payload = await getPayloadClient();
  const existing = await payload.find({
    collection: 'pages',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      or: [
        { slug: { equals: options.slug } },
        { slug: { equals: `/${options.slug}` } },
      ],
    },
  });
  if (existing.docs.length > 0) {
    const [doc] = existing.docs;
    const title = typeof doc?.title === 'string' ? doc.title.trim() : '';
    const hasBody = Boolean(doc?.body);
    if (title.length > 0 && hasBody) {
      return;
    }
    if (doc) {
      const body = await lexicalFromHtml(options.html);
      await payload.update({
        collection: 'pages',
        id: doc.id,
        data: {
          body,
          slug: options.slug,
          title: options.title,
          _status: 'published',
        },
        draft: false,
        overrideAccess: true,
      });
      return;
    }
  }
  const body = await lexicalFromHtml(options.html);
  await payload.create({
    collection: 'pages',
    data: {
      body,
      slug: options.slug,
      title: options.title,
      _status: 'published',
    },
    draft: false,
    overrideAccess: true,
  });
}

/**
 * Seeds `/terms`, `/privacy`, and `/accessibility` when those slugs are blank.
 */
export async function ensureLegalPagesContentSeed(): Promise<void> {
  for (const page of LEGAL_PAGE_SEEDS) {
    await ensureLegalPage(page);
  }
}

let legalSeedChecked = false;

/**
 * Runs {@link ensureLegalPagesContentSeed} and logs failures without hiding page copy.
 */
export async function ensureLegalPagesContentSeedSafely(): Promise<void> {
  if (legalSeedChecked) {
    return;
  }
  try {
    await ensureLegalPagesContentSeed();
    legalSeedChecked = true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to seed legal pages: ${message}`);
  }
}
