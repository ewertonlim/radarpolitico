import { beforeEach, vi } from 'vitest';

vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
  localStorage.clear();
  globalThis.fetch = vi.fn();
  globalThis.Chart = vi.fn(() => ({ destroy: vi.fn() }));
  globalThis.requestAnimationFrame = vi.fn();
});
