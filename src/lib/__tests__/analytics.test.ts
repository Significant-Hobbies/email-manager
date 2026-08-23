import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureMock } = vi.hoisted(() => ({ captureMock: vi.fn() }));

vi.mock('posthog-js', () => ({
  default: { capture: captureMock },
}));

vi.mock('@/lib/foundry-monitoring', () => ({
  isPostHogEnabled: vi.fn(() => true),
}));

import { isPostHogEnabled } from '@/lib/foundry-monitoring';
import {
  trackActivated,
  trackCoreAction,
  trackPageView,
  trackReturned,
  trackSignup,
} from '../analytics';

describe('analytics', () => {
  beforeEach(() => {
    captureMock.mockClear();
    vi.mocked(isPostHogEnabled).mockReturnValue(true);
  });

  it('trackPageView emits page_view with project_id', () => {
    trackPageView();
    expect(captureMock).toHaveBeenCalledWith('page_view', { project_id: 'email-manager' });
  });

  it('trackSignup emits signup event', () => {
    trackSignup();
    expect(captureMock).toHaveBeenCalledWith('signup', { project_id: 'email-manager' });
  });

  it('trackActivated emits activated event', () => {
    trackActivated();
    expect(captureMock).toHaveBeenCalledWith('activated', { project_id: 'email-manager' });
  });

  it('trackReturned emits returned event', () => {
    trackReturned();
    expect(captureMock).toHaveBeenCalledWith('returned', { project_id: 'email-manager' });
  });

  it('trackCoreAction emits core_action with the action name', () => {
    trackCoreAction('email_opened');
    expect(captureMock).toHaveBeenCalledWith('core_action', {
      project_id: 'email-manager',
      action: 'email_opened',
    });
  });

  it('trackCoreAction supports all CoreAction values', () => {
    const actions = [
      'email_opened',
      'filter_installed',
      'unsubscribed',
      'digest_generated',
      'digest_exported',
    ] as const;
    for (const action of actions) {
      trackCoreAction(action);
    }
    expect(captureMock).toHaveBeenCalledTimes(actions.length);
    expect(captureMock.mock.calls[2][1]).toMatchObject({ action: 'unsubscribed' });
  });

  it('no-ops when PostHog is disabled', () => {
    vi.mocked(isPostHogEnabled).mockReturnValue(false);
    trackPageView();
    trackSignup();
    trackActivated();
    trackCoreAction('email_opened');
    trackReturned();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('swallows errors from posthog.capture without throwing', () => {
    captureMock.mockImplementation(() => {
      throw new Error('posthog exploded');
    });
    expect(() => trackPageView()).not.toThrow();
    expect(() => trackCoreAction('email_opened')).not.toThrow();
  });
});
