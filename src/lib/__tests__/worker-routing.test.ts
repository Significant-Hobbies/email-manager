import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ handler: vi.fn(), getSession: vi.fn() }));
vi.mock('../auth', () => ({
  createAuth: () => ({ handler: mocks.handler, api: { getSession: mocks.getSession } }),
  isGoogleOAuthConfigured: () => true,
}));
import worker, { type Env } from '../../worker';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.handler.mockImplementation(async () => Response.json({ reachedAuth: true }));
  mocks.getSession.mockResolvedValue(null);
});
async function request(path: string, method = 'GET') {
  return worker.fetch(
    new Request(`https://mail.example${path}`, { method }),
    {
      ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
      DB: {},
    } as unknown as Env,
    { waitUntil: vi.fn() } as unknown as ExecutionContext
  );
}

it('routes session reads and OAuth callbacks to auth rather than public discovery', async () => {
  for (const path of ['/api/auth/get-session', '/api/auth/callback/google']) {
    const response = await request(path);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reachedAuth: true });
  }
  expect(mocks.handler).toHaveBeenCalledTimes(2);
});
it('retains POST auth and authenticated mailbox boundaries', async () => {
  expect((await request('/api/auth/sign-in/social', 'POST')).status).toBe(200);
  expect((await request('/api/emails')).status).toBe(401);
  expect(mocks.getSession).toHaveBeenCalled();
});
it('serves declared discovery routes through the exported Worker entry point', async () => {
  const spec = await request('/openapi.json');
  expect(spec.status).toBe(200);
  expect(await spec.json()).toMatchObject({ openapi: '3.1.0' });
  expect((await request('/api/ai')).status).toBe(200);
  expect((await request('/api/health')).status).toBe(200);
  expect((await request('/api/not-a-product-route')).status).toBe(404);
});
