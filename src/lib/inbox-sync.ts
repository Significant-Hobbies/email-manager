import {
  getAllEmails,
  getEmailCount,
  getInboxSyncMeta,
  setInboxSyncMeta,
  storeEmails,
  type InboxSyncMeta,
  type StoredEmail,
} from './db';
import type { Email } from './gmail';

export const DEFAULT_INBOX_SYNC = 500;
const REFRESH_HEAD_COUNT = 100;
export const SYNC_MAX_PAGE = 500;

export type SyncErrorStage = NonNullable<NonNullable<InboxSyncMeta['lastError']>['stage']>;

/** Coarse, privacy-safe error class for durable sync failure evidence. */
export function classifySyncError(err: unknown): { stage: SyncErrorStage; class: string } {
  const e = err as { status?: number; code?: number; message?: string };
  const status = e?.status ?? e?.code;
  if (status === 401 || status === 403) return { stage: 'auth', class: 'auth' };
  if (status === 429) return { stage: 'fetch_page', class: 'http_429' };
  if (typeof status === 'number' && status >= 500)
    return { stage: 'fetch_page', class: 'http_5xx' };
  if (typeof status === 'number' && status >= 400)
    return { stage: 'fetch_page', class: 'http_4xx' };
  if (e?.message && /network|fetch|abort|timeout/i.test(e.message)) {
    return { stage: 'network', class: 'network' };
  }
  return { stage: 'fetch_page', class: 'unknown' };
}

async function recordSyncError(error: unknown, meta: InboxSyncMeta): Promise<void> {
  const { stage, class: errorClass } = classifySyncError(error);
  await setInboxSyncMeta({
    ...meta,
    lastError: { stage, class: errorClass, at: new Date().toISOString() },
  });
}

async function fetchInboxPage(
  params: URLSearchParams,
  signal: AbortSignal | undefined,
  failureMeta: InboxSyncMeta
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`/api/emails?${params}`, { signal });
  } catch (error) {
    await recordSyncError(error, failureMeta);
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`API error: ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    await recordSyncError(error, failureMeta);
    throw error;
  }

  return response;
}

function withCachedEmbeddings(
  emails: Email[],
  embeddingById: Map<string, StoredEmail['embedding']>
): StoredEmail[] {
  return emails.map((email) => ({
    ...email,
    embedding: embeddingById.get(email.id) ?? null,
  }));
}

export interface EnsureInboxOptions {
  target: number;
  metadataOnly?: boolean;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
}

export interface EnsureInboxResult {
  emails: StoredEmail[];
  fetched: number;
  total: number;
}

/** Fetch inbox pages from Gmail and persist to IndexedDB until target is met or pages end. */
export async function ensureInboxEmails(options: EnsureInboxOptions): Promise<EnsureInboxResult> {
  const { target, metadataOnly = false, onProgress, signal } = options;
  const existing = await getAllEmails();
  const embeddingById = new Map(existing.map((e) => [e.id, e.embedding]));
  const meta = await getInboxSyncMeta();

  let fetchedThisRun = 0;
  let pageToken = meta.exhausted ? undefined : meta.nextPageToken;
  let exhausted = meta.exhausted;

  const startingCount = existing.length;
  if (startingCount >= target || exhausted) {
    onProgress?.(
      startingCount >= target
        ? `${startingCount} emails cached`
        : `${startingCount} emails cached (inbox exhausted)`
    );
    return {
      emails: existing.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      fetched: 0,
      total: startingCount,
    };
  }

  onProgress?.(`Syncing inbox… ${startingCount}/${target}`);

  while ((await getEmailCount()) < target && !exhausted) {
    if (signal?.aborted) break;

    const currentCount = await getEmailCount();
    const params = new URLSearchParams({
      label: 'INBOX',
      maxResults: String(Math.min(SYNC_MAX_PAGE, target - currentCount)),
    });
    if (metadataOnly) params.set('metadataOnly', 'true');
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetchInboxPage(params, signal, {
      ...meta,
      nextPageToken: pageToken,
      exhausted,
      lastSyncedAt: meta.lastSyncedAt,
    });

    const data = await res.json();
    const batch: Email[] = data.emails ?? [];

    if (batch.length > 0) {
      try {
        await storeEmails(withCachedEmbeddings(batch, embeddingById));
      } catch (storeErr) {
        await recordSyncError(storeErr, {
          ...meta,
          nextPageToken: pageToken,
          exhausted,
          lastSyncedAt: meta.lastSyncedAt,
        });
        throw storeErr;
      }
      fetchedThisRun += batch.length;
      onProgress?.(`Syncing inbox… ${currentCount + batch.length}/${target}`);
    }

    pageToken = data.nextPageToken ?? undefined;
    exhausted = batch.length === 0 || !pageToken;

    await setInboxSyncMeta({
      nextPageToken: pageToken,
      exhausted,
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
    });
  }

  const all = await getAllEmails();
  return {
    emails: all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    fetched: fetchedThisRun,
    total: all.length,
  };
}

/**
 * Re-fetch the newest inbox messages from Gmail and merge into the local cache.
 * Always starts from the top of the inbox so returning users see fresh mail.
 */
export async function refreshInboxHead(options?: {
  maxEmails?: number;
  metadataOnly?: boolean;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
}): Promise<number> {
  const maxEmails = options?.maxEmails ?? REFRESH_HEAD_COUNT;
  const existing = await getAllEmails();
  const embeddingById = new Map(existing.map((e) => [e.id, e.embedding]));

  let fetched = 0;
  let pageToken: string | undefined;

  options?.onProgress?.('Checking for new mail…');

  const meta = await getInboxSyncMeta();

  do {
    if (options?.signal?.aborted) break;

    const params = new URLSearchParams({
      label: 'INBOX',
      maxResults: String(Math.min(100, maxEmails - fetched)),
    });
    if (options?.metadataOnly) params.set('metadataOnly', 'true');
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetchInboxPage(params, options?.signal, {
      ...meta,
      lastSyncedAt: meta.lastSyncedAt,
    });

    const data = await res.json();
    const batch: Email[] = data.emails ?? [];

    if (batch.length > 0) {
      await storeEmails(withCachedEmbeddings(batch, embeddingById));
      fetched += batch.length;
      options?.onProgress?.(`Updated ${fetched} recent emails…`);
    }

    pageToken = data.nextPageToken ?? undefined;
    if (batch.length === 0 || !pageToken) break;
  } while (fetched < maxEmails);

  await setInboxSyncMeta({
    ...meta,
    lastSyncedAt: new Date().toISOString(),
    lastError: null,
  });

  return fetched;
}
