import { describe, expect, it } from 'vitest';
import { EMBEDDING_IDENTITY, hasCurrentEmbedding, isValidEmbedding } from '../embedding-contract';

const vector = [1, ...new Array(383).fill(0)];

describe('embedding cache contract', () => {
  it('accepts only the current model contract with a normalized finite vector', () => {
    expect(hasCurrentEmbedding({ embedding: vector, embeddingModel: EMBEDDING_IDENTITY })).toBe(
      true
    );
    expect(hasCurrentEmbedding({ embedding: vector })).toBe(false);
    expect(hasCurrentEmbedding({ embedding: vector, embeddingModel: 'other-model' })).toBe(false);
  });

  it.each([
    null,
    [],
    [1, 0],
    new Array(384).fill(0),
    [Number.NaN, ...vector.slice(1)],
    [Number.POSITIVE_INFINITY, ...vector.slice(1)],
    [2, ...vector.slice(1)],
  ])('rejects malformed or unnormalized vectors: %j', (embedding) => {
    expect(isValidEmbedding(embedding)).toBe(false);
  });
});
