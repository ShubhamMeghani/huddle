import 'server-only';
import { q } from './db';

/** One report per player per question (R60); a question with ≥ 3 distinct reporters is excluded from new games. */
export async function reportQuestion(questionId: string, identityId: string, reason: string): Promise<boolean> {
  const rows = await q(
    'insert into question_reports (question_id, identity_id, reason) values ($1, $2, $3) on conflict do nothing returning 1',
    [questionId, identityId, reason],
  );
  return rows.length > 0;
}

export async function excludedQuestionIds(): Promise<string[]> {
  const rows = await q<{ question_id: string }>('select question_id from question_reports group by question_id having count(*) >= 3');
  return rows.map((r) => r.question_id);
}
