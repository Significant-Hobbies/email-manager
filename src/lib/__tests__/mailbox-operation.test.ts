import { describe, expect, it, vi } from 'vitest';
import { runLockedOperation } from '../mailbox-operation';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function harness() {
  const mounted = { current: true };
  const lock = { current: false };
  const setActive = vi.fn();
  const setProgress = vi.fn();
  const refresh = vi.fn().mockResolvedValue(undefined);
  const run = (operation: () => Promise<unknown>) =>
    runLockedOperation(
      mounted,
      lock,
      setActive,
      setProgress,
      'Preparing search index…',
      'Indexing failed',
      operation,
      refresh
    );
  return { mounted, lock, setActive, setProgress, refresh, run };
}

describe('shared mailbox operation lock', () => {
  it('blocks rapid clicks and competing entry points until completion and refresh settle', async () => {
    const state = harness();
    const indexing = deferred();
    const refreshing = deferred();
    const primaryIndexer = vi.fn(() => indexing.promise);
    const alternateIndexer = vi.fn().mockResolvedValue(undefined);
    state.refresh.mockReturnValue(refreshing.promise);

    const first = state.run(primaryIndexer);
    expect(state.lock.current).toBe(true);
    expect(state.setActive).toHaveBeenLastCalledWith(true);
    await state.run(primaryIndexer);
    await state.run(alternateIndexer);
    expect(primaryIndexer).toHaveBeenCalledTimes(1);
    expect(alternateIndexer).not.toHaveBeenCalled();

    indexing.resolve();
    await vi.waitFor(() => expect(state.refresh).toHaveBeenCalledTimes(1));
    await state.run(alternateIndexer);
    expect(alternateIndexer).not.toHaveBeenCalled();
    refreshing.resolve();
    await first;
    expect(state.lock.current).toBe(false);
    expect(state.setActive).toHaveBeenLastCalledWith(false);

    await state.run(alternateIndexer);
    expect(alternateIndexer).toHaveBeenCalledTimes(1);
  });

  it.each(['indexing', 'refresh', 'cancellation'])(
    'releases after %s failure and permits retry',
    async (stage) => {
      const state = harness();
      const error =
        stage === 'cancellation'
          ? new DOMException('Cancelled', 'AbortError')
          : new Error('Synthetic failure');
      const operation = vi.fn().mockResolvedValue(undefined);
      if (stage === 'refresh') state.refresh.mockRejectedValueOnce(error);
      else operation.mockRejectedValueOnce(error);

      await expect(state.run(operation)).rejects.toBe(error);
      expect(state.lock.current).toBe(false);
      expect(state.setActive).toHaveBeenLastCalledWith(false);
      expect(state.setProgress).toHaveBeenLastCalledWith(`Error: ${error.message}`);
      await state.run(operation);
      expect(operation).toHaveBeenCalledTimes(2);
      expect(state.lock.current).toBe(false);
      expect(state.setProgress).toHaveBeenLastCalledWith('');
    }
  );

  it('releases after a cancelled batch returns normally, including after unmount', async () => {
    const state = harness();
    const cancelled = deferred();
    const run = state.run(() => cancelled.promise);
    state.mounted.current = false;
    cancelled.resolve();
    await run;
    expect(state.lock.current).toBe(false);
    expect(state.refresh).not.toHaveBeenCalled();
    state.mounted.current = true;
    const retry = vi.fn().mockResolvedValue(undefined);
    await state.run(retry);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(state.setActive).toHaveBeenLastCalledWith(false);
  });
});
