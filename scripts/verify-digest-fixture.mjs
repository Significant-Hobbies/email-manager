/**
 * Verifies fixtures/digest-sample-emails.json against
 * fixtures/weekly-digest-sample.json.
 *
 * Requires tsx (via pnpm exec). Run from repo root:
 *   pnpm exec tsx scripts/verify-digest-fixture.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWeeklyDigest } from '../src/lib/digest.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const FIXTURE_NOW = new Date('2026-06-04T12:00:00.000Z');

const emails = JSON.parse(readFileSync(join(root, 'fixtures/digest-sample-emails.json'), 'utf8'));
const expected = JSON.parse(readFileSync(join(root, 'fixtures/weekly-digest-sample.json'), 'utf8'));

const actual = buildWeeklyDigest(emails, { now: FIXTURE_NOW });

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  console.error('Digest fixture mismatch.');
  console.error('Expected:', JSON.stringify(expected, null, 2));
  console.error('Actual:  ', JSON.stringify(actual, null, 2));
  process.exit(1);
}

console.log('digest fixture OK');
