import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PavilionReservationListingMedia } from '@/components/mit-sailing/pavilion-reservations/PavilionReservationListingMedia';

vi.mock('next/image', () => ({
  default: (props: { alt: string; className?: string }) => (
    <span className={props.className} data-alt={props.alt} />
  ),
}));

const media = [
  {
    id: 'photo-1',
    publicPath: '/photos/one.jpg',
    mediaKind: 'image' as const,
    caption: null,
    displayOrder: 1,
  },
  {
    id: 'photo-2',
    publicPath: '/photos/two.jpg',
    mediaKind: 'image' as const,
    caption: null,
    displayOrder: 2,
  },
];

function renderStrip() {
  const onOpen = vi.fn();
  render(
    <PavilionReservationListingMedia
      alt="Casual dock"
      fallbackImageUrl={null}
      media={media}
      onOpen={onOpen}
      onShare={vi.fn()}
      shareLabel="Share"
      spaceSlug="casual_dock"
    />
  );
  return onOpen;
}

function photoStrip() {
  return screen.getByRole('group', { name: 'Photos of Casual dock' });
}

function openPhotoButton() {
  return screen.getByRole('button', { name: /Open photo/ });
}

describe('PavilionReservationListingMedia', () => {
  it('opens the photo on a tap', () => {
    const onOpen = renderStrip();

    fireEvent.click(openPhotoButton());

    expect(onOpen).toHaveBeenCalledWith('photo-1');
  });

  it('skips the photo open after a swipe click', () => {
    const onOpen = renderStrip();
    const strip = photoStrip();

    fireEvent.pointerDown(strip, { clientX: 0 });
    fireEvent.pointerUp(strip, { clientX: 80 });
    fireEvent.click(openPhotoButton());

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('opens the photo after a swipe that never clicks', () => {
    const onOpen = renderStrip();
    const strip = photoStrip();

    fireEvent.pointerDown(strip, { clientX: 0 });
    fireEvent.pointerUp(strip, { clientX: 80 });
    fireEvent.pointerDown(strip, { clientX: 10 });
    fireEvent.pointerUp(strip, { clientX: 12 });
    fireEvent.click(openPhotoButton());

    expect(onOpen).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledWith('photo-2');
  });
});
