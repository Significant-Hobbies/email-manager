import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { oneTap } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/d1';
import { user, session, account, verification } from '../db/schema';
import { createPing } from './ping';

export type AuthEnv = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DB: any;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  BETTER_AUTH_SECRET?: string;
  AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  NODE_ENV?: string;
  APP_HEALTH_INGEST_KEY?: string;
  APP_HEALTH_ENVIRONMENT?: string;
};

const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8787',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8787',
];

const LOCAL_DEV_SECRET = 'local-dev-email-manager-secret-do-not-use-in-production';

function getEnvValue(env: AuthEnv, key: keyof AuthEnv): string | undefined {
  const value = env[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isLocalDevBaseUrl(baseURL: string): boolean {
  return /localhost|127\.0\.0\.1/.test(baseURL);
}

function resolveSecret(env: AuthEnv, baseURL: string): string | undefined {
  const configured = getEnvValue(env, 'BETTER_AUTH_SECRET') ?? getEnvValue(env, 'AUTH_SECRET');
  if (configured) return configured;
  if (isLocalDevBaseUrl(baseURL) || getEnvValue(env, 'NODE_ENV') === 'development') {
    return LOCAL_DEV_SECRET;
  }
  return undefined;
}

function resolveTrustedOrigins(baseURL: string): string[] {
  return [...new Set([baseURL, ...LOCAL_DEV_ORIGINS])];
}

export function isGoogleOAuthConfigured(env: AuthEnv): boolean {
  return Boolean(getEnvValue(env, 'GOOGLE_CLIENT_ID') && getEnvValue(env, 'GOOGLE_CLIENT_SECRET'));
}

export function createAuth(env: AuthEnv) {
  const baseURL = getEnvValue(env, 'BETTER_AUTH_URL') ?? 'https://mail.significanthobbies.com';
  const secret = resolveSecret(env, baseURL);
  const ping = createPing({
    key: getEnvValue(env, 'APP_HEALTH_INGEST_KEY'),
    environment: getEnvValue(env, 'APP_HEALTH_ENVIRONMENT'),
  });

  return betterAuth({
    database: drizzleAdapter(drizzle(env.DB), {
      provider: 'sqlite',
      schema: { user, session, account, verification },
    }),
    baseURL,
    secret,
    socialProviders: {
      google: {
        clientId: getEnvValue(env, 'GOOGLE_CLIENT_ID') ?? '',
        clientSecret: getEnvValue(env, 'GOOGLE_CLIENT_SECRET') ?? '',
        scope: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/gmail.readonly'],
        accessType: 'offline',
        prompt: 'consent',
      },
    },
    trustedOrigins: resolveTrustedOrigins(baseURL),
    // First-time users must use OAuth once to grant gmail.readonly. One Tap is
    // intentionally limited to returning accounts that already hold that grant.
    plugins: [oneTap({ disableSignup: true })],
    databaseHooks: {
      user: {
        create: {
          after: async (newUser) => {
            await ping('signup', {
              title: newUser.email,
              props: { id: newUser.id, name: newUser.name },
            });
          },
        },
      },
    },
    rateLimit: {
      enabled: false,
    },
  });
}
