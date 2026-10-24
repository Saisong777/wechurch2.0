import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, ChevronLeft, ChevronRight, Compass, Copy, RotateCcw, ScrollText } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { usePageScroll } from '@/contexts/PageScrollContext';
import { DISCIPLES, QUESTIONS, type DiscipleId } from '@/lib/discipleQuizData';
import { answeredCount, computeQuiz, emptyAnswers, parseQuizDraft, QUIZ_STORAGE_KEY, QUIZ_VERSION, supportingAnswers, type QuizDraft } from '@/lib/discipleQuiz';
import './disciple-quiz.css';

function readDraft() { try { return parseQuizDraft(sessionStorage.getItem(QUIZ_STORAGE_KEY)); } catch { return null; } }

export default function DiscipleQuiz() {
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [answers, setAnswers] = useState(emptyAnswers);
  const [current, setCurrent] = useState(0);
  const [saved, setSaved] = useState(readDraft);
  const [canSave, setCanSave] = useState(true);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [inspected, setInspected] = useState<DiscipleId | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'fallback'>('idle');
  const heading = useRef<HTMLHeadingElement>(null);
  const scroll = usePageScroll();
  const complete = answeredCount(answers);
  const result = useMemo(() => phase === 'result' ? computeQuiz(answers) : null, [phase, answers]);
  const question = QUESTIONS[current];
  const activeId = inspected ?? (result?.leaders.length === 1 ? result.leaders[0].id : null);
  const profile = DISCIPLES.find(item => item.id === activeId);

  useLayoutEffect(() => { scroll.to(0); heading.current?.focus({preventScroll: true}); }, [phase, current, scroll]);
  useEffect(() => {
    if (phase === 'intro') return;
    const draft: QuizDraft = {version: QUIZ_VERSION, answers, current, phase};
    try { sessionStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(draft)); setSaved(draft); setCanSave(true); }
    catch { setCanSave(false); }
  }, [phase, answers, current]);

  const restart = () => {
    setAnswers(emptyAnswers()); setCurrent(0); setInspected(null); setCopyStatus('idle'); setSaved(null); setPhase('quiz'); setConfirmRestart(false);
  };
  const continueDraft = () => {
    if (!saved) return;
    setAnswers([...saved.answers]); setCurrent(saved.current); setPhase(saved.phase); setInspected(null); setCopyStatus('idle');
  };
  const inspectProfile = (id: DiscipleId) => { setInspected(id); scroll.to(0); heading.current?.focus({preventScroll: true}); };
  const next = () => {
    if (answers[current] === null) return;
    if (current === QUESTIONS.length - 1) { setPhase('result'); setInspected(null); }
    else setCurrent(value => Math.min(value + 1, QUESTIONS.length - 1));
  };
  const summary = result ? `十二門徒人格｜本次同行傾向\n${result.leaders.map(row => `${DISCIPLES.find(item => item.id === row.id)!.name}・${DISCIPLES.find(item => item.id === row.id)!.title}（選中 ${row.score} 次／8 次出現機會）`).join('\n')}\n${result.leaders.length > 1 ? '本次有並列傾向，不必只選一個標籤。\n' : ''}這是情境反思遊戲，並非心理診斷、人格機率或使命判定。` : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(summary); setCopyStatus('copied'); }
    catch { setCopyStatus('fallback'); }
  };

  return <div className="disciple-quiz" data-testid="disciple-quiz">
    <div className="dq-content">
      {phase === 'intro' && <section className="dq-intro">
        <div className="dq-crest" aria-hidden="true"><ScrollText size={32}/></div>
        <p className="dq-eyebrow">TWELVE · 相聚小亭</p>
        <h1 ref={heading} tabIndex={-1}>十二門徒人格</h1>
        <p className="dq-lead">一起發現，你自然帶給同行者的力量。</p>
        <div className="dq-company" aria-hidden="true">{DISCIPLES.map(d => <span key={d.id}>{d.icon}</span>)}</div>
        <p>24 個生活情境，看看你這次呈現哪些同行傾向。你可能同時像幾位門徒，不必把自己放進單一格子。</p>
        <div className="dq-instructions"><p><strong>怎麼回答：</strong> 回想最近三個月的實際做法；若沒遇過這個情境，選最接近你平常反應的一項。沒有標準答案，不必選「應該成為的自己」。</p><p>每題可改答案，也能回上一題。進度只在這個瀏覽器分頁暫存，不會上傳。</p></div>
        <div className="dq-intro-actions">
          {saved && answeredCount(saved.answers) > 0 && <button className="dq-primary" onClick={continueDraft}>{saved.phase === 'result' ? '查看上次結果' : `繼續測驗（已答 ${answeredCount(saved.answers)} 題）`}<ChevronRight size={18}/></button>}
          <button className={saved && answeredCount(saved.answers) > 0 ? 'dq-secondary' : 'dq-primary'} onClick={() => saved && answeredCount(saved.answers) > 0 ? setConfirmRestart(true) : restart()}>{saved && answeredCount(saved.answers) > 0 ? '重新開始' : '開始探索'}<Compass size={18}/></button>
        </div>
        <p className="dq-caption">這是自我認識與小組交流的情境遊戲，尚未做心理測量的信效度驗證，也不決定你的恩賜、價值或使命。</p>
        <details className="dq-method"><summary>關於十二位角色與計分</summary><p>每題選一個最接近的做法，該選項對應的創作角色得到一票。12 類各出現 8 次，A、B、C、D 位置各 2 次；24 題完成後才顯示結果。同分會全部並列，不靠隨機抽選或先後順序決定。每題只能選一項，各類次數會互相影響，請勿比較不同人的分數高低。</p><p>本測驗以門徒故事為靈感，保留拿但業與馬提亞；馬提亞是後來補入使徒行列，並非原始十二名單。人物稱號、心理特質與應用屬遊戲創作；結果另列經文明說及傳統對應，讓故事與想像有清楚界線。</p></details>
      </section>}

      {phase === 'quiz' && <section aria-label="測驗題目">
        <div className="dq-progress-label"><span>第 {current + 1} 題／{QUESTIONS.length} 題</span><span>已答 {complete} 題</span></div>
        <progress aria-label={`已完成 ${complete} 題，共 ${QUESTIONS.length} 題`} max={QUESTIONS.length} value={complete}/>
        <p className="dq-chapter"><BookOpen size={15} aria-hidden="true"/>{question.chapter}</p>
        <h1 ref={heading} tabIndex={-1} className="dq-question">{question.text}</h1>
        <p className="dq-hint">選最像你實際做法或平常反應的一項。</p>
        <fieldset key={question.id} className="dq-options"><legend className="sr-only">選擇最接近自己的做法</legend>{question.options.map((option, index) => <label key={index} className={`dq-option ${answers[current] === index ? 'dq-option--selected' : ''}`}><input type="radio" name={question.id} value={index} checked={answers[current] === index} onChange={() => setAnswers(previous => previous.map((answer, i) => i === current ? index : answer))}/><span className="dq-option-letter" aria-hidden="true">{'ABCD'[index]}</span><span>{option.text}</span><Check className="dq-option-check" size={18} aria-hidden="true"/></label>)}</fieldset>
        <div className="dq-question-actions"><button className="dq-secondary" onClick={() => setCurrent(value => Math.max(value - 1, 0))} disabled={current === 0}><ChevronLeft size={18}/>上一題</button><button className="dq-primary" disabled={answers[current] === null} onClick={next}>{current === QUESTIONS.length - 1 ? '看看同行組合' : '下一題'}<ChevronRight size={18}/></button></div>
        <p className="dq-caption" role="status">{canSave ? '已暫存於這個分頁，可回上一題修改。' : '目前無法暫存；重新整理或離開可能失去進度，請先完成測驗。'}</p>
      </section>}

      {phase === 'result' && result && <section className="dq-result">
        <p className="dq-eyebrow">TWELVE · 你的同行組合</p>
        <h1 ref={heading} tabIndex={-1}>{result.leaders.length === 1 ? '這次，最接近你的傾向' : result.leaders.length === DISCIPLES.length ? '你呈現了多種同行傾向' : `${result.leaders.length} 種傾向，並列在你身上`}</h1>
        <p className="dq-hint">{result.leaders.length > 1 ? '沒有單一主型。選一位角色看看，不必急著為自己定型。' : '從這次選擇出發，留意你如何與人同行。'}</p>
        {result.leaders.length > 1 && <div className="dq-leaders" role="group" aria-label="並列的同行傾向">{result.leaders.map(row => { const d = DISCIPLES.find(item => item.id === row.id)!; return <button key={d.id} className="dq-secondary" aria-pressed={activeId === d.id} onClick={() => inspectProfile(d.id)}><span aria-hidden="true">{d.icon}</span>{d.name}・{d.title}</button>; })}</div>}
        {profile && <article className="dq-profile" aria-label={`${profile.name}的同行反思`}><div className="dq-profile-title"><span className="dq-profile-emblem" aria-hidden="true">{profile.icon}</span><div><p className="dq-eyebrow">{profile.name}</p><h2>{profile.title}</h2></div></div><p className="dq-traits">{profile.traits.join(' · ')}</p><p>{profile.reflection}</p>
          <div className="dq-reflection-grid"><section><h3>你可能帶來的力量</h3><p>{profile.strength}</p></section><section><h3>可以多留意的一步</h3><p>{profile.growth}</p></section></div>
          <section className="dq-mission"><h3><Compass size={18} aria-hidden="true"/>今天的同行小任務</h3><p>{profile.action}</p></section><section><h3>找位朋友聊聊</h3><p>「{profile.prompt}」</p></section>
          <details className="dq-method"><summary>為什麼會出現這個傾向？</summary><p>在這個角色出現的 8 次機會中，你選中 {result.scores[profile.id]} 次。這是本題庫的選項計數，不是人格百分比或與他人的排名。</p><ul>{supportingAnswers(answers, profile.id).map((item, index) => <li key={index}><strong>{item.question}</strong><p>{item.answer}</p></li>)}</ul></details>
          <details className="dq-method"><summary>經文中的他與創作界線</summary><p><strong>{profile.reference}</strong></p><p>{profile.scripture}</p><p className="dq-caption">{profile.sourceNote}</p><p className="dq-caption">上方角色特質、強項與練習是遊戲反思，並非對門徒或你的心理診斷。</p></details>
        </article>}
        <section className="dq-breakdown" aria-label="十二種傾向的選項計數"><h2>完整同行傾向</h2><p className="dq-caption">每類有 8 次出現機會；數字是選中次數，並非準確率。相同次數依固定順序列出，無先後之分。點選任一角色，可閱讀對應反思。</p>{result.sorted.map(row => { const d = DISCIPLES.find(item => item.id === row.id)!; return <button key={d.id} className="dq-score" aria-pressed={activeId === d.id} onClick={() => inspectProfile(d.id)}><span aria-hidden="true">{d.icon}</span><span className="dq-score-name">{d.name}<small>{d.title}</small></span><span className="dq-score-track" aria-hidden="true"><span style={{width: `${row.score / 8 * 100}%`}}/></span><span className="dq-score-count">{row.score}／8</span></button>; })}</section>
        <p className="dq-caption">每人都會隨情境與成長有不同表現。這份結果適合開啟對話，不能用來判定能力、屬靈程度或分配服事。</p>
        <div className="dq-result-actions"><button className="dq-primary" onClick={() => void copy()}><Copy size={18}/>複製結果摘要</button><button className="dq-secondary" onClick={() => setConfirmRestart(true)}><RotateCcw size={18}/>再探索一次</button></div>
        <p className="dq-caption" role="status">{copyStatus === 'copied' ? '已複製，是否分享由你決定。' : copyStatus === 'fallback' ? '無法自動複製；請選取下方摘要再複製。' : ''}</p>
        {copyStatus === 'fallback' && <textarea aria-label="可複製的結果摘要" className="dq-summary" readOnly value={summary}/>}
      </section>}
    </div>
    <AlertDialog open={confirmRestart} onOpenChange={setConfirmRestart}><AlertDialogContent className="dq-reset-dialog"><AlertDialogHeader><AlertDialogTitle>重新開始測驗？</AlertDialogTitle><AlertDialogDescription>這會清除這個分頁的本次答案，從第一題重新探索。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>保留本次進度</AlertDialogCancel><AlertDialogAction onClick={restart}>清除並重新開始</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
