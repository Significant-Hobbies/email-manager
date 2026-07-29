'use client';

import { motion } from 'framer-motion';
import { Database, LogIn, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import { signIn, startGoogleOneTap } from '@/lib/auth-client';
import { AuroraBackground } from '@/components/ui/aurora-background';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  {
    icon: ShieldCheck,
    title: 'Read-only by design',
    body: 'Gmail scope never allows send, delete, or archive from Kinetic.',
  },
  {
    icon: Database,
    title: 'Local-first storage',
    body: 'Messages and embeddings live in IndexedDB — not on our servers.',
  },
  {
    icon: Sparkles,
    title: 'Semantic search',
    body: 'Find threads by meaning with on-device HuggingFace ONNX embeddings.',
  },
];

export function SignInScreen() {
  const [signInError, setSignInError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void startGoogleOneTap('/app').catch(() => {
      // OAuth remains available when FedCM/GIS is blocked, dismissed, or the
      // user has not previously granted Gmail access.
    });
  }, []);

  return (
    <main className="relative flex min-h-screen overflow-hidden">
      <AuroraBackground />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:px-10">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-8"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)]/70 px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] backdrop-blur-sm">
            <Mail className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden />
            Gmail cockpit · local-first
          </div>

          <div className="space-y-4">
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Search and understand Gmail,
              <span className="text-[var(--accent)]"> not cloud uploads.</span>
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-[var(--text-muted)] text-pretty">
              Kinetic is a keyboard-driven inbox workspace with semantic search, sender analytics,
              and filter recipes — built so mailbox content is never stored on our servers.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * index, duration: 0.4 }}
                className="rounded-2xl border border-[var(--border)]/70 bg-[var(--bg-card)]/55 p-4 backdrop-blur-sm"
              >
                <feature.icon className="mb-3 h-4 w-4 text-[var(--accent)]" aria-hidden />
                <p className="text-sm font-medium">{feature.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                  {feature.body}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card className="border-[var(--border)]/80 bg-[var(--bg-card)]/75 shadow-[var(--shadow-glow)]">
            <CardHeader className="items-center text-center">
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-xl font-bold text-[var(--accent-fg)] shadow-[var(--shadow-soft)]">
                K
              </span>
              <CardTitle className="text-2xl">Welcome back</CardTitle>
              <CardDescription className="max-w-sm text-balance">
                Sign in with Google to connect your read-only Gmail workspace.
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
                  const result = await signIn();
                  if (!result.ok) setSignInError(result.message);
                  setLoading(false);
                }}
              >
                <LogIn className="h-4 w-4" aria-hidden />
                {loading ? 'Connecting…' : 'Continue with Google'}
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
      </div>
    </main>
  );
}
