import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { tierSettings } from '@/lib/qualityTier';

import { COURIER } from '../journey/courier';
import { SCENES } from '../scenes/registry';

import { buildDracoWorker } from '../../../scripts/draco-worker.mjs';

import { DRACO_FILES, manifestBytes, MODELS, modelManifest } from './assets';

const root = path.resolve(__dirname, '../../..');
/** Where each served file comes from (scripts/sync-public-assets.mjs). */
const SOURCES: Record<string, string> = {
  [MODELS.mark]: 'design/brand/3d/mark.glb',
  [DRACO_FILES.wasm]: 'node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm',
};

/**
 * three.js, R3F, the World and the three scene chunks, gzipped: 275 KB fetched after the first
 * scroll in the phase 8 build (docs/qa/phase-08/world/README.md), rounded up. The share of the
 * WebGL budget the files below must leave free.
 */
const SCENE_JS_KB = 280;

describe('world assets', () => {
  it('AS1 the manifest bytes are the gzip transfer of the real files', () => {
    const sources: Record<string, Buffer> = Object.fromEntries(
      Object.entries(SOURCES).map(([url, file]) => [url, readFileSync(path.join(root, file))]),
    );
    sources[DRACO_FILES.worker] = Buffer.from(buildDracoWorker(root) as string);
    for (const [url, bytes] of Object.entries(sources)) {
      const entry = modelManifest('mark').find((item) => item.url === url);
      expect(entry?.bytes, url).toBe(gzipSync(bytes).length);
    }
  });

  it('AS2 every tier stays within its WebGL budget with the scene JS (section 4)', () => {
    for (const tier of [1, 2, 3] as const) {
      const manifests = SCENES.flatMap((scene) => {
        const webgl = scene.webgl;
        if (!webgl?.assets || tier < webgl.minTier) return [];
        return [webgl.assets(tier)];
      });
      // The courier of the journey (docs/experience/journey.md section 6) at tiers 2 and 3.
      if (tier >= COURIER.minTier) manifests.push(COURIER.assets());
      const budget = tierSettings(tier, { width: 1440, height: 900, dpr: 1 }, true);
      const kb = manifestBytes(manifests) / 1024 + SCENE_JS_KB;
      expect(kb, `tier ${tier}`).toBeLessThanOrEqual(budget.webglAssetBudgetKB);
    }
  });

  it('AS3 shared files count once', () => {
    const one = COURIER.assets();
    expect(manifestBytes([one, one])).toBe(manifestBytes([one]));
  });
});
