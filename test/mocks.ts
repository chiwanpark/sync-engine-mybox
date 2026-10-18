import { vi } from 'vitest';
import ObsidianMock from './obsidian-mock';

Object.assign(globalThis, { window: globalThis });
vi.mock('obsidian', () => ObsidianMock);
