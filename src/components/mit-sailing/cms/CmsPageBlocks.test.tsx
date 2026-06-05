import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type {
  PublicCmsBlock,
  PublicCmsPage,
} from '@/libs/mit-sailing/cmsQueries';
import { CmsPageBlockPreview, CmsPageBlocks } from './CmsPageBlocks';

vi.mock('next/image', () => ({
  default: (props: { alt: string; className?: string; src: string }) =>
    React.createElement('img', {
      alt: props.alt,
      className: props.className,
      src: props.src,
    }),
}));

vi.mock('@/libs/I18nNavigation', () => ({
  Link: (props: {
    children: React.ReactNode;
    className?: string;
    href: string;
  }) => (
    <a className={props.className} href={props.href}>
      {props.children}
    </a>
  ),
}));

type CmsBlockFixtureProps = {
  body?: PublicCmsBlock['body'];
  ctaLabel?: PublicCmsBlock['ctaLabel'];
  ctaUrl?: PublicCmsBlock['ctaUrl'];
  id: PublicCmsBlock['id'];
  imageAlt?: PublicCmsBlock['imageAlt'];
  imageSrc?: PublicCmsBlock['imageSrc'];
  kind: PublicCmsBlock['kind'];
  subtitle?: PublicCmsBlock['subtitle'];
  title: PublicCmsBlock['title'];
};

const defaultBlockBodyText = 'Block body';

function block(props: CmsBlockFixtureProps): PublicCmsBlock {
  return {
    body: defaultBlockBodyText,
    ...props,
  };
}

function page(blocks: PublicCmsBlock[]): PublicCmsPage {
  return {
    blocks,
    id: 'page-1',
    metaDescription: 'CMS page',
    metaTitle: 'CMS Page',
    path: '/cms-page',
    slug: 'cms-page',
    title: 'CMS Page',
  };
}

describe('CmsPageBlocks', () => {
  it('renders hero blocks with images and safe internal calls to action', () => {
    render(
      <CmsPageBlocks
        page={page([
          block({
            ctaLabel: 'Register',
            ctaUrl: '/events/learn-to-sail',
            id: 'hero-1',
            imageAlt: 'Sailboats on the Charles',
            imageSrc: '/cms-media/asset-1/hero.png',
            kind: 'hero',
            subtitle: 'MIT Sailing',
            title: 'Learn to sail',
          }),
        ])}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Learn to sail' })
    ).toBeVisible();
    expect(
      screen.getByRole('img', { name: 'Sailboats on the Charles' })
    ).toHaveAttribute('src', '/cms-media/asset-1/hero.png');
    expect(screen.getByRole('link', { name: /Register/u })).toHaveAttribute(
      'href',
      '/events/learn-to-sail'
    );
    expect(screen.getByText('Block body')).toBeVisible();
  });

  it('renders hero image alt fallback for decorative CMS images', () => {
    const { container } = render(
      <CmsPageBlocks
        page={page([
          block({
            id: 'hero-1',
            imageSrc: '/cms-media/asset-1/hero.png',
            kind: 'hero',
            title: 'Learn to sail',
          }),
        ])}
      />
    );

    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    expect(
      screen.getByRole('heading', { name: 'Learn to sail' })
    ).toBeVisible();
  });

  it('renders plain hero subtitles without requiring media', () => {
    render(
      <CmsPageBlocks
        page={page([
          block({
            id: 'hero-1',
            kind: 'hero',
            subtitle: 'MIT Sailing',
            title: 'About the pavilion',
          }),
        ])}
      />
    );

    expect(screen.getByText('MIT Sailing')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'About the pavilion' })
    ).toBeVisible();
  });

  it('renders text and callout blocks with safe external links', () => {
    const unsafeScriptHref = `${['java', 'script'].join('')}:alert(1)`;

    render(
      <CmsPageBlocks
        page={page([
          block({
            ctaLabel: 'Read guide',
            ctaUrl: 'https://sailing.mit.edu/guide',
            id: 'text-1',
            kind: 'text_section',
            subtitle: 'Classes',
            title: 'Class details',
          }),
          block({
            ctaLabel: 'Unsafe',
            ctaUrl: unsafeScriptHref,
            id: 'callout-1',
            kind: 'callout',
            title: 'Weather notice',
          }),
        ])}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Class details' })
    ).toBeVisible();
    expect(screen.getByRole('link', { name: /Read guide/u })).toHaveAttribute(
      'target',
      '_blank'
    );
    expect(
      screen.getByRole('heading', { name: 'Weather notice' })
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: /Unsafe/u })
    ).not.toBeInTheDocument();
  });

  it('alternates text section backgrounds on long CMS pages', () => {
    render(
      <CmsPageBlocks
        page={page([
          block({
            id: 'text-1',
            kind: 'text_section',
            title: 'Class details',
          }),
          block({
            id: 'text-2',
            kind: 'text_section',
            title: 'Dock details',
          }),
        ])}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Class details' }).closest('section')
    ).toHaveClass('bg-background');
    expect(
      screen.getByRole('heading', { name: 'Dock details' }).closest('section')
    ).toHaveClass('bg-mit-surface');
  });

  it('skips home-owned blocks on generic CMS pages', () => {
    render(
      <CmsPageBlocks
        page={page([
          block({ id: 'overview', kind: 'home_overview', title: 'Overview' }),
          block({ id: 'classes', kind: 'home_classes', title: 'Classes' }),
        ])}
      />
    );

    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Classes')).not.toBeInTheDocument();
  });

  it('previews a pricing block with rendered plan cards', () => {
    render(
      <CmsPageBlockPreview
        block={block({
          body: JSON.stringify({
            plans: [
              {
                features: ['One checkout', 'Season access'],
                linkLabel: 'Join',
                linkUrl: '/membership',
                price: '$25',
                title: 'Student',
              },
            ],
          }),
          id: 'pricing',
          kind: 'pricing',
          title: 'Membership',
        })}
      />
    );

    expect(screen.getByRole('heading', { name: 'Membership' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute(
      'href',
      '/membership'
    );
    expect(screen.getByText('$25')).toBeVisible();
  });
});
