import { describe, it, expect } from 'vitest';
import { buildWeeklyDigest, themeKeyFromSubject, type DigestEmailInput } from '../digest';

function makeEmail(overrides: Partial<DigestEmailInput> = {}): DigestEmailInput {
  return {
    id: '1',
    threadId: 't1',
    subject: 'Hello',
    from: 'friend@example.com',
    date: '2026-06-15T12:00:00Z',
    snippet: '',
    labelIds: [],
    ...overrides,
  };
}

describe('themeKeyFromSubject', () => {
  it('categorizes billing subjects', () => {
    expect(themeKeyFromSubject('Your invoice for June')).toBe('money');
    expect(themeKeyFromSubject('Payment receipt')).toBe('money');
  });

  it('categorizes scheduling subjects', () => {
    expect(themeKeyFromSubject('Meeting invite')).toBe('scheduling');
    expect(themeKeyFromSubject('Calendar: scheduled event')).toBe('scheduling');
  });

  it('categorizes work subjects', () => {
    expect(themeKeyFromSubject('Job interview next week')).toBe('work');
    expect(themeKeyFromSubject('Recruiter follow-up')).toBe('work');
  });

  it('defaults to general', () => {
    expect(themeKeyFromSubject('Random topic')).toBe('general');
  });
});

describe('buildWeeklyDigest', () => {
  const now = new Date('2026-06-23T00:00:00Z');

  it('returns empty digest for no emails', () => {
    const digest = buildWeeklyDigest([], { now });
    expect(digest.relationshipsQuiet).toHaveLength(0);
    expect(digest.threadsToRevisit).toHaveLength(0);
    expect(digest.weeklyThemes).toHaveLength(0);
    expect(digest.format).toBe('email-manager-weekly-digest');
  });

  it('detects quiet relationships', () => {
    const emails: DigestEmailInput[] = [
      makeEmail({ from: 'old@example.com', date: '2026-01-01T00:00:00Z' }),
      makeEmail({ from: 'old@example.com', date: '2026-01-02T00:00:00Z' }),
      makeEmail({ from: 'old@example.com', date: '2026-01-03T00:00:00Z' }),
    ];
    const digest = buildWeeklyDigest(emails, { now, quietWindowDays: 60, minPriorMessages: 3 });
    expect(digest.relationshipsQuiet).toHaveLength(1);
    expect(digest.relationshipsQuiet[0].senderEmail).toBe('old@example.com');
    expect(digest.relationshipsQuiet[0].priorMessageCount).toBe(3);
  });

  it('skips newsletter senders', () => {
    const emails: DigestEmailInput[] = [
      makeEmail({ from: 'newsletter@corp.com', date: '2026-01-01T00:00:00Z' }),
      makeEmail({ from: 'newsletter@corp.com', date: '2026-01-02T00:00:00Z' }),
      makeEmail({ from: 'newsletter@corp.com', date: '2026-01-03T00:00:00Z' }),
    ];
    const digest = buildWeeklyDigest(emails, { now });
    expect(digest.relationshipsQuiet).toHaveLength(0);
  });

  it('flags starred stale threads for revisit', () => {
    const emails: DigestEmailInput[] = [
      makeEmail({
        threadId: 'starred-thread',
        subject: 'Important',
        date: '2026-05-01T00:00:00Z',
        labelIds: ['STARRED'],
      }),
    ];
    const digest = buildWeeklyDigest(emails, { now, staleThreadDays: 14 });
    expect(digest.threadsToRevisit).toHaveLength(1);
    expect(digest.threadsToRevisit[0].reason).toBe('starred_stale');
  });

  it('flags long stale threads for revisit', () => {
    const emails: DigestEmailInput[] = Array.from({ length: 4 }, (_, i) =>
      makeEmail({ threadId: 'long-thread', date: `2026-05-0${i + 1}T00:00:00Z` })
    );
    const digest = buildWeeklyDigest(emails, { now, staleThreadDays: 14 });
    expect(digest.threadsToRevisit).toHaveLength(1);
    expect(digest.threadsToRevisit[0].reason).toBe('long_thread_stale');
    expect(digest.threadsToRevisit[0].messageCount).toBe(4);
  });
});
