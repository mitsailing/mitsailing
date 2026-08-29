/**
 * Public MIT Pavilion weather plaintext feed.
 * Prefer HTTP: MIT's Apache serves an incomplete TLS chain that Node cannot verify.
 * Keep in sync with [`fetchWeatherHeaderData`](./weather.ts).
 */
export const MIT_WEATHER_TXT_URL =
  'http://sailing.mit.edu/weather/weather.txt' as const;
