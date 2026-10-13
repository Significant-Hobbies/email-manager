import { Link } from 'react-router-dom';

export function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm leading-7">
      <a href="/" className="text-xs text-[var(--text-muted)] hover:underline">
        ← Kinetic
      </a>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">About Kinetic</h1>
      <p className="mt-4">
        Kinetic is a Gmail inbox workspace with local-first semantic search. Find messages by
        meaning, browse threads, and explore sender insights while keeping mailbox contents and
        embeddings in your browser.
      </p>
      <h2 className="mt-8 text-base font-semibold">How it works</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>Explore the synthetic sample inbox without signing in or granting Gmail access.</li>
        <li>
          Choose Connect Gmail (read-only) to grant access through Google OAuth. Kinetic cannot
          send, reply, archive, or delete messages.
        </li>
        <li>
          Mailbox data is cached locally in account-isolated IndexedDB storage. The server stores
          authentication and session data, not mailbox contents.
        </li>
        <li>
          When you choose to index your mailbox, an on-device model generates embeddings for
          semantic search. The model runs in your browser.
        </li>
      </ol>
      <h2 className="mt-8 text-base font-semibold">Your control</h2>
      <p className="mt-2">
        Sender analytics, weekly reflection, and filter recipes help you inspect your inbox. Filter
        recipes are exported for you to review and import into Gmail; Kinetic does not install them
        automatically. Unsubscribe requires an explicit click.
      </p>
      <p className="mt-4">
        The sample uses only fictional messages and local text search. It does not access Gmail,
        store mailbox data, or download a semantic-search model.
      </p>
      <p className="mt-4">
        <Link to="/app" className="underline">
          Explore Kinetic
        </Link>{' '}
        ·{' '}
        <Link to="/privacy" className="underline">
          Privacy
        </Link>
      </p>
      <footer className="mt-8 text-xs text-[var(--text-muted)]">
        Kinetic · Local-first semantic search
      </footer>
    </main>
  );
}
