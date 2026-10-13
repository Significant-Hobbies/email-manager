import { describe, expect, it } from 'vitest';
import { createGuestInbox, searchGuestInbox } from '../guest-inbox';

describe('synthetic guest inbox', () => {
  it('uses complete fictional messages without actionable external links', () => {
    const emails = createGuestInbox();
    expect(emails).toHaveLength(4);
    for (const email of emails) {
      expect(email.from).toContain('@example.invalid');
      expect(email.to).toContain('@example.invalid');
      expect(email.body).toBeTruthy();
      expect(email.previewContent?.text).toBe(email.body);
      expect(email.unsubscribeLink).toBeNull();
      expect(email.unsubscribePost).toBe(false);
    }
    emails[0].subject = 'Changed locally';
    expect(createGuestInbox()[0].subject).toBe('Your summer flight confirmation');
  });

  it('searches sender, subject and body with case-insensitive terms and empty states', () => {
    const emails = createGuestInbox();
    expect(searchGuestInbox(emails, ' FLIGHT summer ')).toHaveLength(1);
    expect(searchGuestInbox(emails, 'balcony')[0].subject).toBe('This week in the garden');
    expect(searchGuestInbox(emails, 'harbor')[0].subject).toBe('Receipt for your book order');
    expect(searchGuestInbox(emails, 'no-such-message')).toEqual([]);
    expect(searchGuestInbox(emails, ' ')).toHaveLength(4);
  });
});
