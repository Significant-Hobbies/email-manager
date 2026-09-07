'use client';

import { useState } from 'react';
import { trackCoreAction } from '@/lib/analytics';
import { useMailboxStore } from '@/components/MailboxStoreProvider';
import { getInboxEmailsSorted } from '@/lib/db';
import { buildWeeklyDigest, type WeeklyDigest } from '@/lib/digest';
import { formatSyncAge } from '@/lib/sync-age';
import { DEFAULT_INBOX_SYNC } from '@/lib/inbox-sync';

interface Props {
  onOpenSender?: (senderEmail: string) => void;
  onOpenThread?: (threadId: string, subject: string) => void;
  /** Render as a section inside Insights instead of a standalone page. */
  embedded?: boolean;
}

function formatQuietDays(days: number): string {
  if (days < 30) return `${days} days without mail`;
  const months = Math.round(days / 30);
  return `about ${months} month${months === 1 ? '' : 's'} without mail`;
}

function revisitReasonLabel(reason: 'starred_stale' | 'long_thread_stale'): string {
  return reason === 'starred_stale'
    ? 'Starred thread · no activity in 2+ weeks'
    : 'Long thread · no activity in 2+ weeks';
}

export function WeeklyDigestView({ onOpenSender, onOpenThread, embedded = false }: Props) {
  const { accountId, total, lastSyncedAt, isStale, syncing, ensureFreshInbox, syncInbox } =
    useMailboxStore();
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      if (total === 0) {
        await syncInbox();
      } else if (isStale) {
        await ensureFreshInbox();
      }

      const localEmails = await getInboxEmailsSorted(accountId);
      if (localEmails.length === 0) {
        setDigest(null);
        setError(
          'No inbox emails in your local cache yet. Use Sync in the sidebar, then try again.'
        );
        return;
      }

      setDigest(buildWeeklyDigest(localEmails));
      trackCoreAction('digest_generated');
    } catch {
      setError('Could not refresh or read your local inbox cache.');
    } finally {
      setLoading(false);
    }
  }

  const dataBasis = total
    ? `Based on ${total.toLocaleString()} synced inbox email${total === 1 ? '' : 's'} (up to ${DEFAULT_INBOX_SYNC.toLocaleString()}). Last sync: ${formatSyncAge(lastSyncedAt)}.`
    : 'No emails synced yet — sync from the sidebar first.';

  const header = (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        {embedded ? (
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Weekly digest
          </h2>
        ) : (
          <h1 className="text-2xl font-semibold">Weekly digest</h1>
        )}
        <p className={`max-w-2xl text-sm text-[var(--text-muted)] ${embedded ? 'mt-2' : 'mt-1'}`}>
          A quick read on who went quiet, which threads may need attention, and what topics showed
          up this week — all computed locally from your synced inbox.
        </p>
        <p
          className={`mt-2 text-xs ${isStale ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--text-muted)]'}`}
        >
          {dataBasis}
          {isStale && !syncing ? ' Data may be outdated — generate will refresh first.' : ''}
        </p>
      </div>

      <button
        type="button"
        onClick={() => void generate()}
        disabled={loading || syncing}
        className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60 cursor-pointer"
      >
        {loading || syncing ? 'Refreshing…' : 'Generate this week'}
      </button>
    </div>
  );

  const body = (
    <div className={embedded ? 'px-5 pb-8' : 'min-h-0 flex-1 overflow-y-auto p-5'}>
      {error && (
        <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-sm text-[var(--text-muted)]">{error}</p>
          {total === 0 && (
            <button
              type="button"
              onClick={() => void syncInbox()}
              className="mt-3 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--accent-hover)] cursor-pointer"
            >
              Sync inbox
            </button>
          )}
        </div>
      )}

      {!digest && !error && !loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <p className="max-w-md text-sm text-[var(--text-muted)]">
            Hit generate to refresh your local inbox (if needed) and summarize the past week. This
            only sees mail you have synced — not your entire Gmail history.
          </p>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={syncing}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60 cursor-pointer"
          >
            Generate this week
          </button>
        </div>
      )}

      {digest && (
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/50 px-4 py-3 text-xs text-[var(--text-muted)]">
            Week of {digest.periodStart} – {digest.periodEnd} · generated{' '}
            {new Date(digest.generatedAt).toLocaleString()} · {dataBasis}
          </div>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              People you have not heard from
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Senders you emailed at least 3 times before, but nothing in the last ~60 days.
              Newsletters and bulk mail are excluded.
            </p>
            {digest.relationshipsQuiet.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                No quiet relationships in your synced mail.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {digest.relationshipsQuiet.map((item) => (
                  <li
                    key={item.senderEmail}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.displayName}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">
                          {item.senderEmail}
                        </p>
                        <p className="mt-2 text-xs text-[var(--text-muted)]">
                          {item.priorMessageCount} messages in cache · last heard{' '}
                          {new Date(item.lastMessageAt).toLocaleDateString()} ·{' '}
                          {formatQuietDays(item.quietDays)}
                        </p>
                      </div>
                      {onOpenSender && (
                        <button
                          type="button"
                          onClick={() => onOpenSender(item.senderEmail)}
                          className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs transition hover:bg-[var(--border)]/40 cursor-pointer"
                        >
                          Find in inbox
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Threads worth another look
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Starred threads or conversations with 4+ messages that have gone quiet for 2+ weeks in
              your synced mail.
            </p>
            {digest.threadsToRevisit.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">Nothing flagged right now.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {digest.threadsToRevisit.map((item) => (
                  <li
                    key={item.threadId}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.subject || '(no subject)'}</p>
                        <p className="mt-2 text-xs text-[var(--text-muted)]">
                          {item.messageCount} messages in cache · last activity{' '}
                          {new Date(item.lastMessageAt).toLocaleDateString()} ·{' '}
                          {revisitReasonLabel(item.reason)}
                        </p>
                      </div>
                      {onOpenThread && (
                        <button
                          type="button"
                          onClick={() => onOpenThread(item.threadId, item.subject)}
                          className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs transition hover:bg-[var(--border)]/40 cursor-pointer"
                        >
                          Find in inbox
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              What this week looked like
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Rough topic buckets from subject lines in mail received this calendar week (not
              AI-generated — simple keyword grouping).
            </p>
            {digest.weeklyThemes.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                No themed mail in this week&apos;s window.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {digest.weeklyThemes.map((theme) => (
                  <li
                    key={theme.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{theme.label}</p>
                      <span className="text-sm text-[var(--text-muted)]">
                        {theme.messageCount} message{theme.messageCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    {theme.topDomains.length > 0 && (
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        Mostly from: {theme.topDomains.join(', ')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return (
      <section className="border-b border-[var(--border)]">
        <div className="p-5">{header}</div>
        {body}
      </section>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[var(--border)] p-5">{header}</div>
      {body}
    </div>
  );
}
