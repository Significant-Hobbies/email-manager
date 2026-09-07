import { getEmailsWithoutEmbedding, storeEmail } from './db';
import { embed, prepareEmailText } from './embeddings';

export const SEMANTIC_INDEX_LIMIT = 500;

export async function indexEmailsForSearch(options: {
  accountId: string;
  limit?: number;
  onProgress?: (message: string) => void;
  signal?: { aborted?: boolean };
}): Promise<{ indexed: number; remaining: number }> {
  const limit = options?.limit ?? SEMANTIC_INDEX_LIMIT;
  const unembedded = await getEmailsWithoutEmbedding(options.accountId);
  const toIndex = unembedded
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);

  if (toIndex.length === 0) {
    return { indexed: 0, remaining: 0 };
  }

  options?.onProgress?.('Loading AI model…');
  await embed('warmup');

  for (let i = 0; i < toIndex.length; i++) {
    if (options?.signal?.aborted) break;
    options?.onProgress?.(`Indexing ${i + 1} of ${toIndex.length}…`);
    const text = prepareEmailText(toIndex[i]);
    const embedding = await embed(text);
    await storeEmail({ ...toIndex[i], embedding }, options.accountId);
  }

  const stillPending = Math.max(0, unembedded.length - toIndex.length);
  return { indexed: toIndex.length, remaining: stillPending };
}
