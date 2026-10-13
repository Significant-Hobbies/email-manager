import type { Email } from '@/lib/gmail';
import { appendSamplePage, emptyInboxSample, sliceSample } from '@/lib/inbox-sample';

const messages = [
  [
    'Atlas Travel',
    'Your summer flight confirmation',
    'Your fictional flight to the coast is confirmed for July 14. Keep this confirmation for your travel plans.',
  ],
  [
    'Morgan at Studio',
    'Design review on Thursday',
    'Let’s review the prototype on Thursday at 10. Bring your notes about the navigation and search experience.',
  ],
  [
    'Field Notes',
    'This week in the garden',
    'Our sample newsletter covers planting herbs, watering seedlings, and preparing a small balcony garden.',
  ],
  [
    'Harbor Books',
    'Receipt for your book order',
    'Thank you for your fictional order. Your field guide and notebook will arrive next week.',
  ],
];

/** Fictional fixtures only: never seed an authenticated mailbox or persistent cache. */
export function createGuestInbox(): Email[] {
  const batch = messages.map(
    ([sender, subject, body], index): Email => ({
      id: `synthetic-${index}`,
      threadId: `synthetic-thread-${index}`,
      from: `${sender} <sample-${index}@example.invalid>`,
      to: 'Guest <guest@example.invalid>',
      subject,
      date: `2026-07-${14 - index}T10:00:00Z`,
      snippet: body,
      previewContent: { mimeType: 'text/plain', text: body },
      body,
      labelIds: index < 2 ? ['INBOX', 'UNREAD'] : ['INBOX'],
      unsubscribeLink: null,
      unsubscribePost: false,
    })
  );
  return sliceSample(appendSamplePage(emptyInboxSample(), batch), batch.length);
}

export function searchGuestInbox(emails: Email[], query: string): Email[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return emails.filter((email) => {
    const text = `${email.from} ${email.subject} ${email.body}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
