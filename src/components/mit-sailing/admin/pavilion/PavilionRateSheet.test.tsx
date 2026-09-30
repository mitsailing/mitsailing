import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PavilionRateSheet } from '@/components/mit-sailing/admin/pavilion/PavilionRateSheet';
import { pavilionRateSheetIdleState } from '@/libs/admin/pavilion-reservations/pavilionRateSheet';
import type { PavilionRateDraft } from '@/libs/admin/pavilion-reservations/pavilionRateSheet';

const dock: PavilionRateDraft = {
  amounts: {
    mit_academic: '320',
    mit_community: '',
    mit_student: '200',
    non_mit: '580',
  },
  group: 'venue',
  id: 'dock',
  isVisible: true,
  minDurationHours: '1',
  name: 'Casual dock',
  pricingType: 'hourly',
};

async function idleRateSheetAction() {
  await Promise.resolve();
  return pavilionRateSheetIdleState;
}

const grill: PavilionRateDraft = {
  amounts: {
    mit_academic: '30',
    mit_community: '30',
    mit_student: '30',
    non_mit: '30',
  },
  group: 'venue',
  id: 'grill',
  isVisible: true,
  minDurationHours: '',
  name: 'Barbecue grill',
  pricingType: 'flat',
};

describe('PavilionRateSheet', () => {
  it('shows the space name beside an empty on-request price', () => {
    render(<PavilionRateSheet action={idleRateSheetAction} rows={[dock]} />);

    expect(
      screen.getByRole('heading', { name: 'Casual dock' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Casual dock MIT community' })
    ).toHaveAttribute('placeholder', 'On request');
  });

  it('copies the academic amount to the other audiences', async () => {
    const user = userEvent.setup();
    render(<PavilionRateSheet action={idleRateSheetAction} rows={[dock]} />);

    await user.click(
      screen.getByRole('button', {
        name: 'Casual dock Same for all audiences',
      })
    );

    expect(
      screen.getByRole('textbox', { name: 'Casual dock MIT student' })
    ).toHaveValue('320');
  });

  it('hides minimum hours for a flat fee', () => {
    render(<PavilionRateSheet action={idleRateSheetAction} rows={[grill]} />);

    expect(
      screen.queryByRole('textbox', { name: 'Barbecue grill Minimum hours' })
    ).not.toBeInTheDocument();
  });
});
