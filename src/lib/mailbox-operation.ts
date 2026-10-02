import type { RefObject } from 'react';

export async function runLockedOperation(
  mountedRef: RefObject<boolean>,
  syncLockRef: RefObject<boolean>,
  setActive: (v: boolean) => void,
  setProgress: (s: string) => void,
  startMsg: string,
  errorLabel: string,
  operation: () => Promise<unknown>,
  refresh: () => Promise<void>
) {
  if (syncLockRef.current) return;
  syncLockRef.current = true;
  setActive(true);
  setProgress(startMsg);
  try {
    await operation();
    if (mountedRef.current) {
      setProgress('');
      await refresh();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : errorLabel;
    if (mountedRef.current) setProgress(`Error: ${message}`);
    throw err;
  } finally {
    syncLockRef.current = false;
    if (mountedRef.current) setActive(false);
  }
}
