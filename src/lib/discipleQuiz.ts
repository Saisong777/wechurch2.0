import { DISCIPLE_IDS, QUESTIONS, type DiscipleId } from './discipleQuizData';

export const QUIZ_VERSION = 'twelve-castle-2';
export const QUIZ_STORAGE_KEY = `wechurch:${QUIZ_VERSION}:draft`;
export type QuizAnswers = Array<number | null>;
export interface QuizDraft { version: typeof QUIZ_VERSION; answers: QuizAnswers; current: number; phase: 'quiz' | 'result' }
export const emptyAnswers = (): QuizAnswers => QUESTIONS.map(() => null);
export const answeredCount = (answers: readonly (number | null)[]) => answers.filter(answer => answer !== null).length;
export function validAnswer(answer: unknown): answer is number { return Number.isInteger(answer) && typeof answer === 'number' && answer >= 0 && answer < 4; }

// A bounded, versioned, tab-only draft. Persist answers, never identity or inferred traits.
export function parseQuizDraft(raw: string | null): QuizDraft | null {
  if (!raw || raw.length > 4096) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const draft = value as Record<string, unknown>;
    if (draft.version !== QUIZ_VERSION || !Array.isArray(draft.answers) || draft.answers.length !== QUESTIONS.length) return null;
    if (!draft.answers.every(answer => answer === null || validAnswer(answer))) return null;
    const firstBlank = draft.answers.indexOf(null);
    if (firstBlank !== -1 && draft.answers.slice(firstBlank).some(answer => answer !== null)) return null;
    if (!Number.isInteger(draft.current) || typeof draft.current !== 'number' || draft.current < 0 || draft.current >= QUESTIONS.length) return null;
    if (firstBlank !== -1 && draft.current > firstBlank) return null;
    if (draft.phase !== 'quiz' && draft.phase !== 'result') return null;
    if (draft.phase === 'result' && firstBlank !== -1) return null;
    return {version: QUIZ_VERSION, answers: [...draft.answers], current: draft.current, phase: draft.phase};
  } catch { return null; }
}

export function computeQuiz(answers: readonly (number | null)[]) {
  if (answers.length !== QUESTIONS.length || !Array.from(answers).every(validAnswer)) throw new Error('請完成全部題目，再查看結果。');
  const scores: Record<DiscipleId, number> = Object.fromEntries(DISCIPLE_IDS.map(id => [id, 0])) as Record<DiscipleId, number>;
  answers.forEach((answer, index) => { scores[QUESTIONS[index].options[answer as number].role] += 1; });
  const sorted = DISCIPLE_IDS.map(id => ({id, score: scores[id]})).sort((a, b) => b.score - a.score);
  const max = sorted[0].score;
  return {scores, sorted, leaders: sorted.filter(row => row.score === max), max};
}

export function supportingAnswers(answers: readonly (number | null)[], id: DiscipleId) {
  return QUESTIONS.flatMap((question, index) => {
    const answer = answers[index];
    return validAnswer(answer) && question.options[answer].role === id ? [{question: question.text, answer: question.options[answer].text}] : [];
  });
}
