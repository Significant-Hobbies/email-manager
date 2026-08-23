import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initApiTiming } from '../api-timing';

describe('api-timing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('no-ops when window is undefined (SSR / node)', () => {
    // Node environment has no window — initApiTiming must return without touching globals.
    expect(() => initApiTiming()).not.toThrow();
  });

  it('starts an interval and registers visibility listener when window exists', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.fn(() => 42);
    const clearIntervalSpy = vi.fn();
    const addEventListenerSpy = vi.fn();

    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    vi.stubGlobal('document', {
      addEventListener: addEventListenerSpy,
      visibilityState: 'visible',
    });
    vi.stubGlobal('setInterval', setIntervalSpy);
    vi.stubGlobal('clearInterval', clearIntervalSpy);

    initApiTiming({ intervalMs: 5000, projectSlug: 'test-project' });

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    // The interval delay should match the configured intervalMs.
    expect(setIntervalSpy.mock.calls[0][1]).toBe(5000);
    expect(addEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('clears a previously installed interval on re-init', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.fn(() => 99);
    const clearIntervalSpy = vi.fn();
    const addEventListenerSpy = vi.fn();

    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    vi.stubGlobal('document', {
      addEventListener: addEventListenerSpy,
      visibilityState: 'visible',
    });
    vi.stubGlobal('setInterval', setIntervalSpy);
    vi.stubGlobal('clearInterval', clearIntervalSpy);

    initApiTiming();
    initApiTiming();
    // Second call should clear the first interval before installing a new one.
    expect(clearIntervalSpy).toHaveBeenCalledWith(99);
  });

  it('applies urlPatterns and projectSlug options without throwing', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
      visibilityState: 'visible',
    });
    vi.stubGlobal(
      'setInterval',
      vi.fn(() => 1)
    );
    vi.stubGlobal('clearInterval', vi.fn());

    expect(() =>
      initApiTiming({
        urlPatterns: [/api\.example\.com/],
        projectSlug: 'custom',
        intervalMs: 10_000,
      })
    ).not.toThrow();
  });
});
