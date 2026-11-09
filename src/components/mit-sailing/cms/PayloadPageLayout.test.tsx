import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  PayloadPageLayout,
  payloadPageBlocks,
} from '@/components/mit-sailing/cms/PayloadPageLayout';

vi.mock('@/components/mit-sailing/cms/PayloadLexicalRichText', () => ({
  PayloadLexicalRichText: () => <div data-testid="rich-text">Text</div>,
}));

vi.mock('@/libs/I18nNavigation', () => ({
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{props.children}</a>
  ),
}));

const richText = {
  root: {
    children: [],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

const charles = {
  alt: 'Charles River',
  height: 600,
  url: '/cms-media/charles.jpg',
  width: 800,
};

describe('PayloadPageLayout', () => {
  it('returns nothing when the page has no layout blocks', () => {
    const { container } = render(
      <PayloadPageLayout blocks={payloadPageBlocks(null)} />
    );

    expect(container).toBeEmptyDOMElement();
    expect(payloadPageBlocks([])).toEqual([]);
    expect(payloadPageBlocks([{ blockType: 'hero' }])).toEqual([]);
  });

  it('puts the image before the text when alignment is mediaContent', () => {
    render(
      <PayloadPageLayout
        blocks={payloadPageBlocks([
          {
            alignment: 'mediaContent',
            blockType: 'mediaContent',
            enableLink: false,
            id: 'image-first',
            images: [{ image: charles }],
            mediaWidth: 'stretch',
            richText,
          },
        ])}
      />
    );

    const grid = screen.getByTestId('media-content');
    expect(grid).toHaveClass('flex-col', 'md:grid-cols-2');
    expect(grid.firstElementChild).toHaveAttribute(
      'data-testid',
      'media-content-media'
    );
    expect(screen.getByRole('img', { name: 'Charles River' })).toHaveClass(
      'w-full'
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('puts the text before the image and keeps a fit image inside the column', () => {
    render(
      <PayloadPageLayout
        blocks={payloadPageBlocks([
          {
            alignment: 'contentMedia',
            blockType: 'mediaContent',
            enableLink: true,
            id: 'text-first',
            images: [{ image: charles }],
            link: {
              label: 'Visit the pavilion',
              linkType: 'custom',
              url: 'https://example.com/pavilion',
            },
            mediaWidth: 'fit',
            richText,
          },
        ])}
      />
    );

    const grid = screen.getByTestId('media-content');
    expect(grid.firstElementChild).toHaveAttribute(
      'data-testid',
      'media-content-text'
    );
    const fitImage = screen.getByRole('img', { name: 'Charles River' });
    expect(fitImage).toHaveClass('max-w-full');
    expect(fitImage).not.toHaveClass('w-full');
    expect(fitImage).toHaveStyle({ maxWidth: '100%', width: '800px' });
    expect(
      screen.getByRole('link', { name: 'Visit the pavilion' })
    ).toHaveAttribute('href', 'https://example.com/pavilion');
  });

  it('stacks content columns in one row from the md breakpoint', () => {
    const { container } = render(
      <PayloadPageLayout
        blocks={payloadPageBlocks([
          {
            blockType: 'content',
            columns: [
              { id: 'a', richText, size: 'oneThird' },
              { id: 'b', richText, size: 'half' },
              { id: 'c', richText, size: 'twoThirds' },
              { id: 'd', richText, size: 'full' },
            ],
            id: 'columns',
          },
        ])}
      />
    );

    const row = screen.getByTestId('content-columns');
    expect(row).toHaveClass('grid-cols-1', 'md:grid-cols-6');
    expect(container.querySelector('.md\\:col-span-2')).toBeTruthy();
    expect(container.querySelector('.md\\:col-span-3')).toBeTruthy();
    expect(container.querySelector('.md\\:col-span-4')).toBeTruthy();
    expect(container.querySelector('.md\\:col-span-6')).toBeTruthy();
    expect(screen.getAllByTestId('rich-text')).toHaveLength(4);
  });

  it('fills the row with a media image and renders a call to action link', () => {
    render(
      <PayloadPageLayout
        blocks={payloadPageBlocks([
          {
            blockType: 'media',
            id: 'wide',
            media: charles,
          },
          {
            blockType: 'cta',
            id: 'join',
            link: {
              doc: { relationTo: 'pages', value: { slug: 'pricing' } },
              label: 'See pricing',
              linkType: 'internal',
              newTab: true,
            },
            richText,
          },
        ])}
      />
    );

    expect(screen.getByRole('img', { name: 'Charles River' })).toHaveClass(
      'w-full'
    );
    const link = screen.getByRole('link', { name: 'See pricing' });
    expect(link).toHaveAttribute('href', '/pricing');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
