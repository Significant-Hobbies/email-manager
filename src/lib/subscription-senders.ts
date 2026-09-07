import { getAllEmails } from './db';
import type { Email } from './gmail';

export function senderKey(from: string): string {
  return (
    from
      .match(/<([^>]+)>/)?.[1]
      ?.toLowerCase()
      .trim() ?? from.toLowerCase().trim()
  );
}

/** One representative email per sender that has an unsubscribe link. */
export function uniqueSubscriptionSenders(emails: Email[]): Email[] {
  const seen = new Set<string>();
  return emails
    .filter((e) => e.unsubscribeLink)
    .filter((e) => {
      const sender = senderKey(e.from);
      if (!sender || seen.has(sender)) return false;
      seen.add(sender);
      return true;
    });
}

export async function loadSubscriptionSenders(accountId: string): Promise<Email[]> {
  const all = await getAllEmails(accountId);
  return uniqueSubscriptionSenders(all);
}
