import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /llms.txt', () => {
  it('redirects agents to the MIT Sailing discovery file', () => {
    const response = GET();

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://mitsailing.com/llm.txt'
    );
  });
});
