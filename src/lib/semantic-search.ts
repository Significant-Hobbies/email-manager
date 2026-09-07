import type { StoredEmail } from './db';
import { getAllEmails } from './db';
import { embed } from './embeddings';

export interface SearchResult {
  email: StoredEmail;
  score: number;
}

const SUBJECT_BOOST = 0.05;
const SENDER_BOOST = 0.03;
const MAX_RESULTS = 50;

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export async function semanticSearch(query: string, accountId: string): Promise<SearchResult[]> {
  const [queryEmbedding, emails] = await Promise.all([embed(query), getAllEmails(accountId)]);

  const queryLower = query.toLowerCase();

  return emails
    .filter((e) => e.embedding)
    .map((email) => {
      // Embeddings are normalized, so dot product = cosine similarity
      let score = dotProduct(queryEmbedding, email.embedding!);

      if (email.subject.toLowerCase().includes(queryLower)) {
        score += SUBJECT_BOOST;
      }
      if (email.from.toLowerCase().includes(queryLower)) {
        score += SENDER_BOOST;
      }

      return { email, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);
}
