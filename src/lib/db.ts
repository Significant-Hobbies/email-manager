import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { hasCurrentEmbedding } from './embedding-contract';
import type { Email } from './gmail';

export interface StoredEmail extends Email {
  embedding: number[] | null;
  embeddingModel?: string;
}

export interface InboxSyncMeta {
  nextPageToken?: string;
  exhausted: boolean;
  lastSyncedAt: string | null;
  /**
   * Sanitized, durable record of the most recent unresolved sync failure.
   * Contains NO message content, addresses, subjects, or credentials — only
   * the failing stage, a coarse error class, and the timestamp. Cleared on
   * the next successful sync. Null when the last sync completed cleanly.
   */
  lastError?: {
    stage: 'fetch_page' | 'store' | 'auth' | 'network';
    /** Coarse class: http_4xx | http_5xx | http_429 | network | auth | unknown */
    class: string;
    at: string;
  } | null;
}

interface EmailDB extends DBSchema {
  emails: {
    key: string;
    value: StoredEmail;
    indexes: { 'by-date': string };
  };
  meta: {
    key: string;
    value: InboxSyncMeta;
  };
}

const DB_NAME = 'email-search-account';
const DB_VERSION = 2;
const INBOX_SYNC_META_KEY = 'inbox-sync';

const databases = new Map<string, Promise<IDBPDatabase<EmailDB>>>();

function getDB(accountId: string) {
  if (!accountId?.trim())
    throw new Error('An authenticated account is required for mailbox storage');
  let dbPromise = databases.get(accountId);
  if (!dbPromise) {
    dbPromise = openDB<EmailDB>(`${DB_NAME}:${encodeURIComponent(accountId)}`, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('emails')) {
          const store = db.createObjectStore('emails', { keyPath: 'id' });
          store.createIndex('by-date', 'date');
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
    databases.set(accountId, dbPromise);
  }
  return dbPromise;
}

export async function storeEmails(emails: StoredEmail[], accountId: string) {
  const db = await getDB(accountId);
  const tx = db.transaction('emails', 'readwrite');
  await Promise.all([...emails.map((e) => tx.store.put(e)), tx.done]);
}

export async function storeEmail(email: StoredEmail, accountId: string) {
  const db = await getDB(accountId);
  await db.put('emails', email);
}

export async function getAllEmails(accountId: string): Promise<StoredEmail[]> {
  const db = await getDB(accountId);
  return db.getAll('emails');
}

export async function getInboxEmailsSorted(accountId: string): Promise<StoredEmail[]> {
  const all = await getAllEmails(accountId);
  return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getEmailsWithoutEmbedding(accountId: string): Promise<StoredEmail[]> {
  const db = await getDB(accountId);
  const all = await db.getAll('emails');
  return all.filter((e) => !hasCurrentEmbedding(e));
}

export async function getEmailCount(accountId: string): Promise<number> {
  const db = await getDB(accountId);
  return db.count('emails');
}

export async function getIndexedCount(accountId: string): Promise<number> {
  const db = await getDB(accountId);
  const all = await db.getAll('emails');
  return all.filter(hasCurrentEmbedding).length;
}

export async function getPendingIndexCount(accountId: string): Promise<number> {
  const db = await getDB(accountId);
  const all = await db.getAll('emails');
  return all.filter((e) => !hasCurrentEmbedding(e)).length;
}

export async function getInboxSyncMeta(accountId: string): Promise<InboxSyncMeta> {
  const db = await getDB(accountId);
  const stored = await db.get('meta', INBOX_SYNC_META_KEY);
  return (
    stored ?? {
      nextPageToken: undefined,
      exhausted: false,
      lastSyncedAt: null,
    }
  );
}

export async function setInboxSyncMeta(meta: InboxSyncMeta, accountId: string): Promise<void> {
  const db = await getDB(accountId);
  await db.put('meta', meta, INBOX_SYNC_META_KEY);
}
