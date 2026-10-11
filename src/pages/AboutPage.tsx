import { Link } from 'react-router-dom';

export function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm leading-7">
      <a href="/" className="text-xs text-[var(--text-muted)] hover:underline">
        ← Email Manager
      </a>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">About</h1>
      <p className="mt-4">
        Email Manager looks at your last few thousand messages, finds the senders and threads you
        actually act on, and suggests Gmail filter rules that would have prevented the noise from
        reaching your primary inbox in the first place.
      </p>

      <h2 className="mt-8 text-base font-semibold">How it works</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>
          Connect via Google OAuth — the app reads (but never sends) mail through the Gmail API.
        </li>
        <li>
          The classifier ranks senders, lists, and recurring subject patterns by how often you
          actually open / reply / star.
        </li>
        <li>
          For each pattern with a clear &ldquo;ignore&rdquo; or &ldquo;label-and-archive&rdquo;
          signal, you get a one-click filter you can install into Gmail directly.
        </li>
        <li>
          Anything you accept is mirrored as a real Gmail filter, so it applies even when this app
          is offline.
        </li>
      </ol>

      <h2 className="mt-8 text-base font-semibold">What it isn&apos;t</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>An email client. We don&apos;t render your inbox or replace Gmail&apos;s UI.</li>
        <li>
          An AI summarizer. The patterns surfaced come from your behavior, not LLM guesses about
          content.
        </li>
        <li>
          A subscription service that scrapes your data. See{' '}
          <Link to="/privacy" className="underline">
            /privacy
          </Link>
          .
        </li>
      </ul>
    </main>
  );
}
