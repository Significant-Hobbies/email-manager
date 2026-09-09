export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_REVISION = '751bff37182d3f1213fa05d7196b954e230abad9';
export const EMBEDDING_IDENTITY = `${EMBEDDING_MODEL}@${EMBEDDING_REVISION}:fp32:mean:normalized:email-text-v1`;
const EMBEDDING_DIMENSIONS = 384;

export function isValidEmbedding(vector: unknown): vector is number[] {
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) return false;
  if (!vector.every((value) => typeof value === 'number' && Number.isFinite(value))) return false;
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return Math.abs(norm - 1) < 0.01;
}

export function hasCurrentEmbedding(email: {
  embedding: number[] | null;
  embeddingModel?: string;
}): boolean {
  return email.embeddingModel === EMBEDDING_IDENTITY && isValidEmbedding(email.embedding);
}
