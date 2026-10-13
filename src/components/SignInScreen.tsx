'use client';

import { motion } from 'framer-motion';
import { LogIn } from 'lucide-react';
import { useState } from 'react';

import { signIn } from '@/lib/auth-client';
import { SampleInbox } from '@/components/SampleInbox';
import { AuroraBackground } from '@/components/ui/aurora-background';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function SignInCard() {
  const [signInError, setSignInError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <motion.div
      data-testid="gmail-connect-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="border-[var(--border)]/80 bg-[var(--bg-card)]/75 shadow-[var(--shadow-glow)]">
        <CardHeader className="items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-xl font-bold text-[var(--accent-fg)] shadow-[var(--shadow-soft)]">
            K
          </span>
          <CardTitle className="text-2xl">Connect Gmail</CardTitle>
          <CardDescription className="max-w-sm text-balance">
            Connect your account when you are ready. Gmail access is read-only.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {signInError ? (
            <p
              role="alert"
              className="rounded-xl border border-[var(--danger)]/25 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]"
            >
              {signInError}
            </p>
          ) : null}

          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={loading}
            onClick={async () => {
              setSignInError(null);
              setLoading(true);
              try {
                const result = await signIn();
                if (!result.ok) setSignInError(result.message);
              } catch {
                setSignInError('Could not connect. Check your connection and try again.');
              } finally {
                setLoading(false);
              }
            }}
          >
            <LogIn className="h-4 w-4" aria-hidden />
            {loading ? 'Connecting…' : 'Connect Gmail (read-only)'}
          </Button>

          <p className="text-center text-xs leading-relaxed text-[var(--text-muted)]">
            OAuth tokens are stored for session refresh only. Email bodies are cached locally in
            your browser.
          </p>

          <a
            href="/"
            className="block text-center text-xs text-[var(--text-muted)] underline-offset-4 transition hover:text-[var(--text)] hover:underline"
          >
            ← Back to landing
          </a>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function SignInScreen() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <AuroraBackground />
      <div className="relative z-10 mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="text-xl font-semibold">
            Kinetic
          </a>
          <a href="/about" className="text-sm text-[var(--text-muted)] hover:underline">
            About Kinetic
          </a>
        </header>
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px]">
          <section className="min-w-0 space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight">Explore a sample inbox</h1>
            <p className="text-sm leading-relaxed text-[var(--text-muted)]">
              Kinetic is a local-first Gmail workspace with on-device semantic search. Try browsing
              and text search below before connecting your account.
            </p>
            <SampleInbox />
          </section>
          <SignInCard />
        </div>
        <footer className="text-xs text-[var(--text-muted)]">
          Kinetic · Local-first semantic search ·{' '}
          <a href="/privacy" className="underline">
            Privacy
          </a>
        </footer>
      </div>
    </main>
  );
}
