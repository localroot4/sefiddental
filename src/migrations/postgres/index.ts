import * as migration_20261013_184820_initial from './20261013_184820_initial';
import * as migration_20261015_115718_phase4_content from './20261015_115718_phase4_content';
import * as migration_20261015_231648_phase5_conversion from './20261015_231648_phase5_conversion';
import * as migration_20261016_025729_phase5_security from './20261016_025729_phase5_security';
import * as migration_20261020_162242_phase6_content from './20261020_162242_phase6_content';
import * as migration_20261026_234053_phase7_workflow from './20261026_234053_phase7_workflow';

export const migrations = [
  {
    up: migration_20261013_184820_initial.up,
    down: migration_20261013_184820_initial.down,
    name: '20261013_184820_initial',
  },
  {
    up: migration_20261015_115718_phase4_content.up,
    down: migration_20261015_115718_phase4_content.down,
    name: '20261015_115718_phase4_content',
  },
  {
    up: migration_20261015_231648_phase5_conversion.up,
    down: migration_20261015_231648_phase5_conversion.down,
    name: '20261015_231648_phase5_conversion',
  },
  {
    up: migration_20261016_025729_phase5_security.up,
    down: migration_20261016_025729_phase5_security.down,
    name: '20261016_025729_phase5_security',
  },
  {
    up: migration_20261020_162242_phase6_content.up,
    down: migration_20261020_162242_phase6_content.down,
    name: '20261020_162242_phase6_content',
  },
  {
    up: migration_20261026_234053_phase7_workflow.up,
    down: migration_20261026_234053_phase7_workflow.down,
    name: '20261026_234053_phase7_workflow'
  },
];
