'use client';

import { useMailboxStore } from '@/components/MailboxStoreProvider';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { formatEmailDate } from '@/lib/format-date';
import { wrapEmailHtml } from '@/lib/email-html';
import type { Email } from '@/lib/gmail';
import { cn } from '@/lib/utils';

const bodyCache = new Map<string, Email>();
const HOVER_DELAY_MS = 280;

interface Props {
  email: Email;
  children: ReactNode;
  className?: string;
}

export function EmailHoverPreview({ email, children, className }: Props) {
  const { accountId } = useMailboxStore();
  const cacheKey = JSON.stringify([accountId, email.id]);
  const anchorRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const openTimerRef = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Email | null>(bodyCache.get(cacheKey) ?? null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;

    const panelWidth = 380;
    const panelHeight = 280;
    const margin = 12;
    let left = rect.right + margin;
    let top = rect.top;

    if (left + panelWidth > window.innerWidth - margin) {
      left = Math.max(margin, rect.left - panelWidth - margin);
    }
    if (top + panelHeight > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - panelHeight - margin);
    }

    setPosition({ top, left });
  }, []);

  const loadDetail = useCallback(async () => {
    const cached = bodyCache.get(cacheKey);
    if (cached?.body) {
      setDetail(cached);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/emails/${email.id}`, {
        headers: { 'X-Mailbox-Account-Id': accountId },
      });
      if (!res.ok) return;
      const data = (await res.json()) as Email;
      bodyCache.set(cacheKey, data);
      setDetail(data);
    } catch {
      // Preview is best-effort — never block the list.
    } finally {
      setLoading(false);
    }
  }, [email.id, accountId, cacheKey]);

  const handleEnter = useCallback(() => {
    window.clearTimeout(closeTimerRef.current);
    openTimerRef.current = window.setTimeout(() => {
      updatePosition();
      setOpen(true);
      void loadDetail();
    }, HOVER_DELAY_MS);
  }, [loadDetail, updatePosition]);

  const handleLeave = useCallback(() => {
    window.clearTimeout(openTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 120);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    return () => {
      window.clearTimeout(openTimerRef.current);
      window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const preview = detail ?? email;
  const sentAt = formatEmailDate(preview.date);
  const previewDoc = wrapEmailHtml(preview.body || undefined, preview.snippet);

  return (
    <>
      <div
        ref={anchorRef}
        className={cn('relative', className)}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={handleLeave}
      >
        {children}
      </div>

      {open &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[80] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-glow)]"
            style={{ top: position.top, left: position.left }}
            onMouseEnter={() => window.clearTimeout(closeTimerRef.current)}
            onMouseLeave={handleLeave}
          >
            <div className="border-b border-[var(--border)]/70 px-3.5 py-2.5">
              <p className="text-sm font-medium leading-snug text-[var(--text)] text-pretty">
                {preview.subject}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]" title={sentAt.title}>
                {sentAt.label}
                {loading ? ' · Loading…' : null}
              </p>
            </div>
            <div className="email-reading-pane max-h-56 overflow-hidden bg-white">
              <iframe
                srcDoc={previewDoc}
                title={`Preview: ${preview.subject}`}
                className="h-56 w-full border-0 bg-white"
                sandbox="allow-popups allow-popups-to-escape-sandbox"
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
