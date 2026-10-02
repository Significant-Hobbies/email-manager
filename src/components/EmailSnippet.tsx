import { useEffect, useRef, useState } from 'react';
import { useMailboxStore } from './MailboxStoreProvider';
import { emailPreviewText, needsPreviewHydration } from '@/lib/email-preview';
import { hydrateEmailPreview } from '@/lib/preview-cache';
import type { Email } from '@/lib/gmail';

/** Shared plain-text display for list, search, sent and hover previews. */
export function EmailSnippet({ email }: { email: Email }) {
  const { accountId } = useMailboxStore();
  const anchor = useRef<HTMLSpanElement>(null);
  const [hydrated, setHydrated] = useState<{ key: string; email: Email } | null>(null);
  const key = JSON.stringify([accountId, email.id]);
  useEffect(() => {
    if (!needsPreviewHydration(email) || !anchor.current) return;
    let disposed = false;
    let controller: AbortController | null = null;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        controller?.abort();
        controller = null;
        return;
      }
      if (controller) return;
      controller = new AbortController();
      const signal = controller.signal;
      void hydrateEmailPreview(email, accountId, signal)
        .then((detail) => {
          if (!disposed && !signal.aborted) {
            setHydrated({ key, email: detail });
            observer.disconnect();
          }
        })
        .catch(() => {});
    });
    observer.observe(anchor.current);
    return () => {
      disposed = true;
      controller?.abort();
      observer.disconnect();
    };
  }, [email, accountId, key]);
  return (
    <span ref={anchor}>{emailPreviewText(hydrated?.key === key ? hydrated.email : email)}</span>
  );
}
