// Browser launch profiles shared by playwright.config.ts and scripts/check-bundle.mjs. Plain
// erasable TypeScript without path aliases: Node imports it directly (type stripping).
import type { LaunchOptions } from '@playwright/test';

/**
 * The container ships Chromium 1194 at a fixed path, while Playwright 1.64 expects revision
 * 1248, so local runs point PW_CHROMIUM_EXECUTABLE at the container binary (freeze decision 13).
 * CI leaves it unset and uses the browser `npx playwright install chromium` downloads.
 */
export function chromiumExecutable(): string | undefined {
  const value = process.env.PW_CHROMIUM_EXECUTABLE?.trim();
  return value ? value : undefined;
}

/** Default launch: the container or CI Chromium, nothing else changed. */
export function defaultLaunch(): LaunchOptions {
  return { executablePath: chromiumExecutable() };
}

/**
 * Software GPU (00-master.md section 6): WebGL on SwiftShader, as on a device whose GPU
 * is blocklisted. The two extra flags keep Chromium from refusing SwiftShader for WebGL.
 */
export const SWIFTSHADER_ARGS: readonly string[] = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

export function swiftShaderLaunch(): LaunchOptions {
  return { ...defaultLaunch(), args: [...SWIFTSHADER_ARGS] };
}

/** No WebGL 2 context: the tier 0 path (no-webgl2 project). */
export function noWebgl2Launch(): LaunchOptions {
  return { ...defaultLaunch(), args: ['--disable-webgl2'] };
}
