import * as migration_20261109_220241_init_payload from './20261109_220241_init_payload';

export const migrations = [
  {
    up: migration_20261109_220241_init_payload.up,
    down: migration_20261109_220241_init_payload.down,
    name: '20261109_220241_init_payload'
  },
];
