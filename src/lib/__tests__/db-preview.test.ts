import { describe, expect, it, vi } from 'vitest';
import type { Email } from '../gmail';

const fixture = vi.hoisted(() => {
  const current = {
    id: 'fixture',
    snippet: 'you&#39;re',
    body: 'legacy',
    embedding: [1, 2],
    embeddingModel: 'current-model',
  };
  const put = vi.fn();
  const transaction = vi.fn(() => ({
    store: { get: vi.fn(async () => current), put },
    done: Promise.resolve(),
  }));
  return { current, put, transaction };
});
vi.mock('idb', () => ({ openDB: vi.fn(async () => ({ transaction: fixture.transaction })) }));
import { storeEmailPreview } from '../db';

describe('cached preview repair', () => {
  it('preserves raw snippet, body and embeddings while patching MIME provenance', async () => {
    const previewContent = { mimeType: 'text/plain' as const, text: "you're" };
    await storeEmailPreview(
      { id: 'fixture', snippet: 'different', previewContent } as Email,
      'synthetic-account'
    );
    expect(fixture.put).toHaveBeenCalledWith({ ...fixture.current, previewContent });
    expect(fixture.transaction).toHaveBeenCalledWith('emails', 'readwrite');
  });
});
