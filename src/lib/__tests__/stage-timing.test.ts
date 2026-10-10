import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppHealthBindings } from '../app-health';
import { createPing } from '../ping';
import { takeColdStart, withStageTiming } from '../stage-timing';

vi.mock('../ping', () => ({ createPing: vi.fn() }));

const debug = vi.fn().mockResolvedValue(true);

async function request(
  env: AppHealthBindings = {
    APP_HEALTH_INGEST_KEY: ' test-key ',
    APP_HEALTH_STAGE_SAMPLE_RATE: '1',
  },
  status = 200,
  colo: unknown = 'LHR',
  fail = false
) {
  const tasks: Promise<unknown>[] = [];
  const app = new Hono<{ Bindings: AppHealthBindings; Variables: { stageCold: number } }>();
  app.get('/api/emails/:id', (c) => {
    c.set('stageCold', takeColdStart());
    return withStageTiming(c, '/api/emails/:id', async (timing) => {
      await timing.measure('auth_ms', async () => {
        if (fail) throw new Error('auth failed');
      });
      if (status !== 401) {
        await timing.measure('gmail_ms', async () => {});
        // Even an unexpected runtime stage must not enter the event props.
        await timing.measure('user_content' as 'auth_ms', async () => {});
      }
      return new Response(null, { status });
    });
  });
  app.onError(() => new Response(null, { status: 500 }));
  const raw = new Request('https://example.test/api/emails/private-id?q=private-query');
  Object.defineProperty(raw, 'cf', { value: { colo } });
  const response = await app.fetch(raw, env, {
    waitUntil: (task) => tasks.push(task),
    passThroughOnException() {},
  });
  await Promise.all(tasks);
  return response;
}

describe('stage timing', () => {
  beforeEach(() => {
    vi.mocked(createPing).mockReturnValue({ debug } as ReturnType<typeof createPing>);
    vi.spyOn(Math, 'random').mockReturnValue(0.05);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('emits only contract props with a template route and trimmed config', async () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1.6)
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(700_002)
      .mockReturnValueOnce(700_003)
      .mockReturnValueOnce(700_004)
      .mockReturnValueOnce(700_005);
    const response = await request({
      APP_HEALTH_INGEST_KEY: ' test-key ',
      APP_HEALTH_STAGE_SAMPLE_RATE: '1',
      APP_HEALTH_ENVIRONMENT: ' staging ',
    });
    expect(response.status).toBe(200);
    expect(createPing).toHaveBeenCalledWith({ key: 'test-key', environment: 'staging' });
    expect(debug).toHaveBeenCalledWith('api.stage_timing', {
      props: {
        route: '/api/emails/:id',
        status: 200,
        total_ms: 600_000,
        edge_cache: 'NONE',
        inner_cache: 'NONE',
        colo: 'LHR',
        cold: 1,
        auth_ms: 2,
        gmail_ms: 600_000,
      },
    });
  });

  it('rate zero sends nothing', async () => {
    await request({ APP_HEALTH_INGEST_KEY: 'key', APP_HEALTH_STAGE_SAMPLE_RATE: '0' });
    expect(createPing).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '   '])('missing or blank key sends nothing (%s)', async (key) => {
    await request({ APP_HEALTH_INGEST_KEY: key, APP_HEALTH_STAGE_SAMPLE_RATE: '1' });
    expect(createPing).not.toHaveBeenCalled();
  });

  it('emits 401 with auth only, unknown colo, and a warm marker', async () => {
    await request(undefined, 401, 'invalid-colo');
    const props = debug.mock.calls[0][1].props;
    expect(props).toEqual({
      route: '/api/emails/:id',
      status: 401,
      total_ms: expect.any(Number),
      edge_cache: 'NONE',
      inner_cache: 'NONE',
      colo: 'unknown',
      cold: 0,
      auth_ms: expect.any(Number),
    });
    expect(createPing).toHaveBeenCalledWith({ key: 'test-key', environment: 'production' });
  });

  it('captures a thrown auth error without changing its response', async () => {
    expect((await request(undefined, 200, 'LHR', true)).status).toBe(500);
    expect(debug.mock.calls[0][1].props.status).toBe(500);
    expect(debug.mock.calls[0][1].props).toHaveProperty('auth_ms');
    expect(debug.mock.calls[0][1].props).not.toHaveProperty('gmail_ms');
  });

  it.each(['not-a-number', '2', '-1'])('normalizes sampling rate %s', async (rate) => {
    await request({ APP_HEALTH_INGEST_KEY: 'key', APP_HEALTH_STAGE_SAMPLE_RATE: rate });
    expect(debug).toHaveBeenCalledTimes(rate === '-1' ? 0 : 1);
  });

  it('uses a strict sampling boundary', async () => {
    vi.mocked(Math.random).mockReturnValue(0.1);
    await request({ APP_HEALTH_INGEST_KEY: 'key' });
    expect(debug).not.toHaveBeenCalled();
  });

  it('swallows telemetry setup and delivery failures', async () => {
    vi.mocked(createPing).mockImplementationOnce(() => {
      throw new Error('setup');
    });
    expect((await request()).status).toBe(200);
    debug.mockRejectedValueOnce(new Error('delivery'));
    expect((await request()).status).toBe(200);
  });
});
