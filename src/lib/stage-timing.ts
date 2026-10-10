import type { Context } from 'hono';
import type { AppHealthBindings } from './app-health';
import { createPing } from './ping';

type StageRoute = '/api/emails' | '/api/emails/:id' | '/api/emails/:id/unsubscribe';
type Stage = 'auth_ms' | 'gmail_ms';
type TimingContext = Pick<
  Context<{ Bindings: AppHealthBindings; Variables: { stageCold: number } }>,
  'env' | 'req' | 'get' | 'executionCtx'
>;

let cold = true;

export function takeColdStart(): number {
  const value = cold ? 1 : 0;
  cold = false;
  return value;
}

function milliseconds(value: number): number {
  return Number.isNaN(value) ? 0 : Math.min(600_000, Math.max(0, Math.round(value)));
}

export async function withStageTiming(
  c: TimingContext,
  route: StageRoute,
  handler: (timing: {
    measure: <T>(stage: Stage, work: () => Promise<T>) => Promise<T>;
  }) => Promise<Response>
): Promise<Response> {
  const start = performance.now();
  const stages: Partial<Record<Stage, number>> = {};
  let status = 500;
  try {
    const response = await handler({
      async measure(stage, work) {
        const stageStart = performance.now();
        try {
          return await work();
        } finally {
          stages[stage] = (stages[stage] ?? 0) + performance.now() - stageStart;
        }
      },
    });
    status = response.status;
    return response;
  } finally {
    // Telemetry setup, scheduling, and delivery must never affect the handler.
    try {
      const key = c.env.APP_HEALTH_INGEST_KEY?.trim();
      const configuredRate = Number(c.env.APP_HEALTH_STAGE_SAMPLE_RATE ?? 0.1);
      const rate = Number.isNaN(configuredRate) ? 0.1 : Math.max(0, Math.min(1, configuredRate));
      if (key && Math.random() < rate) {
        const colo = (c.req.raw as Request & { cf?: { colo?: unknown } }).cf?.colo;
        const props = {
          route,
          status,
          total_ms: milliseconds(performance.now() - start),
          edge_cache: 'NONE',
          inner_cache: 'NONE',
          colo: typeof colo === 'string' && /^[A-Za-z0-9]{1,8}$/.test(colo) ? colo : 'unknown',
          cold: c.get('stageCold') === 1 ? 1 : 0,
          ...(stages.auth_ms === undefined ? {} : { auth_ms: milliseconds(stages.auth_ms) }),
          ...(stages.gmail_ms === undefined ? {} : { gmail_ms: milliseconds(stages.gmail_ms) }),
        };
        c.executionCtx.waitUntil(
          Promise.resolve()
            .then(() =>
              createPing({
                key,
                environment: c.env.APP_HEALTH_ENVIRONMENT?.trim() || 'production',
              }).debug('api.stage_timing', { props })
            )
            .catch(() => {})
        );
      }
    } catch {
      // Includes unavailable execution contexts in local callers.
    }
  }
}
