import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];

describe.each([
  'index.html',
  'landing-astro/src/layouts/Layout.astro',
  'landing-astro/src/pages/index.astro',
])('%s Clarity loader', (file) => {
  it.each([...events, 'timeout'])(
    'queues immediately and injects only once after %s',
    (trigger) => {
      const source = readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');
      const script = [...source.matchAll(/<script(?: is:inline)?>([\s\S]*?)<\/script>/g)].find(
        (match) => match[1].includes('window.clarity')
      )?.[1];
      expect(script).toBeDefined();

      const listeners = new Map<string, () => void>();
      const timers: Array<() => void> = [];
      const insertBefore = vi.fn();
      const createElement = vi.fn(() => ({ async: false, src: '' }));
      const removeEventListener = vi.fn((event: string) => listeners.delete(event));
      const addEventListener = vi.fn((event: string, callback: () => void) => {
        listeners.set(event, callback);
      });
      const setTimeout = vi.fn((callback: () => void) => {
        timers.push(callback);
        return 1;
      });
      const clearTimeout = vi.fn();
      const window = {};
      const context = {
        window,
        document: {
          createElement,
          getElementsByTagName: () => [{ parentNode: { insertBefore } }],
        },
        addEventListener,
        removeEventListener,
        setTimeout,
        clearTimeout,
      };
      runInNewContext(script ?? '', context);
      expect(createElement).not.toHaveBeenCalled();
      expect(runInNewContext('Array.from(window.clarity.q[0])', context)).toEqual([
        'set',
        'project_id',
        'email-manager',
      ]);
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 90_000);
      for (const event of events) {
        expect(addEventListener).toHaveBeenCalledWith(event, expect.any(Function), {
          passive: true,
          once: true,
        });
      }

      const callbacks = [...listeners.values(), ...timers];
      if (trigger === 'timeout') timers[0]();
      else listeners.get(trigger)?.();
      expect(insertBefore).toHaveBeenCalledTimes(1);
      expect(createElement.mock.results[0].value).toEqual({
        async: true,
        src: 'https://www.clarity.ms/tag/y6bt70yq9x',
      });
      expect(listeners.size).toBe(0);
      expect(removeEventListener).toHaveBeenCalledTimes(4);
      expect(clearTimeout).toHaveBeenCalledWith(1);
      for (const callback of callbacks) callback();
      expect(insertBefore).toHaveBeenCalledTimes(1);
    }
  );
});
