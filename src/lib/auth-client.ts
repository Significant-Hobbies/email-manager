'use client';

import { createAuthClient } from 'better-auth/client';
import { oneTapClient } from 'better-auth/client/plugins';

export type Session = {
  user?: { id: string; email: string; name?: string; image?: string };
  session?: { id: string; expiresAt?: string };
  expiresAt?: string;
} | null;

export async function getSession(): Promise<Session> {
  try {
    const res = await fetch('/api/auth/get-session', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.user ? data : null;
  } catch {
    return null;
  }
}

export type SignInResult = { ok: true } | { ok: false; message: string };

export async function startGoogleOneTap(callbackPath = '/app'): Promise<void> {
  const response = await fetch('/api/auth/client-config', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) return;

  const { googleClientId } = (await response.json()) as { googleClientId: string | null };
  if (!googleClientId) return;

  const client = createAuthClient({
    baseURL: window.location.origin,
    plugins: [
      oneTapClient({
        clientId: googleClientId,
        autoSelect: false,
        cancelOnTapOutside: true,
        promptOptions: { baseDelay: 500, maxAttempts: 1 },
      }),
    ],
  });

  await client.oneTap({
    fetchOptions: {
      onSuccess: () => window.location.replace(callbackPath),
    },
  });
}

export async function signIn(): Promise<SignInResult> {
  const res = await fetch('/api/auth/sign-in/social', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      provider: 'google',
      // After OAuth completes, land users on /app (the cockpit). The
      // marketing landing at / is the Astro static page; signed-in
      // users skip it via the Worker's auth-cookie passthrough +
      // server redirect.
      callbackURL: '/app',
    }),
  });

  const data = (await res.json().catch(() => null)) as {
    url?: string;
    message?: string;
    code?: string;
  } | null;

  if (!res.ok) {
    const message =
      data?.message ??
      (res.status === 503
        ? 'Google sign-in is not configured for this environment.'
        : 'Google sign-in failed. Try again or check server logs.');
    return { ok: false, message };
  }

  window.location.href = data?.url ?? '/app';
  return { ok: true };
}

export async function signOut() {
  await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' });
  window.location.href = '/';
}
