import { createAppHealthClient, type AppHealthClient } from '@saas-maker/app-health';
import type { EventInput } from '@saas-maker/app-health';

export interface AppHealthBindings {
  APP_HEALTH_INGEST_KEY?: string;
  APP_HEALTH_ENVIRONMENT?: string;
}

/** Resolve an opt-in client and drop response-size metadata from endpoint events. */
export function resolveAppHealthClient(env: AppHealthBindings): AppHealthClient | null {
  const key = env.APP_HEALTH_INGEST_KEY?.trim();
  if (!key) return null;

  const client = createAppHealthClient({
    key,
    environment: env.APP_HEALTH_ENVIRONMENT?.trim() || 'production',
    endpoint: 'https://ingest.sassmaker.com/v1/ingest',
    runtime: 'worker',
    disableTimer: true,
  });

  return {
    record(event: EventInput) {
      client.record({
        method: event.method,
        route: event.route,
        status_code: event.status_code,
        duration_ms: event.duration_ms,
      });
    },
    log() {},
    flush: () => client.flush(),
    close: () => client.close(),
    diagnostics: () => client.diagnostics(),
  };
}
