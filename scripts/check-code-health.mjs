#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const productionPaths = ['src', 'scripts'];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`${command} exited with status ${result.status}`);
  }
  return result;
}

function commandWithUvx(command, uvxArgs) {
  const probe = spawnSync(command, ['--version'], { encoding: 'utf8' });
  return probe.status === 0 ? { command, prefix: [] } : { command: 'uvx', prefix: uvxArgs };
}

function checkComplexity() {
  const lizard = commandWithUvx('lizard', ['--from', 'lizard==1.23.0', 'lizard']);
  const result = run(lizard.command, [
    ...lizard.prefix,
    ...productionPaths,
    '-x',
    '**/*.test.*',
    '--csv',
  ]);
  const rows = result.stdout
    .trim()
    .split('\n')
    .map((line) => line.match(/^(\d+),(\d+),(\d+),(\d+),(\d+),/u))
    .filter(Boolean)
    .map((match) => match.slice(1).map(Number));
  const observed = {
    functions: rows.length,
    nloc: rows.reduce((sum, row) => sum + row[0], 0),
    violations: rows.filter((row) => row[1] > 15 || row[4] > 100 || row[3] > 7).length,
    maxCcn: Math.max(...rows.map((row) => row[1])),
    maxLength: Math.max(...rows.map((row) => row[4])),
    maxParams: Math.max(...rows.map((row) => row[3])),
  };
  // Ratcheted legacy debt: https://github.com/Significant-Hobbies/email-manager/issues/32
  const baseline = { violations: 0, maxCcn: 15, maxLength: 100, maxParams: 6 };
  const regressions = Object.entries(baseline).filter(([key, maximum]) => observed[key] > maximum);
  console.log(
    `Complexity: ${observed.functions} functions, ${observed.nloc} NLOC, ` +
      `${observed.violations} violations; max CCN ${observed.maxCcn}, ` +
      `max length ${observed.maxLength}, max params ${observed.maxParams}.`
  );
  if (regressions.length > 0) {
    throw new Error(
      regressions
        .map(([key, maximum]) => `${key} regressed: ${observed[key]} > ${maximum}`)
        .join('\n')
    );
  }
  if (Object.entries(baseline).some(([key, maximum]) => observed[key] < maximum)) {
    console.log(
      'Complexity improved; lower the checked-in baseline in the next intentional update.'
    );
  }
}

function checkDependencies() {
  const result = run('pnpm', ['audit', '--json'], { allowFailure: true });
  const report = JSON.parse(result.stdout);
  // Accepted migration/tooling debt: https://github.com/Significant-Hobbies/email-manager/issues/32
  const accepted = new Set(['GHSA-5p2g-fcmc-qvqq', 'GHSA-w3rx-r6r6-pgpr']);
  const severe = Object.values(report.advisories ?? {}).filter((advisory) =>
    ['critical', 'high'].includes(advisory.severity)
  );
  const unexpected = severe.filter((advisory) => !accepted.has(advisory.github_advisory_id));
  const critical = severe.filter((advisory) => advisory.severity === 'critical').length;
  const high = severe.filter((advisory) => advisory.severity === 'high').length;
  console.log(
    `Dependencies: ${critical} critical, ${high} high, ${unexpected.length} unexpected; ` +
      `${severe.length - unexpected.length} accepted framework/docs-tool advisories.`
  );
  if (unexpected.length > 0) {
    throw new Error(
      `Unexpected critical/high advisories: ${unexpected
        .map((advisory) => advisory.github_advisory_id)
        .join(', ')}`
    );
  }
}

const checks = {
  complexity: checkComplexity,
  dependencies: checkDependencies,
};
const selected = process.argv[2];

if (!Object.hasOwn(checks, selected)) {
  console.error(`Usage: check-code-health.mjs <${Object.keys(checks).join('|')}>`);
  process.exit(2);
}

try {
  checks[selected]();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
