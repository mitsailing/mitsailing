import { NextResponse } from 'next/server';
import { MIT_WEATHER_TXT_URL } from '@/lib/mitWeatherConstants';
import { fetchWeatherHeaderData } from '@/lib/weather';

const cacheSeconds = 900;

export const runtime = 'nodejs';

export async function GET() {
  const weather = await fetchWeatherHeaderData();
  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      cacheSeconds,
      source: {
        name: 'First-party MIT Sailing collected weather data',
        url: MIT_WEATHER_TXT_URL,
        updatedAt: weather.sourceTimestamp ?? null,
      },
      status: weather.isFallback ? 'unavailable' : 'available',
      conditions: {
        wind: weather.windText,
        air: weather.airText,
        water: weather.waterText,
        sunset: weather.sunsetText,
      },
    },
    {
      headers: {
        'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=600`,
      },
    }
  );
}
