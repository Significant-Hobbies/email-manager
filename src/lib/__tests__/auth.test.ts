import { describe, expect, it } from 'vitest';

import { isGoogleOAuthConfigured, type AuthEnv } from '../auth';

describe('isGoogleOAuthConfigured', () => {
  function env(overrides: Partial<AuthEnv> = {}): AuthEnv {
    return { DB: {}, ...overrides };
  }

  it('returns true when both client id and secret are set', () => {
    expect(
      isGoogleOAuthConfigured(
        env({ GOOGLE_CLIENT_ID: 'abc.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'secret' })
      )
    ).toBe(true);
  });

  it('returns false when client id is missing', () => {
    expect(isGoogleOAuthConfigured(env({ GOOGLE_CLIENT_SECRET: 'secret' }))).toBe(false);
  });

  it('returns false when client secret is missing', () => {
    expect(isGoogleOAuthConfigured(env({ GOOGLE_CLIENT_ID: 'abc' }))).toBe(false);
  });

  it('returns false when both are missing', () => {
    expect(isGoogleOAuthConfigured(env())).toBe(false);
  });

  it('treats empty-string values as missing', () => {
    expect(isGoogleOAuthConfigured(env({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' }))).toBe(
      false
    );
  });

  it('treats whitespace-only values as present (non-empty string)', () => {
    // getEnvValue only checks length > 0, not trimmed content.
    expect(isGoogleOAuthConfigured(env({ GOOGLE_CLIENT_ID: ' ', GOOGLE_CLIENT_SECRET: ' ' }))).toBe(
      true
    );
  });
});
