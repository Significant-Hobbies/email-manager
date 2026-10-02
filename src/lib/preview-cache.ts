import { storeEmailPreview } from './db';
import type { Email } from './gmail';

const requests = new Map<
  string,
  { promise: Promise<Email>; consumers: Array<AbortSignal | undefined> }
>();
let active = 0;
const slots: Array<() => void> = [];

/** Account-scoped, deduplicated full-message reads; at most two active requests. */
export function hydrateEmailPreview(
  email: Email,
  accountId: string,
  signal?: AbortSignal
): Promise<Email> {
  const key = JSON.stringify([accountId, email.id]);
  const existing = requests.get(key);
  if (existing) {
    existing.consumers.push(signal);
    return existing.promise;
  }
  if (active >= 2 && slots.length >= 25) {
    return Promise.reject(new Error('Preview queue full'));
  }
  const consumers = [signal];
  const request = (async () => {
    if (active >= 2) await new Promise<void>((resolve) => slots.push(resolve));
    else active++;
    try {
      if (consumers.every((consumer) => consumer?.aborted)) {
        throw new DOMException('Preview no longer visible', 'AbortError');
      }
      const response = await fetch(`/api/emails/${encodeURIComponent(email.id)}`, {
        headers: { 'X-Mailbox-Account-Id': accountId },
      });
      if (!response.ok) throw new Error(`Preview unavailable (${response.status})`);
      const detail = (await response.json()) as Email;
      if (detail.id !== email.id) throw new Error('Preview message mismatch');
      if (detail.previewContent === undefined) throw new Error('Preview MIME source unavailable');
      // Cache failure must not hide a successfully fetched preview.
      await storeEmailPreview(detail, accountId).catch(() => {});
      return detail;
    } finally {
      const next = slots.shift();
      if (next) next();
      else active--;
    }
  })();
  requests.set(key, { promise: request, consumers });
  void request.catch(() => {
    // A later visibility/hover attempt may retry; rejection never starts a request.
    // An older failure must not evict a replacement for the same message.
    if (requests.get(key)?.promise === request) {
      requests.delete(key);
    }
  });
  // Bound cached reads; no automatic retries while mounted.
  if (requests.size > 200) requests.delete(requests.keys().next().value!);
  return request;
}
