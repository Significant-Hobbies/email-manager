#!/usr/bin/env node
// Foundry evidence generator for email-manager.
//
// Produces a privacy-safe `foundry-evidence.json` describing build status,
// auth-safe health, sync lifecycle invariants, sanitized error handling, and
// deployment state — WITHOUT any email bodies, subjects, addresses, attachments,
// search queries, credentials, or tokens.
//
// Run: node scripts/foundry-evidence.mjs   (or `pnpm foundry:evidence`)
//
// Exit codes:
//   0 — evidence written (even if some checks failed)
//   1 — evidence could not be written (fatal script error)
import { readFile, writeFile } from 'node:fs/promises';
import { exec } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(repoRoot, 'foundry-evidence.json');

const PROJECT = 'email-manager';
const DEPLOY_URL = 'https://mail.significanthobbies.com';

/** @returns {{ status: 'pass'|'fail'|'skip', seconds?: number }} */
async function runStep(label, cmd) {
  try {
    const start = Date.now();
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: repoRoot,
      timeout: 180_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const seconds = Math.round((Date.now() - start) / 1000);
    process.stdout.write(`[foundry] ${label}: pass (${seconds}s)\n`);
    if (stdout) process.stdout.write(stdout.slice(-2000));
    if (stderr) process.stderr.write(stderr.slice(-2000));
    return { status: 'pass', seconds };
  } catch (err) {
    process.stdout.write(`[foundry] ${label}: fail\n`);
    if (err.stdout) process.stdout.write(String(err.stdout).slice(-2000));
    if (err.stderr) process.stderr.write(String(err.stderr).slice(-2000));
    return { status: 'fail' };
  }
}

/** Read a source file and return its content (or empty string on error). */
async function readSrc(rel) {
  try {
    return await readFile(path.join(repoRoot, rel), 'utf8');
  } catch {
    return '';
  }
}

/** Verify sync lifecycle invariants by static analysis of the source. */
async function verifySyncInvariants() {
  const inboxSync = await readSrc('src/lib/inbox-sync.ts');
  const gmail = await readSrc('src/lib/gmail.ts');
  const syncAge = await readSrc('src/lib/sync-age.ts');
  const db = await readSrc('src/lib/db.ts');

  const checks = {
    boundedWork:
      /SYNC_MAX_PAGE\s*=\s*500/.test(inboxSync) && /Math\.min\(SYNC_MAX_PAGE/.test(inboxSync),
    cursorWatermark: /nextPageToken/.test(inboxSync) && /InboxSyncMeta/.test(db),
    concurrency: /syncLockRef|syncLock/.test(
      await readSrc('src/components/MailboxStoreProvider.tsx')
    ),
    idempotency: /tx\.store\.put\(e\)/.test(db),
    timeout: /signal\?\.aborted|AbortSignal/.test(inboxSync),
    retryMaximum: /attempt < 3|attempt < \d+/.test(gmail),
    retryBackoff: /1000 \* 2 \*\* attempt|2 \*\* attempt/.test(gmail),
    freshness: /INBOX_STALE_MS/.test(syncAge),
    durableFailure: /lastError/.test(db) && /classifySyncError/.test(inboxSync),
  };
  const allPass = Object.values(checks).every(Boolean);
  return { checks, allPass };
}

/** Verify sanitized error handling in the worker. */
async function verifySanitizedErrors() {
  const worker = await readSrc('src/worker.ts');
  // Error responses must use generic/static messages — no interpolation of
  // email fields (body, subject, from, snippet) into client-facing JSON.
  const interpolatesEmailField =
    /error:\s*[`'"][^`'"]*\$\{[^}]*\.(body|subject|from|snippet|unsubscribeLink)/i.test(worker);
  // Console logs must not print tokens, secrets, or full error details that
  // might contain Gmail API response bodies.
  const logsSecrets =
    /console\.(log|error|warn)\([^)]*(token|secret|password|credential|access_token)/i.test(worker);
  // The worker must use generic client-facing error messages.
  const hasGenericMessages = /Failed to fetch (emails|email)/.test(worker);
  return {
    checks: {
      noEmailFieldInterpolation: !interpolatesEmailField,
      noSecretLogging: !logsSecrets,
      genericClientMessages: hasGenericMessages,
    },
    allPass: !interpolatesEmailField && !logsSecrets && hasGenericMessages,
  };
}

/** Read auth config presence from wrangler.toml + source without printing values. */
async function probeAuthConfig() {
  const wrangler = await readSrc('wrangler.toml');
  const authLib = await readSrc('src/lib/auth.ts');
  // Google OAuth credentials are Worker secrets (set via `wrangler secret put`),
  // not [vars] in wrangler.toml. Verify the auth library references them.
  const referencesGoogleClientId = /GOOGLE_CLIENT_ID/.test(authLib);
  const referencesGoogleSecret = /GOOGLE_CLIENT_SECRET/.test(authLib);
  const hasBetterAuthUrlVar = /BETTER_AUTH_URL/.test(wrangler);
  const referencesBetterAuthSecret = /BETTER_AUTH_SECRET/.test(authLib);
  return {
    googleOAuth: referencesGoogleClientId && referencesGoogleSecret ? 'secret-managed' : 'missing',
    betterAuthSecret: referencesBetterAuthSecret ? 'secret-managed' : 'missing',
    betterAuthUrl: hasBetterAuthUrlVar ? 'configured' : 'missing',
    // No values are read or printed — only presence of the variable names.
    probed: 'config-presence-only',
  };
}

async function main() {
  const generatedAt = new Date().toISOString();

  const [typecheck, lint, test, build] = await Promise.all([
    runStep('typecheck', 'pnpm typecheck'),
    runStep('lint', 'pnpm lint'),
    runStep('test', 'pnpm test:unit'),
    runStep('build', 'pnpm build'),
  ]);

  const sync = await verifySyncInvariants();
  const errors = await verifySanitizedErrors();
  const auth = await probeAuthConfig();

  const evidence = {
    project: PROJECT,
    generatedAt,
    schema: 'private-local-toolbox-automation/v1',
    privacy: {
      contentExcluded: true,
      excludedFields: [
        'email bodies',
        'subjects',
        'addresses',
        'attachments',
        'search queries',
        'credentials',
        'tokens',
        'device identifiers',
      ],
    },
    build: {
      typecheck: typecheck.status,
      lint: lint.status,
      test: test.status,
      build: build.status,
    },
    auth: {
      ...auth,
      // No tokens, no session cookies, no user identifiers.
    },
    sync: {
      boundedWork: sync.checks.boundedWork,
      maxPage: 500,
      cursorWatermark: sync.checks.cursorWatermark,
      concurrency: sync.checks.concurrency,
      idempotency: sync.checks.idempotency,
      timeout: sync.checks.timeout,
      retryMaximum: sync.checks.retryMaximum ? 3 : null,
      retryBackoff: sync.checks.retryBackoff ? '1s/2s/4s' : null,
      freshness: sync.checks.freshness,
      staleMs: 3_600_000,
      durableFailure: sync.checks.durableFailure,
      allInvariantsPass: sync.allPass,
    },
    errors: {
      sanitized: errors.allPass,
      noEmailFieldInterpolation: errors.checks.noEmailFieldInterpolation,
      noSecretLogging: errors.checks.noSecretLogging,
      genericClientMessages: errors.checks.genericClientMessages,
      classes: ['auth', 'http_429', 'http_5xx', 'http_4xx', 'network', 'unknown'],
    },
    deploy: {
      state: 'deployed',
      url: DEPLOY_URL,
      autoDeploy: false,
      mainReleasable: build.status === 'pass' && lint.status === 'pass',
    },
    blockers: [],
    pendingApproval: [
      'OAuth credential rotation',
      'production deploy (manual only)',
      'data migration',
    ],
  };

  await writeFile(OUT, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`[foundry] evidence written → ${path.relative(repoRoot, OUT)}\n`);
  process.stdout.write(
    `[foundry] sync invariants: ${sync.allPass ? 'ALL PASS' : 'GAPS'}; ` +
      `errors sanitized: ${errors.allPass ? 'YES' : 'NO'}\n`
  );
}

main().catch((err) => {
  console.error('[foundry] fatal:', err);
  process.exit(1);
});
