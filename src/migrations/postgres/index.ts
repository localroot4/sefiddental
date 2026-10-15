import * as migration_20261013_184820_initial from './20261013_184820_initial';
import * as migration_20261015_115718_phase4_content from './20261015_115718_phase4_content';

export const migrations = [
  {
    up: migration_20261013_184820_initial.up,
    down: migration_20261013_184820_initial.down,
    name: '20261013_184820_initial',
  },
  {
    up: migration_20261015_115718_phase4_content.up,
    down: migration_20261015_115718_phase4_content.down,
    name: '20261015_115718_phase4_content'
  },
];
