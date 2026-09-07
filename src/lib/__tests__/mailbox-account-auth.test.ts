import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), getAccessToken: vi.fn() }));
vi.mock('../auth', () => ({ createAuth: () => ({ api: mocks }) }));
import { getGmailAccessToken } from '../get-access-token';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: 'account-b' } });
  mocks.getAccessToken.mockResolvedValue({ accessToken: 'synthetic-token' });
});
it('rejects stale account requests before asking for a provider token', async () => {
  const headers = new Headers({ 'X-Mailbox-Account-Id': 'account-a' });
  expect(await getGmailAccessToken({ DB: {} }, headers)).toBeNull();
  expect(mocks.getAccessToken).not.toHaveBeenCalled();
});
it('requests only the current matching account token', async () => {
  const headers = new Headers({ 'X-Mailbox-Account-Id': 'account-b' });
  expect(await getGmailAccessToken({ DB: {} }, headers)).toBe('synthetic-token');
  expect(mocks.getAccessToken).toHaveBeenCalledWith({
    body: { providerId: 'google', userId: 'account-b' },
    headers,
  });
});
