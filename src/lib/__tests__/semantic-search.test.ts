import { beforeEach, expect, it, vi } from 'vitest';
import type { StoredEmail } from '../db';
import { getAllEmails } from '../db';
import { EMBEDDING_IDENTITY } from '../embedding-contract';
import { embed } from '../embeddings';
import { semanticSearch } from '../semantic-search';

vi.mock('../db', () => ({ getAllEmails: vi.fn() }));
vi.mock('../embeddings', () => ({ embed: vi.fn() }));
const vector = [1, ...new Array(383).fill(0)];
const sparse = new Array(384);
sparse[0] = 1;
const email: StoredEmail = {
  id: 'current',
  threadId: 'fixture',
  subject: 'flight',
  from: 'fixture@example.invalid',
  body: 'Synthetic',
  snippet: 'Synthetic',
  date: '2026-09-09T00:00:00Z',
  labels: [],
  embedding: vector,
  embeddingModel: EMBEDDING_IDENTITY,
};

beforeEach(() => {
  vi.mocked(embed).mockResolvedValue(vector);
  vi.mocked(getAllEmails).mockResolvedValue([email]);
});

it('rejects a sparse query vector rather than returning NaN scores', async () => {
  vi.mocked(embed).mockResolvedValue(sparse);
  await expect(semanticSearch('flight', 'fixture')).rejects.toThrow('invalid search vector');
});

it('excludes sparse current-model cache entries while preserving a valid result', async () => {
  vi.mocked(getAllEmails).mockResolvedValue([{ ...email, id: 'sparse', embedding: sparse }, email]);
  const results = await semanticSearch('flight', 'fixture');
  expect(results.map((result) => result.email.id)).toEqual(['current']);
  expect(results.every((result) => Number.isFinite(result.score))).toBe(true);
});
