import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Email } from '../gmail';

const db = vi.hoisted(() => ({ storeEmailPreview: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../db', () => db);
const email = { id: 'fixture', snippet: 'you&#39;re' } as Email;
const detail = { ...email, previewContent: { mimeType: 'text/plain', text: "you're" } };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.resetModules();
});

describe('lazy full-message preview cache', () => {
  it('deduplicates by account and message, persists only verified preview provenance', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => Response.json(detail));
    vi.stubGlobal('fetch', fetchMock);
    const { hydrateEmailPreview } = await import('../preview-cache');
    const first = hydrateEmailPreview(email, 'account-a');
    expect(hydrateEmailPreview(email, 'account-a')).toBe(first);
    expect(await first).toEqual(detail);
    await hydrateEmailPreview(email, 'account-b');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/emails/fixture');
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'X-Mailbox-Account-Id': 'account-a' });
    expect(db.storeEmailPreview).toHaveBeenCalledWith(detail, 'account-a');
    expect(email.snippet).toBe('you&#39;re');
  });

  it('limits concurrent full-message reads to two', async () => {
    const releases: Array<() => void> = [];
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          releases.push(() => resolve(Response.json(detail)));
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { hydrateEmailPreview } = await import('../preview-cache');
    const pending = ['a', 'b', 'c'].map((account) => hydrateEmailPreview(email, account));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    releases[0]();
    await pending[0];
    expect(fetchMock).toHaveBeenCalledTimes(3);
    releases[1]();
    releases[2]();
    await Promise.all(pending);
  });

  it('does not fetch queued previews that leave the viewport', async () => {
    const releases: Array<() => void> = [];
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          releases.push(() => resolve(Response.json(detail)));
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { hydrateEmailPreview } = await import('../preview-cache');
    const first = hydrateEmailPreview(email, 'a');
    const second = hydrateEmailPreview(email, 'b');
    const controller = new AbortController();
    const third = hydrateEmailPreview(email, 'c', controller.signal);
    const aborted = expect(third).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    releases[0]();
    releases[1]();
    await Promise.all([first, second, aborted]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retry = hydrateEmailPreview(email, 'c');
    expect(retry).not.toBe(third);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    releases[2]();
    await expect(retry).resolves.toEqual(detail);
  });

  it('keeps a queued shared read when only one consumer aborts', async () => {
    const releases: Array<() => void> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            releases.push(() => resolve(Response.json(detail)));
          })
      )
    );
    const { hydrateEmailPreview } = await import('../preview-cache');
    const first = hydrateEmailPreview(email, 'a');
    const second = hydrateEmailPreview(email, 'b');
    const leaving = new AbortController();
    const remaining = new AbortController();
    const queued = hydrateEmailPreview(email, 'c', leaving.signal);
    expect(hydrateEmailPreview(email, 'c', remaining.signal)).toBe(queued);
    leaving.abort();
    releases[0]();
    await first;
    expect(releases).toHaveLength(3);
    releases[1]();
    releases[2]();
    await expect(queued).resolves.toEqual(detail);
    await second;
    expect(db.storeEmailPreview).toHaveBeenCalledWith(detail, 'c');
  });

  it('recovers from a shared 503 only on a later hydration attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockImplementation(async () => Response.json(detail));
    vi.stubGlobal('fetch', fetchMock);
    const { hydrateEmailPreview } = await import('../preview-cache');
    const controller = new AbortController();
    const failed = hydrateEmailPreview(email, 'account', controller.signal);
    expect(hydrateEmailPreview(email, 'account')).toBe(failed);
    controller.abort();
    await expect(failed).rejects.toThrow('503');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(db.storeEmailPreview).not.toHaveBeenCalled();
    expect(email.snippet).toBe('you&#39;re');

    const recovered = hydrateEmailPreview(email, 'account');
    expect(recovered).not.toBe(failed);
    expect(hydrateEmailPreview(email, 'account')).toBe(recovered);
    await expect(recovered).resolves.toEqual(detail);
    expect(hydrateEmailPreview(email, 'account')).toBe(recovered);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(db.storeEmailPreview).toHaveBeenCalledExactlyOnceWith(detail, 'account');
  });

  it('keeps encoded fallback and never automatically retries failed hydration', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    const { hydrateEmailPreview } = await import('../preview-cache');
    await expect(hydrateEmailPreview(email, 'account')).rejects.toThrow('403');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(hydrateEmailPreview(email, 'account')).rejects.toThrow('403');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(db.storeEmailPreview).not.toHaveBeenCalled();
    expect(email.snippet).toBe('you&#39;re');
  });

  it('does not accept a metadata response as verified full-message content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(email)));
    const { hydrateEmailPreview } = await import('../preview-cache');
    await expect(hydrateEmailPreview(email, 'account')).rejects.toThrow('MIME source unavailable');
    expect(db.storeEmailPreview).not.toHaveBeenCalled();
  });
});
