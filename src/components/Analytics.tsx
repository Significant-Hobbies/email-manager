'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Email } from '@/lib/gmail';
import { EmailHoverPreview } from '@/components/EmailHoverPreview';
import { useMailboxStore } from '@/components/MailboxStoreProvider';
import { formatEmailDateShort } from '@/lib/format-date';

interface SenderStat {
  email: string;
  domain: string;
  displayName: string;
  count: number;
  unsubscribeLink: string | null;
  unsubscribePost: boolean;
}

const BUCKET_OPTIONS = [
  { label: '50', value: 50 },
  { label: '100', value: 100 },
  { label: '500', value: 500 },
  { label: '1k', value: 1000 },
  { label: '5k', value: 5000 },
];

function formatDateRange(oldest: string, newest: string): string {
  const o = new Date(oldest);
  const n = new Date(newest);
  const diffMs = n.getTime() - o.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (diffDays === 0) return `today (${fmtDate(n)})`;
  if (diffDays === 1) return `last 1 day`;
  if (diffDays < 30) return `${diffDays} days (${fmtDate(o)} – ${fmtDate(n)})`;
  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12)
    return `~${diffMonths} month${diffMonths > 1 ? 's' : ''} (${fmtDate(o)} – ${fmtDate(n)})`;
  const diffYears = (diffDays / 365).toFixed(1);
  return `~${diffYears} years (${fmtDate(o)} – ${fmtDate(n)})`;
}

const ANGLE_BRACKET_RE = new RegExp('<([^>]+)>');
const STRIP_ANGLE_BRACKETS_RE = new RegExp('<[^>]+>');

function getEmailsForSenderFromList(emails: Email[], senderEmail: string): Email[] {
  return emails
    .filter((e) => {
      const m = e.from.match(ANGLE_BRACKET_RE);
      const addr = (m?.[1] ?? e.from).toLowerCase().trim();
      return addr === senderEmail;
    })
    .slice(0, 20);
}

interface ComputedStats {
  stats: SenderStat[];
  totalEmails: number;
  dateRange: string;
}

function computeSenderStats(emails: Email[]): ComputedStats {
  const totalEmails = emails.length;
  let dateRange = '';

  if (emails.length > 0) {
    const dates = emails
      .map((e) => new Date(e.date).getTime())
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => a - b);
    if (dates.length > 0) {
      dateRange = formatDateRange(
        new Date(dates[0]).toISOString(),
        new Date(dates[dates.length - 1]).toISOString()
      );
    }
  }

  const senderMap = new Map<string, SenderStat>();
  for (const email of emails) {
    const emailMatch = email.from.match(ANGLE_BRACKET_RE);
    const senderEmail = (emailMatch?.[1] ?? email.from).toLowerCase().trim();
    const domainMatch = senderEmail.match(/@(.+)/);
    const domain = domainMatch?.[1] ?? 'unknown';
    const displayName = email.from.replace(STRIP_ANGLE_BRACKETS_RE, '').trim() || senderEmail;

    const existing = senderMap.get(senderEmail);
    if (existing) {
      existing.count++;
      if (!existing.unsubscribeLink && email.unsubscribeLink) {
        existing.unsubscribeLink = email.unsubscribeLink;
        existing.unsubscribePost = email.unsubscribePost;
      }
    } else {
      senderMap.set(senderEmail, {
        email: senderEmail,
        domain,
        displayName,
        count: 1,
        unsubscribeLink: email.unsubscribeLink,
        unsubscribePost: email.unsubscribePost,
      });
    }
  }

  return {
    stats: Array.from(senderMap.values()).sort((a, b) => b.count - a.count),
    totalEmails,
    dateRange,
  };
}

function SenderRow({
  sender,
  maxCount,
  expanded,
  onToggle,
  senderEmails,
}: {
  sender: SenderStat;
  maxCount: number;
  expanded: boolean;
  onToggle: () => void;
  senderEmails: Email[];
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-elevated)] transition cursor-pointer text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{sender.displayName}</div>
          <div className="text-xs text-[var(--text-muted)] truncate">{sender.email}</div>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          <div className="w-24 h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] rounded-full"
              style={{ width: `${(sender.count / maxCount) * 100}%` }}
            />
          </div>
          <span className="text-sm font-medium tabular-nums w-8 text-right">{sender.count}</span>
        </div>
      </button>
      {expanded ? (
        <div className="px-4 pb-3 space-y-1 bg-[var(--bg-elevated)]/50">
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-[var(--text-muted)]">Recent messages</span>
            {sender.unsubscribeLink && (
              <a
                href={sender.unsubscribeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--danger)] hover:underline"
              >
                Unsubscribe
              </a>
            )}
          </div>
          {senderEmails.map((email) => (
            <EmailHoverPreview key={email.id} email={email}>
              <div className="text-xs py-1 truncate">
                <span className="text-[var(--text-muted)]">{formatEmailDateShort(email.date)}</span>{' '}
                {email.subject}
              </div>
            </EmailHoverPreview>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AnalyticsHeader({
  totalEmails,
  dateRange,
  bucket,
  setBucket,
  statusLine,
}: {
  totalEmails: number;
  dateRange: string;
  bucket: number;
  setBucket: (v: number) => void;
  statusLine: string;
}) {
  return (
    <div className="p-4 border-b border-[var(--border)]">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Analytics</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Sender frequency from your shared local inbox index
            {totalEmails > 0 && dateRange ? ` · ${dateRange}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {BUCKET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setBucket(opt.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                bucket === opt.value
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {statusLine ? <p className="mt-2 text-xs text-[var(--text-muted)]">{statusLine}</p> : null}
    </div>
  );
}

export function Analytics() {
  const { ensureInboxCount, getInboxSlice, syncing, progress: storeProgress } = useMailboxStore();
  const [stats, setStats] = useState<SenderStat[]>([]);
  const [sampleEmails, setSampleEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [totalEmails, setTotalEmails] = useState(0);
  const [dateRange, setDateRange] = useState('');
  const [bucket, setBucket] = useState(100);

  const computeStats = useCallback((emails: Email[]) => {
    const result = computeSenderStats(emails);
    setSampleEmails(emails);
    setTotalEmails(result.totalEmails);
    setDateRange(result.dateRange);
    setStats(result.stats);
    setLoading(false);
    setProgress('');
  }, []);

  const loadAnalytics = useCallback(
    async (target: number) => {
      setLoading(true);
      setError(null);
      setProgress(`Loading ${target} emails from local index…`);

      try {
        const cached = getInboxSlice(target);
        if (cached.length >= target) {
          computeStats(cached.slice(0, target));
          return;
        }

        setProgress(`Syncing inbox… ${cached.length}/${target}`);
        const emails = await ensureInboxCount(target, { metadataOnly: true });
        computeStats(emails.slice(0, target));
      } catch (err) {
        console.error('Analytics load error:', err);
        setError("Couldn't load email data. Check your connection.");
        setLoading(false);
        setProgress('');
      }
    },
    [computeStats, ensureInboxCount, getInboxSlice]
  );

  useEffect(() => {
    void loadAnalytics(bucket);
  }, [bucket, loadAnalytics]);

  const [expanded, setExpanded] = useState<string | null>(null);

  const getEmailsForSender = useCallback(
    (senderEmail: string): Email[] => getEmailsForSenderFromList(sampleEmails, senderEmail),
    [sampleEmails]
  );

  const maxCount = stats[0]?.count ?? 1;
  const statusLine = progress || (syncing ? storeProgress : '');

  return (
    <div className="flex-1 overflow-y-auto">
      <AnalyticsHeader
        totalEmails={totalEmails}
        dateRange={dateRange}
        bucket={bucket}
        setBucket={setBucket}
        statusLine={statusLine}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <AnalyticsError error={error} onRetry={() => loadAnalytics(bucket)} />
      ) : stats.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
          No email data yet — sync your inbox from the sidebar
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {stats.map((sender) => (
            <SenderRow
              key={sender.email}
              sender={sender}
              maxCount={maxCount}
              expanded={expanded === sender.email}
              onToggle={() => setExpanded(expanded === sender.email ? null : sender.email)}
              senderEmails={getEmailsForSender(sender.email)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyticsError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center space-y-4 max-w-sm px-6">
        <p className="text-sm text-[var(--text-muted)]">{error}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition cursor-pointer text-sm font-medium"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
