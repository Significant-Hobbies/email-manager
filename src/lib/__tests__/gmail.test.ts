import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getEmail, getThread, listEmails } from '../gmail';

describe('gmail', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  /** Build a minimal Gmail message payload for parseMessage coverage. */
  function makeMessage(overrides: Record<string, unknown> = {}) {
    return {
      id: 'msg-1',
      threadId: 'thread-1',
      snippet: 'Hello world',
      labelIds: ['INBOX'],
      payload: {
        headers: [
          { name: 'Subject', value: 'Test subject' },
          { name: 'From', value: 'sender@example.com' },
          { name: 'To', value: 'me@example.com' },
          { name: 'Date', value: 'Thu, 1 Jan 2026 00:00:00 +0000' },
          { name: 'List-Unsubscribe', value: '<https:// unsub.example.com>' },
          { name: 'List-Unsubscribe-Post', value: 'List-Unsubscribe=One-Click' },
        ],
        body: { data: btoa('plain body') },
      },
      ...overrides,
    };
  }

  function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  describe('listEmails', () => {
    it('returns empty result when no messages', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({})) as unknown as typeof fetch;
      const result = await listEmails('token', { maxResults: 10 });
      expect(result.emails).toEqual([]);
      expect(result.nextPageToken).toBeNull();
    });

    it('fetches and parses messages in full format', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ messages: [{ id: 'a' }, { id: 'b' }], nextPageToken: 'tok' })
        )
        .mockResolvedValueOnce(jsonResponse(makeMessage({ id: 'a' })))
        .mockResolvedValueOnce(jsonResponse(makeMessage({ id: 'b' }))) as unknown as typeof fetch;

      const result = await listEmails('token', { maxResults: 2 });
      expect(result.emails).toHaveLength(2);
      expect(result.emails[0].id).toBe('a');
      expect(result.emails[0].subject).toBe('Test subject');
      expect(result.emails[0].from).toBe('sender@example.com');
      expect(result.emails[0].body).toBe('plain body');
      expect(result.nextPageToken).toBe('tok');
    });

    it('uses metadata format and appends metadataHeaders when metadataOnly', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ messages: [{ id: 'a' }] }))
        .mockResolvedValueOnce(jsonResponse(makeMessage({ id: 'a' }))) as unknown as typeof fetch;
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await listEmails('token', { maxResults: 1, metadataOnly: true });
      // The message fetch URL should contain format=metadata
      const msgCall = fetchMock.mock.calls[1][0] as string;
      expect(msgCall).toContain('format=metadata');
      expect(msgCall).toContain('metadataHeaders');
    });

    it('passes query, labelIds, and pageToken to list request', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ messages: [] })) as unknown as typeof fetch;
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await listEmails('token', {
        q: 'from:boss',
        labelIds: ['INBOX', 'STARRED'],
        pageToken: 'page1',
        maxResults: 5,
      });
      const listUrl = fetchMock.mock.calls[0][0] as string;
      expect(listUrl).toContain('q=from%3Aboss');
      expect(listUrl).toContain('labelIds=INBOX');
      expect(listUrl).toContain('pageToken=page1');
      expect(listUrl).toContain('maxResults=5');
    });
  });

  describe('getEmail', () => {
    it('fetches a single message in full format by default', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(makeMessage({ id: 'x' }))) as unknown as typeof fetch;
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const email = await getEmail('token', 'x');
      expect(email.id).toBe('x');
      expect(email.body).toBe('plain body');
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('format=full');
    });

    it('uses metadata format when metadataOnly', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(makeMessage({ id: 'x' }))) as unknown as typeof fetch;
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const email = await getEmail('token', 'x', { metadataOnly: true });
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('format=metadata');
      expect(email.id).toBe('x');
    });
  });

  describe('getThread', () => {
    it('returns parsed messages for a thread', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        jsonResponse({
          messages: [makeMessage({ id: 'm1' }), makeMessage({ id: 'm2' })],
        })
      ) as unknown as typeof fetch;

      const thread = await getThread('token', 'thread-1');
      expect(thread.id).toBe('thread-1');
      expect(thread.messages).toHaveLength(2);
      expect(thread.messages[0].id).toBe('m1');
    });

    it('uses full format when metadataOnly is false', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ messages: [] })) as unknown as typeof fetch;
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await getThread('token', 't', { metadataOnly: false });
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('format=full');
    });
  });

  describe('parseMessage edge cases (via getEmail)', () => {
    it('falls back to (no subject) when subject header missing', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        jsonResponse({
          id: 'x',
          threadId: 't',
          snippet: 's',
          labelIds: [],
          payload: { headers: [], body: { data: btoa('b') } },
        })
      ) as unknown as typeof fetch;
      const email = await getEmail('token', 'x');
      expect(email.subject).toBe('(no subject)');
      expect(email.unsubscribeLink).toBeNull();
      expect(email.unsubscribePost).toBe(false);
    });

    it('decodes html part when no top-level body data', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        jsonResponse({
          id: 'x',
          threadId: 't',
          snippet: 's',
          labelIds: [],
          payload: {
            headers: [{ name: 'Subject', value: 'S' }],
            parts: [
              { mimeType: 'text/html', body: { data: btoa('<p>html</p>') } },
              { mimeType: 'text/plain', body: { data: btoa('plain') } },
            ],
          },
        })
      ) as unknown as typeof fetch;
      const email = await getEmail('token', 'x');
      expect(email.body).toBe('<p>html</p>');
    });

    it('decodes nested plain part when html part has no data', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        jsonResponse({
          id: 'x',
          threadId: 't',
          snippet: 's',
          labelIds: [],
          payload: {
            headers: [{ name: 'Subject', value: 'S' }],
            parts: [
              {
                mimeType: 'multipart/alternative',
                parts: [{ mimeType: 'text/plain', body: { data: btoa('nested plain') } }],
              },
            ],
          },
        })
      ) as unknown as typeof fetch;
      const email = await getEmail('token', 'x');
      expect(email.body).toBe('nested plain');
    });

    it('prefers https unsubscribe link over mailto', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        jsonResponse({
          id: 'x',
          threadId: 't',
          snippet: 's',
          labelIds: [],
          payload: {
            headers: [
              { name: 'Subject', value: 'S' },
              {
                name: 'List-Unsubscribe',
                value: '<mailto:unsub@example.com>, <https:// unsub.example.com>',
              },
              { name: 'List-Unsubscribe-Post', value: 'List-Unsubscribe=One-Click' },
            ],
            body: { data: btoa('b') },
          },
        })
      ) as unknown as typeof fetch;
      const email = await getEmail('token', 'x');
      expect(email.unsubscribeLink).toBe('https:// unsub.example.com');
      expect(email.unsubscribePost).toBe(true);
    });

    it('uses mailto link when no http link present', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        jsonResponse({
          id: 'x',
          threadId: 't',
          snippet: 's',
          labelIds: [],
          payload: {
            headers: [
              { name: 'Subject', value: 'S' },
              { name: 'List-Unsubscribe', value: '<mailto:unsub@example.com>' },
            ],
            body: { data: btoa('b') },
          },
        })
      ) as unknown as typeof fetch;
      const email = await getEmail('token', 'x');
      expect(email.unsubscribeLink).toBe('mailto:unsub@example.com');
      // mailto is not http, so unsubscribePost should be false
      expect(email.unsubscribePost).toBe(false);
    });
  });

  describe('gmailFetch error handling', () => {
    it('throws with status on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'bad' }), {
          status: 403,
          statusText: 'Forbidden',
        })
      ) as unknown as typeof fetch;

      await expect(getEmail('token', 'x')).rejects.toThrow();
      await expect(getEmail('token', 'x')).rejects.toMatchObject({ status: 403 });
    });

    it('retries on 429 with exponential backoff then succeeds', async () => {
      vi.useFakeTimers();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response('', { status: 429 }))
        .mockResolvedValueOnce(jsonResponse(makeMessage({ id: 'x' }))) as unknown as typeof fetch;
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const promise = getEmail('token', 'x');
      // Advance past the 1s backoff
      await vi.advanceTimersByTimeAsync(1500);
      const email = await promise;
      expect(email.id).toBe('x');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws 429 after exhausting retries', async () => {
      vi.useFakeTimers();
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response('', { status: 429 })) as unknown as typeof fetch;

      // Catch eagerly to avoid an unhandled rejection surfacing after the test.
      const promise = getEmail('token', 'x').catch((e) => e);
      await vi.advanceTimersByTimeAsync(10_000);
      const result = await promise;
      expect(result).toMatchObject({ status: 429 });
    });
  });
});
