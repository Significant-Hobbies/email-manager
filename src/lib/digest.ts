/**
 * Weekly personal digest — pure, client-side logic.
 *
 * Operates on email rows already in IndexedDB (or fixtures). No network, no
 * server persistence. See docs/plans/2026-06-04-email-memories-digest.md.
 */

import type { Email } from './gmail';

const DIGEST_FORMAT = 'email-manager-weekly-digest' as const;
const DIGEST_FORMAT_VERSION = 1;

export interface DigestEmailInput
  extends Pick<Email, 'id' | 'threadId' | 'subject' | 'from' | 'date' | 'snippet' | 'labelIds'> {}

interface RelationshipQuiet {
  senderEmail: string;
  displayName: string;
  lastMessageAt: string;
  priorMessageCount: number;
  quietDays: number;
  reason: 'no_messages_in_quiet_window';
}

interface ThreadRevisit {
  threadId: string;
  subject: string;
  lastMessageAt: string;
  reason: 'starred_stale' | 'long_thread_stale';
  messageCount: number;
}

interface WeeklyTheme {
  id: string;
  label: string;
  messageCount: number;
  topDomains: string[];
}

export interface WeeklyDigest {
  format: typeof DIGEST_FORMAT;
  formatVersion: typeof DIGEST_FORMAT_VERSION;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  relationshipsQuiet: RelationshipQuiet[];
  threadsToRevisit: ThreadRevisit[];
  weeklyThemes: WeeklyTheme[];
}

export interface BuildWeeklyDigestOptions {
  /** ISO anchor for the digest week (defaults to now). */
  now?: Date;
  /** Days without mail before a historically active sender is "quiet". */
  quietWindowDays?: number;
  /** Minimum historical messages to consider a "relationship". */
  minPriorMessages?: number;
  /** Thread age in days for starred revisit prompts. */
  staleThreadDays?: number;
}

const NEWSLETTER_RE =
  /\b(newsletter|digest|weekly|roundup|webinar|promotion|sale|unsubscribe|noreply|no-reply)\b/i;

function parseSender(from: string): { email: string; displayName: string } {
  const emailMatch = from.match(/<([^>]+)>/);
  const email = (emailMatch?.[1] ?? from).toLowerCase().trim();
  const displayName = from.replace(/<[^>]+>/, '').trim() || email;
  return { email, displayName };
}

function domainFromEmail(email: string): string {
  const m = email.match(/@(.+)/);
  return m?.[1] ?? 'unknown';
}

function startOfUtcWeek(d: Date): Date {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  return copy;
}

function isNewsletterSender(email: string, displayName: string): boolean {
  return NEWSLETTER_RE.test(email) || NEWSLETTER_RE.test(displayName);
}

/**
 * Build a deterministic weekly digest from locally cached emails.
 */
export function buildWeeklyDigest(
  emails: DigestEmailInput[],
  options: BuildWeeklyDigestOptions = {}
): WeeklyDigest {
  const now = options.now ?? new Date();
  const quietWindowDays = options.quietWindowDays ?? 60;
  const minPriorMessages = options.minPriorMessages ?? 3;
  const staleThreadDays = options.staleThreadDays ?? 14;

  const periodEnd = startOfUtcWeek(now);
  const periodStart = new Date(periodEnd);
  periodStart.setUTCDate(periodStart.getUTCDate() - 7);

  const quietCutoff = new Date(now);
  quietCutoff.setUTCDate(quietCutoff.getUTCDate() - quietWindowDays);

  const staleCutoff = new Date(now);
  staleCutoff.setUTCDate(staleCutoff.getUTCDate() - staleThreadDays);

  const weekStartMs = periodStart.getTime();
  const weekEndMs = periodEnd.getTime() + 7 * 24 * 60 * 60 * 1000;
  const quietCutoffMs = quietCutoff.getTime();
  const staleCutoffMs = staleCutoff.getTime();
  const nowMs = now.getTime();

  const senderMap = new Map<string, { displayName: string; lastAt: number; count: number }>();

  const threadMap = new Map<
    string,
    {
      subject: string;
      lastAt: number;
      messageCount: number;
      starred: boolean;
    }
  >();

  const themeDomainCounts = new Map<string, Map<string, number>>();
  const senderCache = new Map<
    string,
    { email: string; displayName: string; newsletter: boolean; domain: string }
  >();
  const themeKeyCache = new Map<string, string>();

  for (const email of emails) {
    let senderDetails = senderCache.get(email.from);
    if (!senderDetails) {
      const parsed = parseSender(email.from);
      senderDetails = {
        ...parsed,
        newsletter: isNewsletterSender(parsed.email, parsed.displayName),
        domain: domainFromEmail(parsed.email),
      };
      senderCache.set(email.from, senderDetails);
    }
    if (senderDetails.newsletter) continue;

    const t = Date.parse(email.date);
    if (Number.isNaN(t)) continue;

    const sender = senderMap.get(senderDetails.email);
    if (sender) {
      if (t > sender.lastAt) sender.lastAt = t;
      sender.count += 1;
    } else {
      senderMap.set(senderDetails.email, {
        displayName: senderDetails.displayName,
        lastAt: t,
        count: 1,
      });
    }

    const thread = threadMap.get(email.threadId);
    if (thread) {
      if (t > thread.lastAt) thread.lastAt = t;
      thread.messageCount += 1;
      if (email.labelIds?.includes('STARRED')) thread.starred = true;
    } else {
      threadMap.set(email.threadId, {
        subject: email.subject,
        lastAt: t,
        messageCount: 1,
        starred: email.labelIds?.includes('STARRED') ?? false,
      });
    }

    if (t >= weekStartMs && t < weekEndMs) {
      let themeKey = themeKeyCache.get(email.subject);
      if (!themeKey) {
        themeKey = themeKeyFromSubject(email.subject);
        themeKeyCache.set(email.subject, themeKey);
      }
      const domainMap = themeDomainCounts.get(themeKey) ?? new Map();
      domainMap.set(senderDetails.domain, (domainMap.get(senderDetails.domain) ?? 0) + 1);
      themeDomainCounts.set(themeKey, domainMap);
    }
  }

  const relationshipsQuiet: RelationshipQuiet[] = [];
  for (const [senderEmail, data] of senderMap) {
    if (data.count < minPriorMessages) continue;
    if (data.lastAt >= quietCutoffMs) continue;
    const quietDays = Math.floor((nowMs - data.lastAt) / (24 * 60 * 60 * 1000));
    relationshipsQuiet.push({
      senderEmail,
      displayName: data.displayName,
      lastMessageAt: new Date(data.lastAt).toISOString(),
      priorMessageCount: data.count,
      quietDays,
      reason: 'no_messages_in_quiet_window',
    });
  }
  relationshipsQuiet.sort((a, b) => b.priorMessageCount - a.priorMessageCount);

  const threadsToRevisit: ThreadRevisit[] = [];
  for (const [threadId, data] of threadMap) {
    if (data.lastAt >= staleCutoffMs) continue;

    if (data.starred) {
      threadsToRevisit.push({
        threadId,
        subject: data.subject,
        lastMessageAt: new Date(data.lastAt).toISOString(),
        reason: 'starred_stale',
        messageCount: data.messageCount,
      });
      continue;
    }

    if (data.messageCount >= 4) {
      threadsToRevisit.push({
        threadId,
        subject: data.subject,
        lastMessageAt: new Date(data.lastAt).toISOString(),
        reason: 'long_thread_stale',
        messageCount: data.messageCount,
      });
    }
  }
  threadsToRevisit.sort((a, b) =>
    a.lastMessageAt < b.lastMessageAt ? -1 : a.lastMessageAt > b.lastMessageAt ? 1 : 0
  );

  const weeklyThemes: WeeklyTheme[] = [...themeDomainCounts.entries()]
    .map(([id, domainMap]) => {
      const entries = [...domainMap.entries()].sort((a, b) => b[1] - a[1]);
      const messageCount = entries.reduce((s, [, n]) => s + n, 0);
      return {
        id,
        label: themeLabelFromId(id),
        messageCount,
        topDomains: entries.slice(0, 3).map(([d]) => d),
      };
    })
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, 5);

  return {
    format: DIGEST_FORMAT,
    formatVersion: DIGEST_FORMAT_VERSION,
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    generatedAt: now.toISOString(),
    relationshipsQuiet,
    threadsToRevisit,
    weeklyThemes,
  };
}

/** Deterministic theme bucket from subject (no ML). */
export function themeKeyFromSubject(subject: string): string {
  const s = subject.toLowerCase();
  if (/\b(invoice|receipt|payment|billing)\b/.test(s)) return 'money';
  if (/\b(meeting|calendar|invite|scheduled)\b/.test(s)) return 'scheduling';
  if (/\b(job|interview|recruiter|offer)\b/.test(s)) return 'work';
  if (/\b(family|mom|dad|birthday)\b/.test(s)) return 'personal';
  if (/\b(ship|deliver|order|tracking)\b/.test(s)) return 'orders';
  return 'general';
}

function themeLabelFromId(id: string): string {
  const labels: Record<string, string> = {
    money: 'Money & billing',
    scheduling: 'Meetings & scheduling',
    work: 'Work & hiring',
    personal: 'Personal',
    orders: 'Orders & shipping',
    general: 'General',
  };
  return labels[id] ?? id;
}

/** Opt-in export payload for manual paste into Today Little Log. */
export function digestToTodayLittleLogExport(digest: WeeklyDigest): {
  format: 'email-manager-tll-digest-export';
  formatVersion: 1;
  date: string;
  source: 'email-manager';
  summary: string;
  axes: { id: string; label: string; value: number }[];
} {
  const quiet = digest.relationshipsQuiet.length;
  const revisit = digest.threadsToRevisit.length;
  const themes = digest.weeklyThemes.length;
  return {
    format: 'email-manager-tll-digest-export',
    formatVersion: 1,
    date: digest.periodEnd,
    source: 'email-manager',
    summary: `Week ${digest.periodStart}–${digest.periodEnd}: ${quiet} quiet relationship(s), ${revisit} thread(s) to revisit, ${themes} theme(s). Generated in Kinetic; no message bodies included.`,
    axes: [
      { id: 'quiet-relationships', label: 'Reconnect', value: quiet },
      { id: 'threads-revisit', label: 'Revisit threads', value: revisit },
      { id: 'weekly-themes', label: 'Themes', value: themes },
    ],
  };
}
