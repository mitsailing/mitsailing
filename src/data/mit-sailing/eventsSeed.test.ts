import { describe, expect, it } from 'vitest';
import { STUB_USERS } from './eventsSeed';

describe('eventsSeed', () => {
  it('sets username initials from name', () => {
    const user = STUB_USERS.find((stubUser) => stubUser.id === 'username');

    expect(user).toMatchObject({
      name: 'Username',
      initials: 'U',
    });
  });
});
