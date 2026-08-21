'use client';

import { ArrowLeft, Copy, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { trackCoreAction } from '@/lib/analytics';
import { wrapEmailHtml } from '@/lib/email-html';
import { formatEmailDate } from '@/lib/format-date';
import type { Email } from '@/lib/gmail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  email: Email;
  onBack: () => void;
  showBack?: boolean;
}

function EmailDetailToolbar({
  email,
  onBack,
  showBack,
}: {
  email: Email;
  onBack: () => void;
  showBack: boolean;
}) {
  const [acting, setActing] = useState(false);

  async function handleCopySubject() {
    try {
      await navigator.clipboard.writeText(`${email.subject}\n${email.from}\n\n${email.snippet}`);
    } catch {
      // best-effort
    }
  }

  async function handleOneClickUnsubscribe() {
    setActing(true);
    try {
      const res = await fetch(`/api/emails/${email.id}/unsubscribe`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        trackCoreAction('unsubscribed');
      } else if (data.fallbackUrl) {
        window.open(data.fallbackUrl, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="glass-panel flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
      {showBack ? (
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="md:hidden">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Button>
      ) : null}
      <div className="flex-1" />
      <Button type="button" variant="secondary" size="sm" onClick={handleCopySubject}>
        <Copy className="h-3.5 w-3.5" aria-hidden />
        Copy brief
      </Button>
      {email.unsubscribeLink ? (
        email.unsubscribePost ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={acting}
            onClick={handleOneClickUnsubscribe}
          >
            Unsubscribe
          </Button>
        ) : (
          <Button type="button" variant="destructive" size="sm" asChild>
            <a href={email.unsubscribeLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Unsubscribe
            </a>
          </Button>
        )
      ) : null}
    </div>
  );
}

export function EmailDetail({ email, onBack, showBack = true }: Props) {
  const sentAt = useMemo(() => formatEmailDate(email.date), [email.date]);
  const emailDocument = useMemo(
    () => wrapEmailHtml(email.body, email.snippet),
    [email.body, email.snippet]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isTyping =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement;
      if (isTyping) return;
      if (e.key === 'Escape' && showBack) onBack();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, showBack]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-subtle)]/30">
      <EmailDetailToolbar email={email} onBack={onBack} showBack={showBack} />

      <div className="shrink-0 space-y-4 border-b border-[var(--border)]/80 px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          {email.labelIds.includes('UNREAD') ? <Badge>Unread</Badge> : null}
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold leading-snug tracking-tight text-balance">
            {email.subject}
          </h1>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-[var(--text)]">
              {email.from.replace(/<[^>]+>/, '').trim()}
            </span>
            <time
              dateTime={email.date}
              title={sentAt.title}
              className="shrink-0 text-[var(--text-muted)] tabular-nums"
            >
              {sentAt.label}
            </time>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-[var(--bg-elevated)]/40 p-4">
        <div className="email-reading-pane h-full overflow-hidden rounded-2xl border border-[var(--border)] shadow-[var(--shadow-soft)]">
          <iframe
            srcDoc={emailDocument}
            className={cn('h-full w-full border-0 bg-white')}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            title="Email body"
          />
        </div>
      </div>
    </div>
  );
}
