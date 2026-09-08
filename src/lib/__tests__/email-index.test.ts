import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredEmail } from '../db';
import { getEmailsWithoutEmbedding, storeEmail } from '../db';
import { embed } from '../embeddings';
import { indexEmailsForSearch } from '../email-index';

vi.mock('../db', () => ({ getEmailsWithoutEmbedding: vi.fn(), storeEmail: vi.fn() }));
vi.mock('../embeddings', () => ({
  embed: vi.fn(),
  prepareEmailText: (email: StoredEmail) => email.subject,
}));
const emails: StoredEmail[] = ['older', 'newer'].map((id, i) => ({
  id,
  threadId: id,
  subject: id,
  from: 'fixture@example.invalid',
  body: id,
  snippet: id,
  date: `2026-09-0${i + 1}T00:00:00Z`,
  labels: ['INBOX'],
  embedding: null,
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getEmailsWithoutEmbedding).mockResolvedValue([...emails]);
  vi.mocked(embed).mockResolvedValue([1, 0]);
  vi.mocked(storeEmail).mockResolvedValue(undefined);
});

describe('search indexing completion accounting', () => {
  it('does not load the model for an already cancelled batch', async () => {
    const result = await indexEmailsForSearch({ accountId: 'fixture', signal: { aborted: true } });
    expect(result).toEqual({ indexed: 0, remaining: 2 });
    expect(embed).not.toHaveBeenCalled();
    expect(storeEmail).not.toHaveBeenCalled();
  });

  it('does not persist an inference that finishes after cancellation', async () => {
    const signal = { aborted: false };
    vi.mocked(embed).mockImplementation(async (text) => {
      if (text !== 'warmup') signal.aborted = true;
      return [1, 0];
    });
    const result = await indexEmailsForSearch({ accountId: 'fixture', signal });
    expect(result).toEqual({ indexed: 0, remaining: 2 });
    expect(storeEmail).not.toHaveBeenCalled();
  });

  it('counts a completed write but leaves the rest pending when cancelled during persistence', async () => {
    const signal = { aborted: false };
    vi.mocked(storeEmail).mockImplementation(async () => {
      signal.aborted = true;
    });
    const result = await indexEmailsForSearch({ accountId: 'fixture', signal });
    expect(result).toEqual({ indexed: 1, remaining: 1 });
    expect(storeEmail).toHaveBeenCalledExactlyOnceWith(
      { ...emails[1], embedding: [1, 0] },
      'fixture'
    );
  });

  it('reports all pending messages for a zero-sized batch', async () => {
    expect(await indexEmailsForSearch({ accountId: 'fixture', limit: 0 })).toEqual({
      indexed: 0,
      remaining: 2,
    });
    expect(embed).not.toHaveBeenCalled();
  });

  it('indexes the newest message first and leaves messages beyond the limit pending', async () => {
    expect(await indexEmailsForSearch({ accountId: 'fixture', limit: 1 })).toEqual({
      indexed: 1,
      remaining: 1,
    });
    expect(storeEmail).toHaveBeenCalledExactlyOnceWith(
      { ...emails[1], embedding: [1, 0] },
      'fixture'
    );
  });

  it('rejects a failed write instead of claiming completion', async () => {
    vi.mocked(storeEmail).mockRejectedValue(new Error('storage full'));
    await expect(indexEmailsForSearch({ accountId: 'fixture' })).rejects.toThrow('storage full');
    expect(storeEmail).toHaveBeenCalledTimes(1);
  });
});
