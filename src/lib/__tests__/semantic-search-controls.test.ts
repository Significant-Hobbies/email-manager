import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SemanticSearch } from '../../components/SemanticSearch';

const mailbox = vi.hoisted(() => ({
  accountId: 'synthetic-account',
  total: 2,
  indexed: 0,
  pendingIndex: 2,
  syncing: false,
  indexing: false,
  progress: '',
  syncInbox: vi.fn(),
  indexForSearch: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('../../components/MailboxStoreProvider', () => ({
  useMailboxStore: () => mailbox,
}));

beforeEach(() => {
  mailbox.total = 2;
  mailbox.indexed = 0;
  mailbox.pendingIndex = 2;
  mailbox.syncing = false;
  mailbox.indexing = false;
});

function buttons() {
  const html = renderToStaticMarkup(createElement(SemanticSearch, { onSelect: vi.fn() }));
  return html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
}

describe('semantic search indexing affordances', () => {
  it.each(['syncing', 'indexing'] as const)(
    'disables both cached-mail indexing actions during %s',
    (busy) => {
      mailbox[busy] = true;
      const actions = buttons();
      expect(actions).toHaveLength(2);
      expect(actions.every((button) => button.includes('disabled=""'))).toBe(true);
      expect(actions[1]).toContain('Index for search');
    }
  );

  it.each(['syncing', 'indexing'] as const)(
    'disables both Sync & Index actions during %s',
    (busy) => {
      mailbox.total = 0;
      mailbox.pendingIndex = 0;
      mailbox[busy] = true;
      const actions = buttons();
      expect(actions).toHaveLength(2);
      expect(actions.every((button) => button.includes('disabled=""'))).toBe(true);
      expect(actions[1]).toContain('Sync &amp; Index');
    }
  );

  it('enables both indexing actions again when the shared busy state clears', () => {
    mailbox.indexing = true;
    expect(buttons().every((button) => button.includes('disabled=""'))).toBe(true);
    mailbox.indexing = false;
    const actions = buttons();
    expect(actions).toHaveLength(2);
    expect(actions.every((button) => !button.includes('disabled=""'))).toBe(true);
  });

  it('disables Re-index while the primary indexer is busy', () => {
    mailbox.indexed = 1;
    mailbox.indexing = true;
    expect(buttons()[0]).toContain('disabled=""');
  });
});
