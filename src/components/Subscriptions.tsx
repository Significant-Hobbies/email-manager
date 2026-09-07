'use client';

import { useEffect, useState } from 'react';
import type { Email } from '@/lib/gmail';
import { useMailboxStore } from '@/components/MailboxStoreProvider';

export function Subscriptions() {
  const { accountId, total, subscriptionSenders, ready, syncing, refresh, syncInbox } =
    useMailboxStore();
  const [error, setError] = useState<string | null>(null);
  const [unsubbing, setUnsubbing] = useState<Set<string>>(new Set());
  const [unsubbed, setUnsubbed] = useState<Set<string>>(new Set());

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function loadSubscriptions() {
    setError(null);
    try {
      await refresh();
    } catch (err) {
      console.error('Subscriptions load error:', err);
      setError("Couldn't load subscriptions. Check your connection.");
    }
  }

  async function handleSync() {
    setError(null);
    try {
      await syncInbox();
    } catch (err) {
      console.error('Subscriptions sync error:', err);
      setError("Couldn't sync inbox. Check your connection.");
    }
  }

  async function handleUnsubscribe(email: Email) {
    if (!email.unsubscribePost) {
      window.open(email.unsubscribeLink!, '_blank', 'noopener,noreferrer');
      return;
    }

    setUnsubbing((prev) => new Set(prev).add(email.id));
    try {
      const res = await fetch(`/api/emails/${email.id}/unsubscribe`, {
        method: 'POST',
        headers: { 'X-Mailbox-Account-Id': accountId },
      });
      const data = await res.json();

      if (data.ok) {
        setUnsubbed((prev) => new Set(prev).add(email.id));
      } else if (data.fallbackUrl) {
        window.open(data.fallbackUrl, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(email.unsubscribeLink!, '_blank', 'noopener,noreferrer');
    } finally {
      setUnsubbing((prev) => {
        const next = new Set(prev);
        next.delete(email.id);
        return next;
      });
    }
  }

  if (!ready || syncing) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm px-6">
          <p className="text-sm text-[var(--text-muted)]">{error}</p>
          <button
            onClick={loadSubscriptions}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition cursor-pointer text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm px-6">
          <p className="text-sm text-[var(--text-muted)]">
            Sync your inbox from the sidebar — all tools share the same local index.
          </p>
          <button
            onClick={handleSync}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition cursor-pointer text-sm font-medium"
          >
            Sync inbox
          </button>
        </div>
      </div>
    );
  }

  if (subscriptionSenders.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
        <div className="text-center space-y-2 max-w-sm px-6">
          <p>No subscriptions found in your synced emails.</p>
          <p className="text-xs">
            {total} inbox message{total !== 1 ? 's' : ''} indexed locally — sync again for more.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 border-b border-[var(--border)]">
        <h2 className="text-lg font-semibold">Subscriptions</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {subscriptionSenders.length} sender{subscriptionSenders.length !== 1 ? 's' : ''} with
          unsubscribe links — from your local inbox index ({total} emails)
        </p>
      </div>
      {subscriptionSenders.map((email) => (
        <div
          key={email.id}
          className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]"
        >
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">
              {email.from.replace(/<[^>]+>/, '').trim()}
            </div>
            <div className="text-xs text-[var(--text-muted)] truncate">{email.subject}</div>
          </div>
          <div className="ml-3 shrink-0 flex items-center gap-2">
            {email.unsubscribePost && (
              <span className="text-xs text-[var(--text-muted)]">1-click</span>
            )}
            {unsubbed.has(email.id) ? (
              <span className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 text-sm">
                Unsubscribed
              </span>
            ) : (
              <button
                onClick={() => handleUnsubscribe(email)}
                disabled={unsubbing.has(email.id)}
                className="px-3 py-1.5 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] text-sm hover:bg-[var(--danger)]/20 transition cursor-pointer disabled:opacity-50"
              >
                {unsubbing.has(email.id) ? '...' : 'Unsubscribe'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
