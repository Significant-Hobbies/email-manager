import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  getAllEmails: vi.fn(),
  getEmailCount: vi.fn(),
  getInboxSyncMeta: vi.fn(),
  setInboxSyncMeta: vi.fn(),
  storeEmails: vi.fn(),
}));

vi.mock('../db', () => dbMocks);

import { ensureInboxEmails, refreshInboxHead } from '../inbox-sync';
import type { InboxSyncMeta, StoredEmail } from '../db';

const CLEAN_META: InboxSyncMeta = {
  nextPageToken: undefined,
  exhausted: false,
  lastSyncedAt: null,
  lastError: null,
};

function makeEmail(id: string, date: string): StoredEmail {
  return {
    id,
    threadId: `t-${id}`,
    subject: `Subject ${id}`,
    from: 'sender@example.com',
    to: 'me@example.com',
    date,
    snippet: 'snippet',
    body: 'body',
    labelIds: ['INBOX'],
    unsubscribeLink: null,
    unsubscribePost: false,
    embedding: null,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ensureInboxEmails', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();
    dbMocks.getAllEmails.mockReset();
    dbMocks.getEmailCount.mockReset();
    dbMocks.getInboxSyncMeta.mockReset();
    dbMocks.setInboxSyncMeta.mockReset();
    dbMocks.storeEmails.mockReset();
    dbMocks.setInboxSyncMeta.mockResolvedValue(undefined);
    dbMocks.storeEmails.mockResolvedValue(undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns cached emails without fetching when target already met', async () => {
    const cached = [makeEmail('a', '2026-01-02'), makeEmail('b', '2026-01-01')];
    dbMocks.getAllEmails.mockResolvedValue(cached);
    dbMocks.getInboxSyncMeta.mockResolvedValue(CLEAN_META);

    const result = await ensureInboxEmails({ target: 2 });

    expect(result.fetched).toBe(0);
    expect(result.total).toBe(2);
    // Sorted newest-first.
    expect(result.emails[0].id).toBe('a');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns cached emails when inbox is already exhausted', async () => {
    const cached = [makeEmail('a', '2026-01-01')];
    dbMocks.getAllEmails.mockResolvedValue(cached);
    dbMocks.getInboxSyncMeta.mockResolvedValue({ ...CLEAN_META, exhausted: true });

    const result = await ensureInboxEmails({ target: 100 });

    expect(result.fetched).toBe(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('fetches pages until target is met and stores batches', async () => {
    // Start empty; count grows as we store.
    dbMocks.getAllEmails
      .mockResolvedValueOnce([]) // initial existing
      .mockResolvedValueOnce([makeEmail('a', '2026-01-02'), makeEmail('b', '2026-01-01')]); // final
    dbMocks.getEmailCount
      .mockResolvedValueOnce(0) // startingCount check (via getAllEmails.length actually)
      .mockResolvedValue(2); // after store, count >= target
    dbMocks.getInboxSyncMeta.mockResolvedValue(CLEAN_META);

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        emails: [makeEmail('a', '2026-01-02'), makeEmail('b', '2026-01-01')],
        nextPageToken: 'tok2',
      })
    ) as unknown as typeof fetch;

    const onProgress = vi.fn();
    const result = await ensureInboxEmails({ target: 2, onProgress });

    expect(result.fetched).toBe(2);
    expect(result.total).toBe(2);
    expect(dbMocks.storeEmails).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalled();
  });

  it('stops when a page returns no emails (exhausted)', async () => {
    dbMocks.getAllEmails.mockResolvedValue([]);
    dbMocks.getEmailCount.mockResolvedValue(0);
    dbMocks.getInboxSyncMeta.mockResolvedValue(CLEAN_META);

    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ emails: [], nextPageToken: undefined })
      ) as unknown as typeof fetch;

    const result = await ensureInboxEmails({ target: 50 });

    expect(result.fetched).toBe(0);
    // Meta should record exhausted=true with lastError null.
    expect(dbMocks.setInboxSyncMeta).toHaveBeenCalledWith(
      expect.objectContaining({ exhausted: true, lastError: null })
    );
  });

  it('records a classified error and throws on non-ok fetch', async () => {
    dbMocks.getAllEmails.mockResolvedValue([]);
    dbMocks.getEmailCount.mockResolvedValue(0);
    dbMocks.getInboxSyncMeta.mockResolvedValue(CLEAN_META);

    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 401 })) as unknown as typeof fetch;

    await expect(ensureInboxEmails({ target: 10 })).rejects.toThrow();
    // recordSyncError should have persisted an auth-classified lastError.
    expect(dbMocks.setInboxSyncMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        lastError: expect.objectContaining({ stage: 'auth', class: 'auth' }),
      })
    );
  });

  it('records a network error when fetch throws', async () => {
    dbMocks.getAllEmails.mockResolvedValue([]);
    dbMocks.getEmailCount.mockResolvedValue(0);
    dbMocks.getInboxSyncMeta.mockResolvedValue(CLEAN_META);

    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error('fetch failed')) as unknown as typeof fetch;

    await expect(ensureInboxEmails({ target: 10 })).rejects.toThrow('fetch failed');
    expect(dbMocks.setInboxSyncMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        lastError: expect.objectContaining({ stage: 'network', class: 'network' }),
      })
    );
  });
});

describe('refreshInboxHead', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    dbMocks.getAllEmails.mockReset();
    dbMocks.getEmailCount.mockReset();
    dbMocks.getInboxSyncMeta.mockReset();
    dbMocks.setInboxSyncMeta.mockReset();
    dbMocks.storeEmails.mockReset();
    dbMocks.setInboxSyncMeta.mockResolvedValue(undefined);
    dbMocks.storeEmails.mockResolvedValue(undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches recent emails and returns the count fetched', async () => {
    dbMocks.getAllEmails.mockResolvedValue([]);
    dbMocks.getInboxSyncMeta.mockResolvedValue(CLEAN_META);

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        emails: [makeEmail('a', '2026-01-02'), makeEmail('b', '2026-01-01')],
        nextPageToken: undefined,
      })
    ) as unknown as typeof fetch;

    const fetched = await refreshInboxHead({ maxEmails: 10 });
    expect(fetched).toBe(2);
    expect(dbMocks.storeEmails).toHaveBeenCalledTimes(1);
  });

  it('stops immediately when first page is empty', async () => {
    dbMocks.getAllEmails.mockResolvedValue([]);
    dbMocks.getInboxSyncMeta.mockResolvedValue(CLEAN_META);

    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ emails: [] })) as unknown as typeof fetch;

    const fetched = await refreshInboxHead();
    expect(fetched).toBe(0);
    expect(dbMocks.storeEmails).not.toHaveBeenCalled();
  });

  it('paginates until maxEmails is reached', async () => {
    dbMocks.getAllEmails.mockResolvedValue([]);
    dbMocks.getInboxSyncMeta.mockResolvedValue(CLEAN_META);

    const page = (n: number) =>
      jsonResponse({
        emails: Array.from({ length: n }, (_, i) => makeEmail(`e${i}`, '2026-01-01')),
        nextPageToken: 'more',
      });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(page(100))
      .mockResolvedValueOnce(page(50)) as unknown as typeof fetch;

    const fetched = await refreshInboxHead({ maxEmails: 150 });
    expect(fetched).toBe(150);
    expect(dbMocks.storeEmails).toHaveBeenCalledTimes(2);
  });
});
