/**
 * Owner-facing analytics — the fixed 4-event taxonomy.
 *
 * Every project in the fleet emits exactly these four events — `signup`,
 * `activated`, `core_action`, `returned` — so a single PostHog project can
 * build one cross-fleet funnel (signup -> activated -> core_action) and a
 * D1/D7 retention insight, with no custom dashboard.
 *
 * Every event carries `project_id: "email-manager"`. This wrapper is intentionally
 * thin so it can later be folded into `posthog-js`.
 *
 * email-manager is an entirely client-side SPA (no server inbox DB), so this
 * module only needs the browser path. It routes through
 * `posthog-js` (`track`), which is initialized by
 * `installBrowserMonitoring()` in `foundry-monitoring.ts`.
 */
'use client';

import posthog from 'posthog-js';

import { isPostHogEnabled } from '@/lib/foundry-monitoring';

const PROJECT = 'email-manager' as const;

/**
 * The product-specific action behind a `core_action` event.
 * email-manager's core verbs: reading a message, installing a Gmail filter,
 * and unsubscribing from a sender.
 */
export type CoreAction =
  | 'email_opened'
  | 'filter_installed'
  | 'unsubscribed'
  | 'digest_generated'
  | 'digest_exported';

interface AnalyticsEventMap {
  /** First session after an account is created. */
  signup: { project_id: typeof PROJECT };
  /** The user reaches first real value — opens their first message. */
  activated: { project_id: typeof PROJECT };
  /** The thing the product exists to do. */
  core_action: { project_id: typeof PROJECT; action: CoreAction };
  /** A return session by a user with prior activity. */
  returned: { project_id: typeof PROJECT };
}

function trackEvent(event: string, properties: Record<string, unknown> = {}): void {
  if (!isPostHogEnabled()) return;
  try {
    posthog.capture(event, { project_id: PROJECT, ...properties });
  } catch {
    // Analytics must never break a user flow. Swallow and move on.
  }
}

function emit<K extends keyof AnalyticsEventMap>(
  event: K,
  props: Omit<AnalyticsEventMap[K], 'project_id'>
): void {
  trackEvent(event, props);
}

/** Fire once, on the first session after an account is created. */
export function trackSignup(): void {
  emit('signup', {});
}

/** Fire once, when the user first reaches real value (first email opened). */
export function trackActivated(): void {
  emit('activated', {});
}

/** Fire on each completion of the core product action. */
export function trackCoreAction(action: CoreAction): void {
  emit('core_action', { action });
}

/** Fire on session start for a user who has prior activity. */
export function trackReturned(): void {
  emit('returned', {});
}
