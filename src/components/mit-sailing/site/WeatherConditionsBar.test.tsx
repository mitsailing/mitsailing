import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/locales/en.json';
import {
  WeatherConditionsBar,
  WeatherConditionsBarSkeleton,
} from './WeatherConditionsBar';
import type { WeatherConditionsBarProps } from './WeatherConditionsBar';

const fetchWeatherHeaderDataMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/weather', () => ({
  fetchWeatherHeaderData: fetchWeatherHeaderDataMock,
}));

const tMitSite: WeatherConditionsBarProps['tMitSite'] = (
  key,
  values: Record<string, string> = {}
) => {
  const message = enMessages.MitSailingSite[key];
  return message.replaceAll(
    /\{(\w+)\}/g,
    (_match, name: string) => values[name] ?? ''
  );
};

const weatherProps: WeatherConditionsBarProps = {
  tMitSite,
};

describe('WeatherConditionsBar', () => {
  beforeEach(() => {
    fetchWeatherHeaderDataMock.mockReset();
  });

  it('renders skeleton placeholders for all weather rows', () => {
    render(<WeatherConditionsBarSkeleton {...weatherProps} />);

    expect(screen.getByText('Wind: —')).toBeVisible();
    expect(screen.getByText('Air: —')).toBeVisible();
    expect(screen.getByText('Water: —')).toBeVisible();
    expect(screen.getByText('Sunset: —')).toBeVisible();
  });

  it('renders fetched values in translated rows', async () => {
    fetchWeatherHeaderDataMock.mockResolvedValue({
      windText: 'ENE @ 10 knots',
      airText: '49.9°F',
      waterText: '57.0°F',
      sunsetText: '7:42pm',
      isFallback: false,
      sourceTimestamp: 'Wed, 01 Jan 2025 00:00:00 GMT',
    });

    render(await WeatherConditionsBar(weatherProps));

    expect(screen.getByText('Wind: ENE @ 10 knots')).toBeVisible();
    expect(screen.getByText('Air: 49.9°F')).toBeVisible();
    expect(screen.getByText('Water: 57.0°F')).toBeVisible();
    expect(screen.getByText('Sunset: 7:42pm')).toBeVisible();
  });

  it('falls back to placeholder for empty or null values', async () => {
    fetchWeatherHeaderDataMock.mockResolvedValue({
      windText: '',
      airText: '   ',
      waterText: null,
      sunsetText: undefined,
      isFallback: true,
      sourceTimestamp: null,
    });

    render(await WeatherConditionsBar(weatherProps));

    expect(screen.getByText('Wind: —')).toBeVisible();
    expect(screen.getByText('Air: —')).toBeVisible();
    expect(screen.getByText('Water: —')).toBeVisible();
    expect(screen.getByText('Sunset: —')).toBeVisible();
  });

  it('renders weather and utility links with accessible destinations', async () => {
    fetchWeatherHeaderDataMock.mockResolvedValue({
      windText: 'calm',
      airText: '50°F',
      waterText: '55°F',
      sunsetText: '6:30pm',
      isFallback: false,
      sourceTimestamp: null,
    });

    render(await WeatherConditionsBar(weatherProps));

    const weatherLink = screen.getByRole('link', {
      name: 'MIT Sailing current weather conditions. Opens in a new tab.',
    });
    expect(weatherLink).toHaveAttribute(
      'href',
      'https://sailing.mit.edu/weather/'
    );
    expect(weatherLink).toHaveAttribute('target', '_blank');
    expect(weatherLink).toHaveAttribute('rel', 'noopener noreferrer');

    expect(
      screen.getByRole('link', { name: 'Reserve Pavilion' })
    ).toHaveAttribute('href', '/contact/');
    expect(screen.getByRole('link', { name: 'Directions' })).toHaveAttribute(
      'href',
      '/contact/'
    );
    expect(screen.getByRole('link', { name: 'Donate' })).toHaveAttribute(
      'href',
      '/donate/'
    );
  });
});
