import { describe, expect, it } from 'vitest';
import { DISCIPLE_IDS, QUESTIONS } from './discipleQuizData';
import { computeQuiz, emptyAnswers, parseQuizDraft, QUIZ_VERSION, supportingAnswers } from './discipleQuiz';

describe('twelve scoring contract', () => {
  it('offers equal opportunities and balanced positions, with near-balanced pairs', () => {
    expect(QUESTIONS).toHaveLength(24);
    expect(new Set(QUESTIONS.map(q => q.id)).size).toBe(24);
    for (const q of QUESTIONS) { expect(q.options).toHaveLength(4); expect(new Set(q.options.map(o => o.role)).size).toBe(4); }
    for (const id of DISCIPLE_IDS) {
      expect(QUESTIONS.flatMap(q => q.options).filter(o => o.role === id)).toHaveLength(8);
      for (let slot = 0; slot < 4; slot++) expect(QUESTIONS.filter(q => q.options[slot].role === id)).toHaveLength(2);
    }
    const pairs = DISCIPLE_IDS.flatMap((a, i) => DISCIPLE_IDS.slice(i + 1).map(b => QUESTIONS.filter(q => q.options.some(o => o.role === a) && q.options.some(o => o.role === b)).length));
    expect(pairs.filter(n => n === 2)).toHaveLength(54); expect(pairs.filter(n => n === 3)).toHaveLength(12);
  });
  it.each([0, 1, 2, 3])('does not pick an arbitrary first role when all answers use position %i', slot => {
    const result = computeQuiz(Array(24).fill(slot));
    expect(result.leaders).toHaveLength(12); expect(Object.values(result.scores)).toEqual(Array(12).fill(2));
  });
  it('allows every role to be the unique leader', () => {
    for (const id of DISCIPLE_IDS) {
      const answers = QUESTIONS.map(q => Math.max(0, q.options.findIndex(o => o.role === id)));
      expect(computeQuiz(answers).leaders.map(r => r.id)).toEqual([id]);
    }
  });
  it('rejects sparse arrays instead of treating missing slots as completed answers', () => {
    expect(() => computeQuiz(Array(24))).toThrow();
  });
  it('recomputes from the answer set, without retaining the previous choice', () => {
    const answers = Array(24).fill(0); const original = computeQuiz(answers); answers[0] = 1; const changed = computeQuiz(answers);
    expect(changed.scores[QUESTIONS[0].options[0].role]).toBe(original.scores[QUESTIONS[0].options[0].role] - 1);
    expect(changed.scores[QUESTIONS[0].options[1].role]).toBe(original.scores[QUESTIONS[0].options[1].role] + 1);
    expect(Object.values(changed.scores).reduce((a, b) => a + b)).toBe(24);
    expect(supportingAnswers(answers, QUESTIONS[0].options[1].role).some(row => row.answer === QUESTIONS[0].options[1].text)).toBe(true);
  });
  it.each([[], Array(24).fill(null), Array(23).fill(0), Array(24).fill(4), Array(24).fill(-1), Array(24).fill(NaN), Array(24).fill('0')])('rejects incomplete or invalid results %#', answers => {
    expect(() => computeQuiz(answers)).toThrow();
  });
});

describe('bounded versioned tab draft', () => {
  const draft = () => ({version: QUIZ_VERSION, answers: [2, ...emptyAnswers().slice(1)], current: 1, phase: 'quiz'});
  it('reads a valid snapshot as an isolated copy', () => { const value = draft(); expect(parseQuizDraft(JSON.stringify(value))).toEqual(value); });
  it.each([null, '{', 'x'.repeat(4097), JSON.stringify({...draft(), version: 'old'}), JSON.stringify({...draft(), answers: [0]}), JSON.stringify({...draft(), current: -1}), JSON.stringify({...draft(), current: 24}), JSON.stringify({...draft(), current: 3}), JSON.stringify({...draft(), phase: 'result'}), JSON.stringify({...draft(), answers: [null, 1, ...emptyAnswers().slice(2)]}), JSON.stringify({...draft(), answers: Array(24).fill(true)})])('ignores malformed, stale or inconsistent data %#', raw => { expect(parseQuizDraft(raw)).toBeNull(); });
  it('restores only a complete result and discards unneeded identity fields', () => {
    const raw = {version: QUIZ_VERSION, answers: Array(24).fill(0), current: 23, phase: 'result', email: 'not-persisted'};
    expect(parseQuizDraft(JSON.stringify(raw))).toEqual({version: QUIZ_VERSION, answers: Array(24).fill(0), current: 23, phase: 'result'});
  });
});
