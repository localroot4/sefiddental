// Setup for the Vitest `dom` project (jsdom). Vitest globals are off, so Testing Library cannot
// register its own cleanup: unmount every rendered tree after each test here.
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
