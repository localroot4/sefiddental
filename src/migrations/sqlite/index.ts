import * as migration_20261013_184831_initial from './20261013_184831_initial';

export const migrations = [
  {
    up: migration_20261013_184831_initial.up,
    down: migration_20261013_184831_initial.down,
    name: '20261013_184831_initial'
  },
];
