'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMailboxStore } from '@/components/MailboxStoreProvider';
import { trackCoreAction } from '@/lib/analytics';
import type { Email } from '@/lib/gmail';
import {
  archiveImpactLabel,
  buildFilterRecipe,
  buildGmailFilterSuggestions,
  buildGmailFilterXml,
  buildRecipeExplanation,
  buildSelectedRecipeSummary,
  suggestedActionLines,
  type GmailFilterSuggestion,
} from '@/lib/filter-builder';

const SAMPLE_OPTIONS = [
  { label: '100', value: 100 },
  { label: '500', value: 500 },
  { label: '1k', value: 1000 },
];

const CATEGORY_LABELS: Record<GmailFilterSuggestion['category'], string> = {
  newsletter: 'Newsletters',
  receipt: 'Receipts',
  notification: 'Notifications',
  followup: 'Follow-up',
};

interface Props {
  embedded?: boolean;
}

function SampleSizeSelector({
  sampleSize,
  loading,
  setSampleSize,
  onRefresh,
}: {
  sampleSize: number;
  loading: boolean;
  setSampleSize: (n: number) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg bg-[var(--border)]/50 p-0.5">
        {SAMPLE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSampleSize(opt.value)}
            disabled={loading}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
              sampleSize === opt.value
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            } disabled:opacity-60`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium transition hover:bg-[var(--border)]/40 disabled:opacity-60 cursor-pointer"
      >
        {loading ? 'Sampling...' : 'Refresh sample'}
      </button>
    </div>
  );
}

interface FilterBuilderHeaderProps {
  embedded: boolean;
  emails: Email[];
  suggestions: GmailFilterSuggestion[];
  selectedSuggestions: GmailFilterSuggestion[];
  sampleSize: number;
  loading: boolean;
  setSampleSize: (n: number) => void;
  onRefresh: () => void;
}

function FilterBuilderHeader(props: FilterBuilderHeaderProps) {
  const {
    embedded,
    emails,
    suggestions,
    selectedSuggestions,
    sampleSize,
    loading,
    setSampleSize,
    onRefresh,
  } = props;
  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          {embedded ? (
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Suggested filters
            </h2>
          ) : (
            <h1 className="text-2xl font-semibold">Filter recipe studio</h1>
          )}
          <p className={`text-sm text-[var(--text-muted)] ${embedded ? 'mt-2' : 'mt-1'}`}>
            Sample inbox patterns, review why each recipe exists, and export Gmail-compatible filter
            XML — all locally, read-only.
          </p>
        </div>
        <SampleSizeSelector
          sampleSize={sampleSize}
          loading={loading}
          setSampleSize={setSampleSize}
          onRefresh={onRefresh}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'sampled', value: emails.length },
          { label: 'recipes', value: suggestions.length },
          { label: 'selected', value: selectedSuggestions.length },
          {
            label: 'would skip inbox',
            value: selectedSuggestions.filter((item) => item.shouldArchive).length,
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
          >
            <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              {metric.label}
            </div>
            <div className="mt-2 text-2xl font-semibold">{metric.value}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function SuggestionCard({
  suggestion,
  selected,
  copied,
  onToggle,
  onCopy,
}: {
  suggestion: GmailFilterSuggestion;
  selected: boolean;
  copied: string | null;
  onToggle: () => void;
  onCopy: (text: string) => void;
}) {
  return (
    <article
      className={`rounded-xl border bg-[var(--bg-card)] p-4 transition ${
        selected ? 'border-[var(--accent)]/40' : 'border-[var(--border)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 h-4 w-4 accent-[var(--accent)]"
          aria-label={`Select ${suggestion.title}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
              {CATEGORY_LABELS[suggestion.category]}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {suggestion.matchCount} matches · {suggestion.confidence}% confidence
            </span>
          </div>
          <h3 className="mt-2 font-medium">{suggestion.displayName}</h3>
          <p className="mt-1 break-all text-xs text-[var(--text-muted)]">
            {suggestion.senderEmail}
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-[var(--bg)] p-3">
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                Match rationale
              </div>
              <p className="mt-1 text-sm">{suggestion.reason}</p>
            </div>
            <div className="rounded-lg bg-[var(--bg)] p-3">
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                Suggested action
              </div>
              <ul className="mt-1 space-y-0.5 text-sm">
                {suggestedActionLines(suggestion).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-2 text-xs text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text)]">Archive impact: </span>
            {archiveImpactLabel(suggestion)}
          </p>

          <div className="mt-3 rounded-lg bg-[var(--bg)] p-3">
            <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Gmail search
            </div>
            <p className="mt-1 break-all font-mono text-xs">{suggestion.searchQuery}</p>
          </div>

          {suggestion.sampleSubjects.length > 0 && (
            <div className="mt-3 space-y-1">
              {suggestion.sampleSubjects.map((subject) => (
                <p key={subject} className="truncate text-xs text-[var(--text-muted)]">
                  {subject}
                </p>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onCopy(buildFilterRecipe(suggestion))}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--accent-hover)] cursor-pointer"
            >
              {copied === suggestion.id ? 'Copied' : 'Copy recipe'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

interface ExportSidebarProps {
  selectedSuggestions: GmailFilterSuggestion[];
  xml: string;
  explanation: string;
  recipeSummary: string;
  copied: string | null;
  onCopy: (id: string, text: string) => void;
}

function ExportSidebar(props: ExportSidebarProps) {
  const { selectedSuggestions, xml, explanation, recipeSummary, copied, onCopy } = props;
  return (
    <aside className="h-fit space-y-4 xl:sticky xl:top-5">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <h2 className="font-semibold">Selected recipes</h2>
        {selectedSuggestions.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Select candidates to preview the export.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {selectedSuggestions.map((suggestion) => (
              <li
                key={suggestion.id}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
              >
                <p className="font-medium">{suggestion.displayName}</p>
                <p className="text-[var(--text-muted)]">
                  {CATEGORY_LABELS[suggestion.category]} · {archiveImpactLabel(suggestion)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Export preview</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onCopy('summary', recipeSummary)}
              disabled={selectedSuggestions.length === 0}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs transition hover:bg-[var(--border)]/40 disabled:opacity-50 cursor-pointer"
            >
              {copied === 'summary' ? 'Copied' : 'Copy summary'}
            </button>
            <button
              type="button"
              onClick={() => {
                onCopy('xml', xml);
                trackCoreAction('filter_installed');
              }}
              disabled={selectedSuggestions.length === 0}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50 cursor-pointer"
            >
              {copied === 'xml' ? 'Copied' : 'Copy XML'}
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm text-[var(--text-muted)]">{explanation}</p>
        <pre className="mt-4 max-h-[360px] overflow-auto rounded-lg bg-[var(--bg)] p-3 text-xs leading-5 text-[var(--text-muted)]">
          {selectedSuggestions.length === 0 ? 'Select recipes to build Gmail filter XML.' : xml}
        </pre>
      </div>
    </aside>
  );
}

interface FilterBuilderContentProps {
  loading: boolean;
  progress: string;
  error: string | null;
  suggestions: GmailFilterSuggestion[];
  selectedIds: Set<string>;
  selectedSuggestions: GmailFilterSuggestion[];
  xml: string;
  explanation: string;
  recipeSummary: string;
  copied: string | null;
  onRetry: () => void;
  onToggleAll: () => void;
  onToggleSuggestion: (id: string) => void;
  onCopyRecipe: (text: string) => void;
  onCopyId: (id: string, text: string) => void;
}

function FilterBuilderContent(props: FilterBuilderContentProps) {
  const {
    loading,
    progress,
    error,
    suggestions,
    selectedIds,
    selectedSuggestions,
    xml,
    explanation,
    recipeSummary,
    copied,
    onRetry,
    onToggleAll,
    onToggleSuggestion,
    onCopyRecipe,
    onCopyId,
  } = props;
  if (loading) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        <p className="text-xs text-[var(--text-muted)]">{progress}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-20 text-center">
        <p className="text-[var(--text-muted)]">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }
  if (suggestions.length === 0) {
    return (
      <div className="mt-20 text-center text-[var(--text-muted)]">
        No repeated filter patterns found in the sampled inbox.
      </div>
    );
  }
  return (
    <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Recipe candidates</h2>
          <button
            type="button"
            onClick={onToggleAll}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs transition hover:bg-[var(--border)]/40 cursor-pointer"
          >
            {selectedIds.size === suggestions.length ? 'Clear all' : 'Select all'}
          </button>
        </div>
        {suggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            selected={selectedIds.has(suggestion.id)}
            copied={copied}
            onToggle={() => onToggleSuggestion(suggestion.id)}
            onCopy={onCopyRecipe}
          />
        ))}
      </section>
      <ExportSidebar
        selectedSuggestions={selectedSuggestions}
        xml={xml}
        explanation={explanation}
        recipeSummary={recipeSummary}
        copied={copied}
        onCopy={onCopyId}
      />
    </div>
  );
}

export function GmailFilterBuilder({ embedded = false }: Props) {
  const { ensureInboxCount, getInboxSlice } = useMailboxStore();
  const [emails, setEmails] = useState<Email[]>([]);
  const [sampleSize, setSampleSize] = useState(500);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  const suggestions = useMemo(() => buildGmailFilterSuggestions(emails), [emails]);
  const selectedSuggestions = suggestions.filter((s) => selectedIds.has(s.id));
  const xml = buildGmailFilterXml(selectedSuggestions);
  const explanation = buildRecipeExplanation(selectedSuggestions);
  const recipeSummary = buildSelectedRecipeSummary(selectedSuggestions);

  const fetchPatterns = useCallback(
    async (target: number) => {
      setLoading(true);
      setError(null);
      setProgress('Loading from local inbox index…');
      try {
        const cached = getInboxSlice(target);
        if (cached.length >= target) {
          setEmails(cached.slice(0, target));
          setLoading(false);
          setProgress('');
          return;
        }
        setProgress(`Syncing inbox… ${cached.length}/${target}`);
        const synced = await ensureInboxCount(target, { metadataOnly: true });
        setEmails(synced.slice(0, target));
      } catch (err: unknown) {
        console.error('Filter builder load error:', err);
        setError('Failed to sample inbox');
      } finally {
        setLoading(false);
        setProgress('');
      }
    },
    [ensureInboxCount, getInboxSlice]
  );

  useEffect(() => {
    void fetchPatterns(sampleSize);
  }, [fetchPatterns, sampleSize]);

  useEffect(() => {
    setSelectedIds((current) => {
      const validIds = new Set(suggestions.map((s) => s.id));
      const preserved = new Set([...current].filter((id) => validIds.has(id)));
      if (preserved.size > 0) return preserved;
      return new Set(suggestions.slice(0, 8).map((s) => s.id));
    });
  }, [suggestions]);

  const copyText = useCallback(async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  }, []);

  const toggleSuggestion = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((current) => {
      if (current.size === suggestions.length) return new Set();
      return new Set(suggestions.map((s) => s.id));
    });
  }, [suggestions]);

  const header = (
    <FilterBuilderHeader
      embedded={embedded}
      emails={emails}
      suggestions={suggestions}
      selectedSuggestions={selectedSuggestions}
      sampleSize={sampleSize}
      loading={loading}
      setSampleSize={setSampleSize}
      onRefresh={() => fetchPatterns(sampleSize)}
    />
  );

  const content = (
    <FilterBuilderContent
      loading={loading}
      progress={progress}
      error={error}
      suggestions={suggestions}
      selectedIds={selectedIds}
      selectedSuggestions={selectedSuggestions}
      xml={xml}
      explanation={explanation}
      recipeSummary={recipeSummary}
      copied={copied}
      onRetry={() => fetchPatterns(sampleSize)}
      onToggleAll={toggleAll}
      onToggleSuggestion={toggleSuggestion}
      onCopyRecipe={(text) => {
        const id = suggestions.find((s) => buildFilterRecipe(s) === text)?.id ?? '';
        void copyText(id, text);
      }}
      onCopyId={copyText}
    />
  );

  if (embedded) {
    return (
      <section>
        <div className="p-5">{header}</div>
        {content}
      </section>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="border-b border-[var(--border)] p-5">{header}</div>
      {content}
    </div>
  );
}
