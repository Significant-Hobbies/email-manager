import { useState } from 'react';
import { WorkSurface } from '@/components/WorkSurface';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createGuestInbox, searchGuestInbox } from '@/lib/guest-inbox';
import type { Email } from '@/lib/gmail';

export function SampleInbox() {
  const [emails] = useState(createGuestInbox);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Email | null>(null);
  const matches = searchGuestInbox(emails, query);

  return (
    <section
      aria-label="Synthetic sample inbox"
      className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/75"
    >
      <div className="space-y-2 border-b border-[var(--border)] px-4 py-3">
        <h2 className="font-semibold">Sample inbox · No OAuth</h2>
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">
          Entirely fictional messages. Local text search only; no Gmail access, saved mailbox data,
          or model download. Semantic search is available after you connect and index your mailbox.
        </p>
      </div>
      <div className="flex h-[480px] min-w-0">
        <WorkSurface
          hasSelection={Boolean(selected)}
          list={
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-2 border-b border-[var(--border)] p-4">
                <label htmlFor="sample-search" className="text-xs text-[var(--text-muted)]">
                  Search sample messages
                </label>
                <Input
                  id="sample-search"
                  placeholder="Try flight, garden, or receipt"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelected(null);
                  }}
                />
                <p role="status" className="text-xs text-[var(--text-muted)]">
                  {matches.length} sample messages
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {matches.map((email) => (
                  <button
                    key={email.id}
                    type="button"
                    onClick={() => setSelected(email)}
                    className="w-full cursor-pointer space-y-1 border-b border-[var(--border)] px-4 py-4 text-left hover:bg-[var(--bg-elevated)]"
                  >
                    <span className="block truncate text-xs text-[var(--text-muted)]">
                      {email.from.split(' <')[0]}
                    </span>
                    <span className="block truncate text-sm font-medium">{email.subject}</span>
                    <span className="block truncate text-xs text-[var(--text-muted)]">
                      {email.snippet}
                    </span>
                  </button>
                ))}
                {matches.length === 0 ? (
                  <div className="space-y-3 px-4 py-8 text-center">
                    <p className="text-sm text-[var(--text-muted)]">
                      No sample messages match your search.
                    </p>
                    <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                      Clear search
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          }
          detail={
            selected ? (
              <article
                aria-label="Sample message"
                className="min-w-0 space-y-4 overflow-y-auto p-4"
              >
                <Button variant="secondary" size="sm" onClick={() => setSelected(null)}>
                  Back to sample inbox
                </Button>
                <h3 className="text-lg font-semibold">{selected.subject}</h3>
                <p className="break-words text-xs text-[var(--text-muted)]">{selected.from}</p>
                <p className="text-sm leading-relaxed">{selected.body}</p>
                <p className="text-xs text-[var(--text-muted)]">Synthetic sample message</p>
              </article>
            ) : null
          }
        />
      </div>
    </section>
  );
}
