import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /ai', () => {
  it('redirects agents to the discovery file', () => {
    const response = GET();

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://mitsailing.com/llm.txt'
    );
  });
});
