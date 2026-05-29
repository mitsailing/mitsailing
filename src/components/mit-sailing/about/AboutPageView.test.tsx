import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AboutPageView } from './AboutPageView';

vi.mock('next/image', () => ({
  default: (props: {
    alt: string;
    className?: string;
    height?: number;
    src: string;
    width?: number;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element -- Test double for `next/image`.
    <img
      alt={props.alt}
      className={props.className}
      height={props.height}
      src={props.src}
      width={props.width}
    />
  ),
}));

describe('AboutPageView', () => {
  it('links visitors to pricing from the membership summary', () => {
    render(<AboutPageView />);

    expect(
      screen.getByRole('heading', { name: 'Pricing and sailing cards' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'MIT students and MIT Recreation members get full sailing membership included. Pavilion racing and Thursday team racing are paid cards for Charles River racing only.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Full sailing membership')).toBeInTheDocument();
    expect(
      screen.getByText(/Pavilion sailing, classes, ratings/u)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/48-foot Boston Harbor blue-water sailboat/u)
    ).toBeInTheDocument();
    expect(screen.getByText(/Not MIT Sailing Team/u)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See pricing' })).toHaveAttribute(
      'href',
      '/pricing'
    );
  });
});
