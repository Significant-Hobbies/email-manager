import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getEmail: vi.fn(),
  authHandler: vi.fn(),
}));

vi.mock('../get-access-token', () => ({ getGmailAccessToken: mocks.getAccessToken }));
vi.mock('../gmail', () => ({ getEmail: mocks.getEmail }));
vi.mock('../auth', () => ({
  createAuth: () => ({ handler: mocks.authHandler, api: { getSession: vi.fn() } }),
  isGoogleOAuthConfigured: () => true,
}));

import worker, { type Env } from '../../worker';
import { resolveAppHealthClient } from '../app-health';

const originalFetch = globalThis.fetch;

function createContext(env: Record<string, unknown> = {}) {
  const pending: Promise<unknown>[] = [];
  const executionCtx = { waitUntil: vi.fn((promise: Promise<unknown>) => pending.push(promise)) };
  const bindings = {
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    DB: {},
    ...env,
  } as unknown as Env;
  return { bindings, executionCtx, pending };
}

async function request(path: string, init: RequestInit = {}, env: Record<string, unknown> = {}) {
  const ctx = createContext(env);
  const response = await worker.fetch(
    new Request(`https://mail.example${path}`, init),
    ctx.bindings,
    ctx.executionCtx as unknown as ExecutionContext
  );
  await Promise.all(ctx.pending);
  return { response, pending: ctx.pending };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAccessToken.mockResolvedValue('test-google-access-token');
  mocks.getEmail.mockResolvedValue({
    id: 'private-email-id-marker',
    from: 'private-sender@example.test',
    subject: 'private-subject-marker',
    body: 'private-body-marker',
  });
  mocks.authHandler.mockResolvedValue(Response.json({ ok: true }));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('optional App Health endpoint telemetry', () => {
  it('keeps monitoring disabled without a key while the API responds normally', async () => {
    const transport = vi.fn(async () => new Response(null, { status: 202 }));
    globalThis.fetch = transport;

    const { response, pending } = await request('/api/health');

    expect(response.status).toBe(200);
    expect(pending).toHaveLength(0);
    expect(transport).not.toHaveBeenCalled();

    const blankKeyClient = resolveAppHealthClient({ APP_HEALTH_INGEST_KEY: '   ' });
    expect(blankKeyClient).toBeNull();
  });

  it('filters the optional response-size scalar before it reaches the SDK transport', async () => {
    let payload = '';
    globalThis.fetch = vi.fn(async (_input, init) => {
      payload = String(init?.body);
      return new Response(null, { status: 202 });
    });

    const client = resolveAppHealthClient({ APP_HEALTH_INGEST_KEY: 'test-only-key' });
    expect(client).not.toBeNull();
    client?.record({
      method: 'GET',
      route: '/api/emails/:id',
      status_code: 200,
      duration_ms: 12,
      response_bytes: 8192,
    });
    await client?.flush();

    const batch = JSON.parse(payload) as { events: Array<Record<string, unknown>> };
    expect(batch.events[0]).toMatchObject({
      method: 'GET',
      route: '/api/emails/:id',
      status_code: 200,
      duration_ms: 12,
    });
    expect(batch.events[0]).not.toHaveProperty('response_bytes');
  });

  it('reports only a normalized mailbox route and approved summary fields', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (input, init) => {
      calls.push({ input, init });
      return new Response(null, { status: 202 });
    });

    const markers = [
      'private-email-id-marker',
      'private-sender@example.test',
      'private-subject-marker',
      'private-body-marker',
      'private-query-marker',
      'private-cookie-marker',
    ];
    const { response, pending } = await request(
      `/api/emails/${markers[0]}?q=${markers[4]}`,
      { headers: { cookie: markers[5], authorization: 'Bearer private-auth-header-marker' } },
      { APP_HEALTH_INGEST_KEY: 'test-only-key', APP_HEALTH_ENVIRONMENT: 'test' }
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain(markers[3]);
    expect(pending).toHaveLength(1);
    expect(calls).toHaveLength(1);
    const batch = JSON.parse(String(calls[0]?.init?.body)) as {
      events: Array<Record<string, unknown>>;
    };
    expect(batch.events).toHaveLength(1);
    expect(batch.events[0]).toMatchObject({
      method: 'GET',
      route: '/api/emails/:id',
      status_code: 200,
    });
    expect(Object.keys(batch.events[0] ?? {}).sort()).toEqual([
      'duration_ms',
      'event_id',
      'method',
      'route',
      'status_code',
      'timestamp',
    ]);
    expect(JSON.stringify(batch)).not.toContain('response_bytes');
    for (const marker of [...markers, 'private-auth-header-marker']) {
      expect(JSON.stringify(batch)).not.toContain(marker);
    }
  });

  it('uses the fixed auth wildcard and excludes submitted auth values', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (input, init) => {
      calls.push({ input, init });
      return new Response(null, { status: 202 });
    });

    const body = JSON.stringify({
      email: 'private-account@example.test',
      password: 'private-password-marker',
    });
    const { response } = await request(
      '/api/auth/sign-in/social?provider=google&state=private-state-marker',
      { method: 'POST', body, headers: { cookie: 'private-cookie-marker' } },
      { APP_HEALTH_INGEST_KEY: 'test-only-key' }
    );

    expect(response.status).toBe(200);
    const batch = JSON.parse(String(calls[0]?.init?.body)) as {
      events: Array<Record<string, unknown>>;
    };
    expect(batch.events[0]).toMatchObject({
      method: 'POST',
      route: '/api/auth/*',
      status_code: 200,
    });
    for (const marker of [
      'private-account@example.test',
      'private-password-marker',
      'private-state-marker',
      'private-cookie-marker',
    ]) {
      expect(JSON.stringify(batch)).not.toContain(marker);
    }
  });
});
