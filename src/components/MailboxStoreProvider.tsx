'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import type { Email } from '@/lib/gmail';
import {
  getEmailCount,
  getIndexedCount,
  getInboxEmailsSorted,
  getInboxSyncMeta,
  getPendingIndexCount,
  type StoredEmail,
} from '@/lib/db';
import { indexEmailsForSearch, SEMANTIC_INDEX_LIMIT } from '@/lib/email-index';
import { DEFAULT_INBOX_SYNC, ensureInboxEmails, refreshInboxHead } from '@/lib/inbox-sync';
import { loadSubscriptionSenders } from '@/lib/subscription-senders';
import { isInboxStale } from '@/lib/sync-age';

interface MailboxStoreContextValue {
  emails: StoredEmail[];
  total: number;
  indexed: number;
  pendingIndex: number;
  indexing: boolean;
  syncing: boolean;
  progress: string;
  lastSyncedAt: string | null;
  isStale: boolean;
  inboxExhausted: boolean;
  subscriptionSenders: Email[];
  ready: boolean;
  refresh: () => Promise<void>;
  syncInbox: (opts?: { target?: number; metadataOnly?: boolean }) => Promise<void>;
  indexForSearch: () => Promise<void>;
  refreshInbox: () => Promise<void>;
  ensureFreshInbox: () => Promise<void>;
  ensureInboxCount: (target: number, opts?: { metadataOnly?: boolean }) => Promise<StoredEmail[]>;
  getInboxSlice: (limit: number) => StoredEmail[];
}

const MailboxStoreContext = createContext<MailboxStoreContextValue | null>(null);

export function useMailboxStore() {
  const ctx = useContext(MailboxStoreContext);
  if (!ctx) {
    throw new Error('useMailboxStore must be used within MailboxStoreProvider');
  }
  return ctx;
}

async function runLockedOperation(
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

interface MailboxState {
  emails: StoredEmail[];
  total: number;
  indexed: number;
  pendingIndex: number;
  indexing: boolean;
  syncing: boolean;
  progress: string;
  lastSyncedAt: string | null;
  inboxExhausted: boolean;
  subscriptionSenders: Email[];
  ready: boolean;
  mountedRef: RefObject<boolean>;
  syncLockRef: RefObject<boolean>;
  setSyncing: (v: boolean) => void;
  setIndexing: (v: boolean) => void;
  setProgress: (s: string) => void;
  refresh: () => Promise<void>;
}

function useMailboxState(): MailboxState {
  const [emails, setEmails] = useState<StoredEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [indexed, setIndexed] = useState(0);
  const [pendingIndex, setPendingIndex] = useState(0);
  const [indexing, setIndexing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [inboxExhausted, setInboxExhausted] = useState(false);
  const [subscriptionSenders, setSubscriptionSenders] = useState<Email[]>([]);
  const [ready, setReady] = useState(false);
  const mountedRef = useRef(true);
  const syncLockRef = useRef(false);

  const refresh = useCallback(async () => {
    const [sorted, t, i, pending, senders, meta] = await Promise.all([
      getInboxEmailsSorted(),
      getEmailCount(),
      getIndexedCount(),
      getPendingIndexCount(),
      loadSubscriptionSenders(),
      getInboxSyncMeta(),
    ]);
    if (!mountedRef.current) return;
    setEmails(sorted);
    setTotal(t);
    setIndexed(i);
    setPendingIndex(pending);
    setSubscriptionSenders(senders);
    setLastSyncedAt(meta.lastSyncedAt);
    setInboxExhausted(meta.exhausted);
    setReady(true);
  }, []);

  return {
    emails,
    total,
    indexed,
    pendingIndex,
    indexing,
    syncing,
    progress,
    lastSyncedAt,
    inboxExhausted,
    subscriptionSenders,
    ready,
    mountedRef,
    syncLockRef,
    setSyncing,
    setIndexing,
    setProgress,
    refresh,
  };
}

function useSyncOperations(state: MailboxState) {
  const { mountedRef, syncLockRef, setSyncing, setIndexing, setProgress, refresh } = state;

  const runSync = useCallback(
    (target: number, metadataOnly = false) =>
      runLockedOperation(
        mountedRef,
        syncLockRef,
        setSyncing,
        setProgress,
        'Syncing inbox…',
        'Sync failed',
        () =>
          ensureInboxEmails({
            target,
            metadataOnly,
            onProgress: (m) => {
              if (mountedRef.current) setProgress(m);
            },
          }),
        refresh
      ),
    [refresh, setProgress, setSyncing, syncLockRef, mountedRef]
  );

  const runRefreshHead = useCallback(
    () =>
      runLockedOperation(
        mountedRef,
        syncLockRef,
        setSyncing,
        setProgress,
        'Checking for new mail…',
        'Refresh failed',
        () =>
          refreshInboxHead({
            onProgress: (m) => {
              if (mountedRef.current) setProgress(m);
            },
          }),
        refresh
      ),
    [refresh, setProgress, setSyncing, syncLockRef, mountedRef]
  );

  const syncInbox = useCallback(
    async (opts?: { target?: number; metadataOnly?: boolean }) => {
      await runSync(opts?.target ?? DEFAULT_INBOX_SYNC, opts?.metadataOnly ?? false);
    },
    [runSync]
  );

  const refreshInbox = useCallback(async () => {
    await runRefreshHead();
  }, [runRefreshHead]);

  const indexForSearch = useCallback(
    () =>
      runLockedOperation(
        mountedRef,
        syncLockRef,
        setIndexing,
        setProgress,
        'Preparing search index…',
        'Indexing failed',
        () =>
          indexEmailsForSearch({
            limit: SEMANTIC_INDEX_LIMIT,
            onProgress: (m) => {
              if (mountedRef.current) setProgress(m);
            },
          }),
        refresh
      ),
    [refresh, setProgress, setIndexing, syncLockRef, mountedRef]
  );

  return { runSync, runRefreshHead, syncInbox, refreshInbox, indexForSearch };
}

function useInboxQueries(
  emails: StoredEmail[],
  refresh: () => Promise<void>,
  runSync: (target: number, metadataOnly?: boolean) => Promise<void>,
  syncInbox: () => Promise<void>,
  refreshInbox: () => Promise<void>,
  mountedRef: RefObject<boolean>
) {
  const ensureFreshInbox = useCallback(async () => {
    const meta = await getInboxSyncMeta();
    const count = await getEmailCount();
    if (count === 0) {
      await syncInbox();
      return;
    }
    if (isInboxStale(meta.lastSyncedAt)) {
      await refreshInbox();
    }
  }, [refreshInbox, syncInbox]);

  const ensureInboxCount = useCallback(
    async (target: number, opts?: { metadataOnly?: boolean }) => {
      const current = await getEmailCount();
      if (current >= target) {
        const sorted = await getInboxEmailsSorted();
        return sorted.slice(0, target);
      }
      await runSync(target, opts?.metadataOnly ?? false);
      const sorted = await getInboxEmailsSorted();
      if (mountedRef.current) await refresh();
      return sorted.slice(0, target);
    },
    [refresh, runSync, mountedRef]
  );

  const getInboxSlice = useCallback((limit: number) => emails.slice(0, limit), [emails]);

  return { ensureFreshInbox, ensureInboxCount, getInboxSlice };
}

function useMailboxSync(): MailboxStoreContextValue {
  const state = useMailboxState();
  const ops = useSyncOperations(state);
  const queries = useInboxQueries(
    state.emails,
    state.refresh,
    ops.runSync,
    ops.syncInbox,
    ops.refreshInbox,
    state.mountedRef
  );

  const isStale = useMemo(() => isInboxStale(state.lastSyncedAt), [state.lastSyncedAt]);

  useEffect(() => {
    state.mountedRef.current = true;
    void (async () => {
      const [count, meta] = await Promise.all([getEmailCount(), getInboxSyncMeta()]);
      await state.refresh();
      try {
        if (count === 0) {
          await ops.runSync(DEFAULT_INBOX_SYNC);
        } else if (isInboxStale(meta.lastSyncedAt)) {
          await ops.runRefreshHead();
        }
      } catch {
        // Background sync may fail offline — views still render cached state.
      }
    })();
    return () => {
      state.mountedRef.current = false;
    };
  }, [state.refresh, ops.runRefreshHead, ops.runSync, state.mountedRef]);

  return useMemo(
    () => ({
      emails: state.emails,
      total: state.total,
      indexed: state.indexed,
      pendingIndex: state.pendingIndex,
      indexing: state.indexing,
      syncing: state.syncing,
      progress: state.progress,
      lastSyncedAt: state.lastSyncedAt,
      isStale,
      inboxExhausted: state.inboxExhausted,
      subscriptionSenders: state.subscriptionSenders,
      ready: state.ready,
      refresh: state.refresh,
      syncInbox: ops.syncInbox,
      indexForSearch: ops.indexForSearch,
      refreshInbox: ops.refreshInbox,
      ensureFreshInbox: queries.ensureFreshInbox,
      ensureInboxCount: queries.ensureInboxCount,
      getInboxSlice: queries.getInboxSlice,
    }),
    [state, ops, queries, isStale]
  );
}

export function MailboxStoreProvider({ children }: { children: ReactNode }) {
  const value = useMailboxSync();
  return <MailboxStoreContext.Provider value={value}>{children}</MailboxStoreContext.Provider>;
}
