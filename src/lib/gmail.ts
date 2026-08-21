const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

function headers(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
}

async function gmailFetch<T = unknown>(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${GMAIL_API}${path}`, {
      ...init,
      headers: { ...headers(accessToken), ...init?.headers },
    });
    if (res.status === 429) {
      // Exponential backoff: 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    if (!res.ok) {
      const err: any = new Error(`Gmail API ${res.status}: ${res.statusText}`);
      err.status = res.status;
      try {
        err.details = await res.json();
      } catch {}
      throw err;
    }
    return res.json() as Promise<T>;
  }
  const err: any = new Error('Gmail API 429: Too Many Requests (after retries)');
  err.status = 429;
  throw err;
}

export interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body: string;
  labelIds: string[];
  unsubscribeLink: string | null;
  unsubscribePost: boolean;
  /** Present on sent-mail fetches when thread reply status is resolved. */
  replyStatus?: 'awaiting' | 'replied';
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function decodeBody(payload: any): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      if (part.parts) {
        const nested = decodeBody(part);
        if (nested) return nested;
      }
    }
  }
  return '';
}

function getHeader(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function parseUnsubscribeLink(unsubHeader: string): string | null {
  if (!unsubHeader) return null;
  const httpRe = new RegExp('<(https?://[^>]+)>');
  const mailtoRe = new RegExp('<(mailto:[^>]+)>');
  // Prefer the HTTPS one-click endpoint when both forms are present,
  // even if the mailto URI appears first in the header.
  const httpMatch = unsubHeader.match(httpRe);
  if (httpMatch?.[1]) return httpMatch[1];
  const mailtoMatch = unsubHeader.match(mailtoRe);
  if (mailtoMatch?.[1]) return mailtoMatch[1];
  return null;
}

function parseMessage(msg: any): Email {
  const hdrs = msg.payload?.headers ?? [];
  const unsubHeader = getHeader(hdrs, 'List-Unsubscribe');
  const unsubPostHeader = getHeader(hdrs, 'List-Unsubscribe-Post');
  const unsubscribeLink = parseUnsubscribeLink(unsubHeader);

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: getHeader(hdrs, 'Subject') || '(no subject)',
    from: getHeader(hdrs, 'From'),
    to: getHeader(hdrs, 'To'),
    date: getHeader(hdrs, 'Date'),
    snippet: msg.snippet ?? '',
    body: decodeBody(msg.payload),
    labelIds: msg.labelIds ?? [],
    unsubscribeLink,
    unsubscribePost: !!unsubPostHeader && !!unsubscribeLink?.startsWith('http'),
  };
}

// Header set reused for metadata-format message fetches. These are the only
// headers parseMessage needs for subject/from/to/date + unsubscribe detection,
// so a metadata fetch is equivalent to a full fetch for everything except the
// decoded body.
const METADATA_HEADERS = [
  'Subject',
  'From',
  'To',
  'Date',
  'List-Unsubscribe',
  'List-Unsubscribe-Post',
];

export async function listEmails(
  accessToken: string,
  options: {
    q?: string;
    labelIds?: string[];
    maxResults?: number;
    pageToken?: string;
    metadataOnly?: boolean;
  }
) {
  const params = new URLSearchParams();
  params.set('maxResults', String(options.maxResults ?? 25));
  if (options.q) params.set('q', options.q);
  if (options.pageToken) params.set('pageToken', options.pageToken);
  if (options.labelIds) {
    for (const l of options.labelIds) params.append('labelIds', l);
  }

  const listData = await gmailFetch<{
    messages?: Array<{ id: string }>;
    nextPageToken?: string;
  }>(accessToken, `/messages?${params}`);

  if (!listData.messages?.length) {
    return { emails: [], nextPageToken: null };
  }

  // metadata format is ~10x faster: only headers, no body parsing
  const format = options.metadataOnly ? 'metadata' : 'full';
  const msgParams = new URLSearchParams({ format });
  if (options.metadataOnly) {
    for (const h of METADATA_HEADERS) {
      msgParams.append('metadataHeaders', h);
    }
  }

  // Fetch in batches of 25 to avoid Gmail API 429 rate limits
  const BATCH_SIZE = 25;
  const emails: ReturnType<typeof parseMessage>[] = [];
  for (let i = 0; i < listData.messages.length; i += BATCH_SIZE) {
    const batch = listData.messages.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (m: any) => {
        const msg = await gmailFetch(accessToken, `/messages/${m.id}?${msgParams}`);
        return parseMessage(msg);
      })
    );
    emails.push(...results);
  }

  return { emails, nextPageToken: listData.nextPageToken ?? null };
}

export async function getThread(
  accessToken: string,
  threadId: string,
  options?: { metadataOnly?: boolean }
) {
  const format = options?.metadataOnly === false ? 'full' : 'metadata';
  const params = new URLSearchParams({ format });
  if (format === 'metadata') {
    for (const h of ['Subject', 'From', 'To', 'Date']) {
      params.append('metadataHeaders', h);
    }
  }

  const data = await gmailFetch<{ messages?: unknown[] }>(
    accessToken,
    `/threads/${threadId}?${params}`
  );
  const messages = (data.messages ?? []).map((msg) => parseMessage(msg));
  return { id: threadId, messages };
}

export async function getEmail(
  accessToken: string,
  id: string,
  options?: { metadataOnly?: boolean }
) {
  let path: string;
  if (options?.metadataOnly) {
    const params = new URLSearchParams({ format: 'metadata' });
    for (const h of METADATA_HEADERS) params.append('metadataHeaders', h);
    path = `/messages/${id}?${params}`;
  } else {
    path = `/messages/${id}?format=full`;
  }
  const data = await gmailFetch(accessToken, path);
  return parseMessage(data);
}
