'use client';

import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Email } from '@/lib/gmail';
import { isUnsubscribeSentEmail } from '@/lib/sent-reply';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmailListSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type SentFilter = 'all' | 'awaiting' | 'replied';

interface Props {
  selectedId?: string | null;
  onSelect: (email: Email) => void;
}

const FILTERS: { id: SentFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'awaiting', label: 'Awaiting reply' },
  { id: 'replied', label: 'Replied' },
];

const STRIP_ANGLE_RE = new RegExp('<[^>]+>');

function ReplyStatusBadge({ status }: { status?: Email['replyStatus'] }) {
  if (!status) return null;
  if (status === 'replied') {
    return (
      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
        Replied
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-300">
      Awaiting
    </Badge>
  );
}

function SentFilterBar({
  filter,
  setFilter,
  counts,
}: {
  filter: SentFilter;
  setFilter: (f: SentFilter) => void;
  counts: Record<SentFilter, number>;
}) {
  return (
    <div className="border-b border-[var(--border)]/80 px-5 py-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer',
              filter === item.id
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text)]'
            )}
          >
            {item.label}
            <span className="ml-1 tabular-nums opacity-80">
              {counts[item.id === 'all' ? 'all' : item.id]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SentMailRow(props: {
  email: Email;
  selected: boolean;
  focused: boolean;
  onSelect: (email: Email) => void;
  onFocus: () => void;
  refCallback: (el: HTMLButtonElement | null) => void;
}) {
  const { email, selected, focused, onSelect, onFocus, refCallback } = props;
  return (
    <button
      key={email.id}
      type="button"
      ref={refCallback}
      onClick={() => onSelect(email)}
      onMouseEnter={onFocus}
      className={cn(
        'w-full cursor-pointer border-b border-[var(--border)]/80 px-4 py-3 text-left transition-all duration-150',
        selected || focused
          ? 'bg-[var(--accent)]/10 ring-1 ring-inset ring-[var(--accent)]/25'
          : 'hover:bg-[var(--bg-elevated)]'
      )}
    >
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium">
          To: {email.to.replace(STRIP_ANGLE_RE, '').trim() || email.to}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <ReplyStatusBadge status={email.replyStatus} />
          <span className="text-xs text-[var(--text-muted)]">
            {new Date(email.date).toLocaleDateString()}
          </span>
        </div>
      </div>
      <div className="truncate text-sm">{email.subject}</div>
      <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{email.snippet}</div>
    </button>
  );
}

function SentMailListBody(props: {
  filtered: Email[];
  loading: boolean;
  selectedId?: string | null;
  onSelect: (email: Email) => void;
  nextPageToken: string | null;
  onLoadMore: () => void;
  safeFocusIdx: number;
  setFocusIdx: (idx: number) => void;
  itemsRef: RefObject<HTMLButtonElement[]>;
}) {
  const {
    filtered,
    loading,
    selectedId,
    onSelect,
    nextPageToken,
    onLoadMore,
    safeFocusIdx,
    setFocusIdx,
    itemsRef,
  } = props;
  return (
    <>
      {filtered.map((email, idx) => (
        <SentMailRow
          key={email.id}
          email={email}
          selected={email.id === selectedId}
          focused={idx === safeFocusIdx}
          onSelect={onSelect}
          onFocus={() => setFocusIdx(idx)}
          refCallback={(el) => {
            if (el) itemsRef.current[idx] = el;
          }}
        />
      ))}
      {nextPageToken ? (
        <Button
          type="button"
          variant="ghost"
          className="w-full rounded-none py-3 text-[var(--accent)]"
          onClick={onLoadMore}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </>
  );
}

function useSentMail() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const fetchSent = useCallback(async (pageToken?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ label: 'SENT', replyStatus: 'true' });
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(`/api/emails?${params}`);
      if (!res.ok) {
        setError(`Failed to load sent mail (${res.status})`);
        return;
      }

      const data = await res.json();
      const batch: Email[] = (data.emails ?? []).filter(
        (email: Email) => !isUnsubscribeSentEmail(email)
      );
      setEmails((prev) => (pageToken ? [...prev, ...batch] : batch));
      setNextPageToken(data.nextPageToken ?? null);
    } catch {
      setError('Failed to load sent mail');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSent();
  }, [fetchSent]);

  return { emails, loading, error, nextPageToken, fetchSent };
}

export function SentMailView(props: Props) {
  const { selectedId, onSelect } = props;
  const { emails, loading, error, nextPageToken, fetchSent } = useSentMail();
  const [filter, setFilter] = useState<SentFilter>('all');
  const [focusIdx, setFocusIdx] = useState(-1);
  const itemsRef = useRef<HTMLButtonElement[]>([]);

  const filtered = useMemo(() => {
    if (filter === 'all') return emails;
    return emails.filter((email) => email.replyStatus === filter);
  }, [emails, filter]);

  const counts = useMemo(() => {
    const awaiting = emails.filter((email) => email.replyStatus === 'awaiting').length;
    const replied = emails.filter((email) => email.replyStatus === 'replied').length;
    return { all: emails.length, awaiting, replied };
  }, [emails]);

  const safeFocusIdx = filtered.length === 0 ? -1 : Math.min(focusIdx, filtered.length - 1);

  useEffect(() => {
    if (filtered.length === 0) setFocusIdx(-1);
  }, [filtered.length]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-card)]/30">
      <PageHeader
        title="Sent"
        description="See which conversations are still waiting on a reply."
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fetchSent()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
            Refresh
          </Button>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            <Badge variant="outline">{counts.awaiting} awaiting</Badge>
            <Badge variant="outline">{counts.replied} replied</Badge>
          </div>
        }
      />

      <SentFilterBar filter={filter} setFilter={setFilter} counts={counts} />

      <div className="flex-1 overflow-y-auto">
        {loading && emails.length === 0 ? (
          <EmailListSkeleton />
        ) : error ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <div className="text-center space-y-3">
              <p className="text-sm text-[var(--text-muted)]">{error}</p>
              <Button type="button" size="sm" onClick={() => fetchSent()}>
                Try again
              </Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-sm text-[var(--text-muted)]">
            {filter === 'all' ? 'No sent messages loaded.' : `No sent messages marked ${filter}.`}
          </div>
        ) : (
          <SentMailListBody
            filtered={filtered}
            loading={loading}
            selectedId={selectedId}
            onSelect={onSelect}
            nextPageToken={nextPageToken}
            onLoadMore={() => fetchSent(nextPageToken ?? undefined)}
            safeFocusIdx={safeFocusIdx}
            setFocusIdx={setFocusIdx}
            itemsRef={itemsRef}
          />
        )}
      </div>
    </div>
  );
}
