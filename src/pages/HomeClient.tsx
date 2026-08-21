'use client';

import { signOut } from '@/lib/auth-client';
import { useSession } from '@/lib/use-session';
import { trackActivated, trackCoreAction, trackReturned, trackSignup } from '@/lib/analytics';
import { useState, useEffect, useCallback, useRef } from 'react';
import { SignInScreen } from '@/components/SignInScreen';
import { MobileMenuButton, Sidebar } from '@/components/Sidebar';
import { EmailList } from '@/components/EmailList';
import { SentMailView } from '@/components/SentMailView';
import { EmailDetail } from '@/components/EmailDetail';
import { Subscriptions } from '@/components/Subscriptions';
import { Analytics } from '@/components/Analytics';
import { SemanticSearch } from '@/components/SemanticSearch';
import { InsightsView } from '@/components/InsightsView';
import { WorkSurface } from '@/components/WorkSurface';
import { MailboxStoreProvider, useMailboxStore } from '@/components/MailboxStoreProvider';
import type { Email } from '@/lib/gmail';

type View = 'inbox' | 'sent' | 'subscriptions' | 'analytics' | 'search' | 'insights';

const VIEWS = new Set<string>([
  'inbox',
  'sent',
  'subscriptions',
  'analytics',
  'search',
  'insights',
]);

const HASH_ALIASES: Record<string, View> = {
  today: 'inbox',
  triage: 'inbox',
  trash: 'inbox',
  starred: 'inbox',
  digest: 'insights',
  filters: 'insights',
};

const LABEL_MAP: Record<string, string> = {
  inbox: 'INBOX',
  sent: 'SENT',
};

const QUOTE_RE = new RegExp('"', 'g');

function getViewFromHash(): View {
  if (typeof window === 'undefined') return 'inbox';
  const hash = window.location.hash.replace('#', '');
  if (HASH_ALIASES[hash]) return HASH_ALIASES[hash];
  return VIEWS.has(hash) ? (hash as View) : 'inbox';
}

export default function HomeClient() {
  const { session: sessionData, loading: isPending } = useSession();
  const session = sessionData?.user ? sessionData : null;
  const status = isPending ? 'loading' : session ? 'authenticated' : 'unauthenticated';

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <SignInScreen />;
  }

  return (
    <MailboxStoreProvider>
      <AuthenticatedHome sessionData={sessionData!} />
    </MailboxStoreProvider>
  );
}

function useSessionTracking(userId: string | undefined) {
  const trackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || trackedRef.current === userId) return;
    trackedRef.current = userId;
    try {
      const key = `email-manager:seen:${userId}`;
      if (window.localStorage.getItem(key)) {
        trackReturned();
      } else {
        window.localStorage.setItem(key, String(Date.now()));
        trackSignup();
      }
    } catch {
      // localStorage may be unavailable — never break on analytics.
    }
  }, [userId]);
}

function useEmailSelection() {
  const [selected, setSelected] = useState<Email | null>(null);
  const activatedRef = useRef(false);

  const handleSelectEmail = useCallback((email: Email | null) => {
    setSelected(email);
    if (email) {
      trackCoreAction('email_opened');
      if (!activatedRef.current) {
        activatedRef.current = true;
        trackActivated();
      }
    }
  }, []);

  return { selected, setSelected, handleSelectEmail };
}

interface EmailFetchState {
  emails: Email[];
  loading: boolean;
  error: string | null;
  nextPageToken: string | null;
}

function useEmailFetch(
  view: View,
  search: string
): EmailFetchState & {
  fetchEmails: (pageToken?: string) => void;
} {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const fetchSeqRef = useRef(0);

  const fetchEmails = useCallback(
    async (pageToken?: string) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      const requestSeq = ++fetchSeqRef.current;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (LABEL_MAP[view]) params.set('label', LABEL_MAP[view]);
        if (search) params.set('q', search);
        if (pageToken) params.set('pageToken', pageToken);

        const res = await fetch(`/api/emails?${params}`);
        if (res.status === 401) {
          signOut();
          return;
        }
        if (!res.ok) {
          const text = await res.text();
          console.error('Email fetch error:', res.status, text);
          setError(`Failed to load emails (${res.status})`);
          return;
        }

        const data = await res.json();
        if (data.error) {
          console.error('Email fetch error:', data.error);
          setError(data.error);
          return;
        }
        if (requestSeq !== fetchSeqRef.current) return;

        if (pageToken) {
          setEmails((prev) => [...prev, ...data.emails]);
        } else {
          setEmails(data.emails ?? []);
        }
        setNextPageToken(data.nextPageToken);
      } catch (err) {
        if (requestSeq !== fetchSeqRef.current) return;
        console.error('Email fetch exception:', err);
        setError('Failed to load emails');
      } finally {
        if (requestSeq !== fetchSeqRef.current) return;
        setLoading(false);
        fetchingRef.current = false;
      }
    },
    [view, search]
  );

  return { emails, loading, error, nextPageToken, fetchEmails };
}

function ErrorBanner({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="max-w-sm space-y-4 px-6 text-center">
        <p className="text-sm text-[var(--text-muted)]">{error}</p>
        <button
          onClick={onRetry}
          className="cursor-pointer rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function InboxView(props: {
  error: string | null;
  selected: Email | null;
  emails: Email[];
  loading: boolean;
  search: string;
  view: View;
  onSearchChange: (s: string) => void;
  onSelect: (e: Email | null) => void;
  onBack: () => void;
  onRefresh: () => void;
  onLoadMore?: () => void;
  isPrimaryView: boolean;
}) {
  const {
    error,
    selected,
    emails,
    loading,
    search,
    view,
    onSearchChange,
    onSelect,
    onBack,
    onRefresh,
    onLoadMore,
    isPrimaryView,
  } = props;
  if (error) return <ErrorBanner error={error} onRetry={onRefresh} />;
  return (
    <WorkSurface
      hasSelection={Boolean(selected)}
      list={
        <EmailList
          emails={emails}
          loading={loading}
          search={search}
          label={view}
          selectedId={selected?.id}
          onSearchChange={onSearchChange}
          onSelect={onSelect}
          onRefresh={onRefresh}
          onLoadMore={onLoadMore}
          primary={isPrimaryView}
        />
      }
      detail={selected ? <EmailDetail email={selected} onBack={onBack} showBack /> : null}
    />
  );
}

function MainViewRouter(props: {
  view: View;
  selected: Email | null;
  error: string | null;
  emails: Email[];
  loading: boolean;
  search: string;
  onSearchChange: (s: string) => void;
  onSelect: (e: Email | null) => void;
  onBack: () => void;
  onRefresh: () => void;
  onLoadMore?: () => void;
  openDigestContext: (kind: 'sender' | 'thread', value: string, subject?: string) => void;
  isPrimaryView: boolean;
}) {
  const {
    view,
    selected,
    error,
    emails,
    loading,
    search,
    onSearchChange,
    onSelect,
    onBack,
    onRefresh,
    onLoadMore,
    openDigestContext,
    isPrimaryView,
  } = props;

  if (view === 'subscriptions') return <Subscriptions />;
  if (view === 'analytics') return <Analytics />;
  if (view === 'insights') {
    return (
      <InsightsView
        onOpenSender={(email) => openDigestContext('sender', email)}
        onOpenThread={(_threadId, subject) => openDigestContext('thread', '', subject)}
      />
    );
  }
  if (view === 'sent') {
    return (
      <WorkSurface
        hasSelection={Boolean(selected)}
        list={<SentMailView selectedId={selected?.id} onSelect={onSelect} />}
        detail={selected ? <EmailDetail email={selected} onBack={onBack} showBack /> : null}
      />
    );
  }
  if (view === 'inbox') {
    return (
      <InboxView
        error={error}
        selected={selected}
        emails={emails}
        loading={loading}
        search={search}
        view={view}
        onSearchChange={onSearchChange}
        onSelect={onSelect}
        onBack={onBack}
        onRefresh={onRefresh}
        onLoadMore={onLoadMore}
        isPrimaryView={isPrimaryView}
      />
    );
  }
  if (selected) return <EmailDetail email={selected} onBack={onBack} />;
  if (view === 'search') return <SemanticSearch onSelect={onSelect} />;
  if (error) return <ErrorBanner error={error} onRetry={onRefresh} />;
  return (
    <EmailList
      emails={emails}
      loading={loading}
      search={search}
      label={view}
      selectedId={null}
      onSearchChange={onSearchChange}
      onSelect={onSelect}
      onRefresh={onRefresh}
      onLoadMore={onLoadMore}
      primary={isPrimaryView}
    />
  );
}

function useViewSync() {
  const [view, setViewState] = useState<View>('inbox');

  useEffect(() => {
    setViewState(getViewFromHash());
    const onHashChange = () => setViewState(getViewFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setView = useCallback((v: View) => {
    setViewState(v);
    window.location.hash = v;
  }, []);

  return { view, setView };
}

function useInboxState(
  view: View,
  search: string,
  mailbox: ReturnType<typeof useMailboxStore>,
  fetchState: ReturnType<typeof useEmailFetch>
) {
  const usesCachedInbox = view === 'inbox' && !search;
  const inboxEmails = usesCachedInbox ? mailbox.emails : fetchState.emails;
  const inboxLoading = usesCachedInbox
    ? !mailbox.ready || (mailbox.syncing && mailbox.emails.length === 0)
    : fetchState.loading;
  const inboxError = usesCachedInbox ? null : fetchState.error;

  const loadMoreInbox = useCallback(() => {
    if (usesCachedInbox && !mailbox.inboxExhausted) {
      void mailbox.ensureInboxCount(mailbox.total + 100);
      return;
    }
    if (fetchState.nextPageToken) fetchState.fetchEmails(fetchState.nextPageToken);
  }, [usesCachedInbox, mailbox, fetchState]);

  const inboxLoadMore = usesCachedInbox
    ? mailbox.inboxExhausted
      ? undefined
      : loadMoreInbox
    : fetchState.nextPageToken
      ? loadMoreInbox
      : undefined;

  const refreshMailboxView = useCallback(() => {
    if (usesCachedInbox) void mailbox.syncInbox();
    else fetchState.fetchEmails();
  }, [usesCachedInbox, mailbox, fetchState]);

  return {
    usesCachedInbox,
    inboxEmails,
    inboxLoading,
    inboxError,
    inboxLoadMore,
    refreshMailboxView,
  };
}

function AuthenticatedHome({
  sessionData,
}: {
  sessionData: { user?: { id: string; name?: string; image?: string } };
}) {
  const mailbox = useMailboxStore();
  const { view, setView } = useViewSync();
  const [search, setSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { selected, setSelected, handleSelectEmail } = useEmailSelection();
  const fetchState = useEmailFetch(view, search);
  useSessionTracking(sessionData?.user?.id);
  const {
    usesCachedInbox,
    inboxEmails,
    inboxLoading,
    inboxError,
    inboxLoadMore,
    refreshMailboxView,
  } = useInboxState(view, search, mailbox, fetchState);

  useEffect(() => {
    setSelected(null);
    if (view === 'sent') return;
    if (usesCachedInbox) return;
    if (LABEL_MAP[view]) fetchState.fetchEmails();
  }, [view, search, usesCachedInbox, fetchState, setSelected]);

  const openDigestContext = useCallback(
    (kind: 'sender' | 'thread', value: string, subject?: string) => {
      if (kind === 'sender') {
        setSearch(`from:${value}`);
      } else {
        setSearch(subject ? `subject:"${subject.replace(QUOTE_RE, '')}"` : '');
      }
      setSelected(null);
      setView('inbox');
    },
    [setView, setSelected]
  );

  const isPrimaryView = view === 'inbox';
  const viewLabel = view.charAt(0).toUpperCase() + view.slice(1);

  return (
    <div className="app-mesh flex h-screen">
      <Sidebar
        view={view}
        onNavigate={(v) => setView(v as View)}
        onSignOut={() => signOut()}
        userImage={sessionData?.user?.image ?? undefined}
        userName={sessionData?.user?.name ?? ''}
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="glass-panel flex items-center gap-3 border-b px-3 py-2.5 md:hidden">
          <MobileMenuButton onClick={() => setMobileMenuOpen(true)} label={viewLabel} />
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-bold text-[var(--accent-fg)]">
            K
          </span>
          <span className="text-sm font-semibold">{viewLabel}</span>
        </header>

        <main className="flex flex-1 overflow-hidden">
          <MainViewRouter
            view={view}
            selected={selected}
            error={inboxError}
            emails={inboxEmails}
            loading={inboxLoading}
            search={search}
            onSearchChange={setSearch}
            onSelect={handleSelectEmail}
            onBack={() => setSelected(null)}
            onRefresh={refreshMailboxView}
            onLoadMore={inboxLoadMore}
            openDigestContext={openDigestContext}
            isPrimaryView={isPrimaryView}
          />
        </main>
      </div>
    </div>
  );
}
