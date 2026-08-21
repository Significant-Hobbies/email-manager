'use client';

import { Brain, RefreshCw, Search, Sparkles } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { Email } from '@/lib/gmail';
import { SEMANTIC_INDEX_LIMIT } from '@/lib/email-index';
import { useMailboxStore } from '@/components/MailboxStoreProvider';
import { semanticSearch, type SearchResult } from '@/lib/semantic-search';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface Props {
  onSelect: (email: Email) => void;
}

const STRIP_ANGLE_RE = new RegExp('<[^>]+>');

function useSemanticSearch(indexed: number) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!query.trim() || indexed === 0) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => performSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query, indexed]);

  async function performSearch(q: string) {
    setSearching(true);
    setSearchError(null);
    try {
      const res = await semanticSearch(q);
      if (mountedRef.current) setResults(res);
    } catch (err) {
      console.error('Semantic search error:', err);
      if (mountedRef.current) {
        setResults([]);
        setSearchError(
          'Search failed. The local AI model may not have loaded — try indexing again.'
        );
      }
    } finally {
      if (mountedRef.current) setSearching(false);
    }
  }

  return { query, setQuery, results, searching, searchError, performSearch };
}

function IndexActionButton({
  needsSync,
  needsIndexOnly,
  busy,
  onSync,
  onIndex,
}: {
  needsSync: boolean;
  needsIndexOnly: boolean;
  busy: boolean;
  onSync: () => void;
  onIndex: () => void;
}) {
  if (needsSync) {
    return (
      <Button type="button" onClick={onSync} disabled={busy}>
        <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} aria-hidden />
        {busy ? 'Working…' : 'Sync & Index'}
      </Button>
    );
  }
  if (needsIndexOnly) {
    return (
      <Button type="button" onClick={onIndex} disabled={busy}>
        <Brain className={cn('h-4 w-4', busy && 'animate-pulse')} aria-hidden />
        {busy ? 'Indexing…' : 'Index for search'}
      </Button>
    );
  }
  return (
    <Button type="button" variant="secondary" onClick={onIndex} disabled={busy}>
      <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} aria-hidden />
      {busy ? 'Indexing…' : 'Re-index'}
    </Button>
  );
}

function SearchMeta({
  indexed,
  total,
  indexPct,
  statusMessage,
  searching,
}: {
  indexed: number;
  total: number;
  indexPct: number;
  statusMessage: string;
  searching: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
      <Badge variant="secondary">
        <Brain className="mr-1 inline h-3 w-3" aria-hidden />
        {indexed} indexed for search
      </Badge>
      {total > indexed ? (
        <Badge variant="outline">{total.toLocaleString()} cached locally</Badge>
      ) : null}
      {indexed > 0 ? <Badge variant="outline">{indexPct}% ready</Badge> : null}
      {statusMessage ? <span>{statusMessage}</span> : null}
      {searching && !statusMessage ? <Spinner className="h-4 w-4" /> : null}
    </div>
  );
}

function SearchResults({
  results,
  onSelect,
}: {
  results: SearchResult[];
  onSelect: (e: Email) => void;
}) {
  return (
    <div className="divide-y divide-[var(--border)]/70">
      {results.map(({ email, score }) => (
        <button
          key={email.id}
          type="button"
          onClick={() => onSelect(email)}
          className="w-full cursor-pointer px-5 py-4 text-left transition-colors hover:bg-[var(--bg-elevated)]/80"
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium">
              {email.from.replace(STRIP_ANGLE_RE, '').trim()}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <Badge>{(score * 100).toFixed(0)}% match</Badge>
              <span className="text-xs tabular-nums text-[var(--text-muted)]">
                {new Date(email.date).toLocaleDateString()}
              </span>
            </div>
          </div>
          <p className="truncate text-sm font-medium">{email.subject}</p>
          <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{email.snippet}</p>
        </button>
      ))}
    </div>
  );
}

interface SearchEmptyStateProps {
  searchError: string | null;
  results: SearchResult[];
  query: string;
  searching: boolean;
  needsIndexOnly: boolean;
  indexed: number;
  total: number;
  onRetry: () => void;
  onIndex: () => void;
  onSync: () => void;
}

function SearchEmptyState(props: SearchEmptyStateProps) {
  const {
    searchError,
    results,
    query,
    searching,
    needsIndexOnly,
    indexed,
    total,
    onRetry,
    onIndex,
    onSync,
  } = props;
  if (searchError) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Search unavailable"
        description={searchError}
        action={{ label: 'Try again', onClick: onRetry }}
      />
    );
  }
  if (results.length === 0 && query && !searching) {
    return (
      <EmptyState
        icon={Search}
        title="No matches"
        description={`Nothing in your local index matched "${query}". Try different wording.`}
      />
    );
  }
  if (results.length === 0) {
    return (
      <EmptyState
        icon={Brain}
        title={
          needsIndexOnly
            ? 'Cached mail needs indexing'
            : indexed === 0
              ? 'Sync inbox to search'
              : 'Search by meaning'
        }
        description={
          needsIndexOnly
            ? `${total.toLocaleString()} emails are cached locally (often from Analytics), but semantic search needs separate on-device embeddings. Index up to ${SEMANTIC_INDEX_LIMIT} recent messages to start searching.`
            : indexed === 0
              ? `Sync up to ${SEMANTIC_INDEX_LIMIT} inbox messages, then generate embeddings locally.`
              : 'Describe what you remember — Kinetic ranks results by cosine similarity.'
        }
        action={
          needsIndexOnly
            ? { label: 'Index for search', onClick: onIndex }
            : indexed === 0
              ? { label: 'Sync & Index', onClick: onSync }
              : undefined
        }
      />
    );
  }
  return null;
}

function SearchInput({
  indexed,
  needsIndexOnly,
  query,
  setQuery,
}: {
  indexed: number;
  needsIndexOnly: boolean;
  query: string;
  setQuery: (q: string) => void;
}) {
  return (
    <div className="border-b border-[var(--border)]/80 px-5 py-4">
      <div className="relative max-w-3xl">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
          aria-hidden
        />
        <Input
          type="text"
          placeholder={
            indexed > 0
              ? 'Try: "lease renewal from last spring" or "flight confirmation"'
              : needsIndexOnly
                ? 'Index cached mail to enable semantic search'
                : 'Sync inbox first to enable semantic search'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={indexed === 0}
          className="h-11 pl-10 text-[15px]"
        />
      </div>
    </div>
  );
}

export function SemanticSearch({ onSelect }: Props) {
  const {
    total,
    indexed,
    pendingIndex,
    syncing,
    indexing,
    progress,
    syncInbox,
    indexForSearch,
    refresh,
  } = useMailboxStore();
  const { query, setQuery, results, searching, searchError, performSearch } =
    useSemanticSearch(indexed);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleIndex() {
    try {
      await indexForSearch();
      if (mountedRef.current) await refresh();
    } catch {
      // progress message already set in provider
    }
  }

  async function handleSyncAndIndex() {
    try {
      await syncInbox({ target: SEMANTIC_INDEX_LIMIT, metadataOnly: false });
      await indexForSearch();
      if (mountedRef.current) await refresh();
    } catch {
      // progress message already set in provider
    }
  }

  const busy = syncing || indexing;
  const indexPct =
    indexed > 0 ? Math.round((indexed / Math.min(total, SEMANTIC_INDEX_LIMIT)) * 100) : 0;
  const needsIndexOnly = total > 0 && indexed === 0 && pendingIndex > 0;
  const needsSync = total === 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-card)]/30">
      <PageHeader
        title="Semantic search"
        description="Query by meaning — embeddings run entirely in your browser."
        actions={
          <IndexActionButton
            needsSync={needsSync}
            needsIndexOnly={needsIndexOnly}
            busy={busy}
            onSync={handleSyncAndIndex}
            onIndex={handleIndex}
          />
        }
        meta={
          <SearchMeta
            indexed={indexed}
            total={total}
            indexPct={indexPct}
            statusMessage={progress}
            searching={searching}
          />
        }
      />

      <SearchInput
        indexed={indexed}
        needsIndexOnly={needsIndexOnly}
        query={query}
        setQuery={setQuery}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {searchError || results.length === 0 ? (
          <SearchEmptyState
            searchError={searchError}
            results={results}
            query={query}
            searching={searching}
            needsIndexOnly={needsIndexOnly}
            indexed={indexed}
            total={total}
            onRetry={() => performSearch(query)}
            onIndex={handleIndex}
            onSync={handleSyncAndIndex}
          />
        ) : (
          <SearchResults results={results} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}
