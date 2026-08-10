import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { expect, test } from 'vitest';

import { buildWeeklyDigest, type DigestEmailInput } from '../digest';

const SIZES = [1000, 10_000, 50_000];
const ITERATIONS = 25;
const NOW = new Date('2026-08-10T00:00:00Z');
const EXPECTED_DIGESTS = new Map([
  [1000, '3d96492d0c31b305026a3d479f136ad1315531f4411287021336b9e9b38c8287'],
  [10_000, 'dfd88058f6f0a532fc03780d33d34242aded8592f242e1a9a82aa1fa6dc83cc9'],
  [50_000, 'a613acd0d4419028f3d0306480318ba3cb4d90212e19dfce5af050cd3274d8a6'],
]);

test('weekly digest scales across local inbox sizes', { timeout: 30_000 }, () => {
  const largestInbox = buildInbox(SIZES.at(-1) ?? 0);
  const metrics: string[] = [];

  for (const size of SIZES) {
    const emails = largestInbox.slice(0, size);
    const expected = JSON.stringify(buildWeeklyDigest(emails, { now: NOW }));
    expect(createHash('sha256').update(expected).digest('hex')).toBe(EXPECTED_DIGESTS.get(size));
    let durationMs = 0;
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const startedAt = performance.now();
      const digest = buildWeeklyDigest(emails, { now: NOW });
      durationMs += performance.now() - startedAt;
      expect(JSON.stringify(digest)).toBe(expected);
    }
    metrics.push(`size${size}=${(durationMs / ITERATIONS).toFixed(3)}ms/op`);
  }

  console.log(`[benchmark] ${metrics.join(' ')} (${ITERATIONS} iterations)`);
  console.log(`[resource] largest_input_rows=${largestInbox.length}`);
});

function buildInbox(size: number): DigestEmailInput[] {
  const subjects = [
    'Invoice for consulting work',
    'Meeting invite for project review',
    'Interview follow-up',
    'Family birthday plans',
    'Order tracking update',
    'General project note',
  ];
  return Array.from({ length: size }, (_, index) => {
    const dayOffset = (index * 17) % 180;
    const date = new Date(NOW);
    date.setUTCDate(date.getUTCDate() - dayOffset);
    return {
      id: `email-${index}`,
      threadId: `thread-${index % 500}`,
      subject: subjects[index % subjects.length],
      from: `Sender ${index % 200} <sender-${index % 200}@example-${index % 20}.com>`,
      date: date.toISOString(),
      snippet: `Message ${index}`,
      labelIds: index % 17 === 0 ? ['STARRED'] : [],
    };
  });
}
