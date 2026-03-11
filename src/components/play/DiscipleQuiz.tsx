import { useState, useEffect, useRef } from "react";

const DISCIPLES: Record<string, {
  name: string;
  icon: string;
  title: string;
  titleEn: string;
  traits: string[];
  traitsEn: string[];
  description: string;
  descEn: string;
  verse: string;
}> = {
  peter: {
    name: "彼得 Peter",
    icon: "🪨",
    title: "磐石領袖",
    titleEn: "The Rock Leader",
    traits: ["大膽", "衝動", "熱情", "領導力"],
    traitsEn: ["Bold", "Impulsive", "Passionate", "Leadership"],
    description:
      "你天生就是一個領袖！像彼得一樣，你勇於站出來，敢說敢做，有時候衝太快會跌倒，但你總能爬起來。你的熱情能感染身邊的人，你是那個「我先來！」的人。",
    descEn:
      "You're a born leader! Like Peter, you step up boldly, speak your mind, and sometimes stumble — but you always get back up. Your passion is contagious.",
    verse: "馬太福音 16:18「你是彼得，我要把我的教會建造在這磐石上。」",
  },
  andrew: {
    name: "安得烈 Andrew",
    icon: "🤝",
    title: "牽線人",
    titleEn: "The Connector",
    traits: ["樂於助人", "低調", "善於連結", "主動"],
    traitsEn: ["Helpful", "Humble", "Connector", "Proactive"],
    description:
      "你是那個默默把人帶到對的地方的人。安得烈第一件事就是去找他哥哥彼得來見耶穌。你不需要聚光燈，但沒有你，很多美好的事不會發生。",
    descEn:
      "You quietly bring people to the right place. Andrew's first act was bringing Peter to Jesus. You don't need the spotlight, but without you, great things wouldn't happen.",
    verse: "約翰福音 1:41「他先找著自己的哥哥西門，對他說：我們遇見彌賽亞了。」",
  },
  james: {
    name: "雅各 James",
    icon: "⚡",
    title: "雷霆戰士",
    titleEn: "Son of Thunder",
    traits: ["堅定", "有野心", "全力以赴", "忠誠"],
    traitsEn: ["Determined", "Ambitious", "All-in", "Loyal"],
    description:
      "你做事全力以赴，要麼不做，做了就做到底。雅各是「雷子」之一，性格火爆但超有行動力。你是團隊裡那個說「我們上吧！」的人。",
    descEn:
      "You go all-in or not at all. James was a 'Son of Thunder' — fierce but incredibly action-oriented. You're the one who says 'Let's go!' in any team.",
    verse: "馬可福音 10:39「耶穌說：我所喝的杯，你們也要喝。」",
  },
  john: {
    name: "約翰 John",
    icon: "❤️",
    title: "愛的門徒",
    titleEn: "The Beloved Disciple",
    traits: ["深思", "感性", "親密", "洞察力"],
    traitsEn: ["Deep Thinker", "Emotional", "Intimate", "Insightful"],
    description:
      "你是一個內心世界很豐富的人。像約翰一樣，你重視深度關係，你的觀察力超強，別人看表面，你看到本質。你是那個在最後晚餐靠在耶穌旁邊的人。",
    descEn:
      "You have a rich inner world. Like John, you value deep relationships and see beneath the surface. You're the one who leans in close and truly understands.",
    verse: "約翰福音 13:23「有一個門徒，是耶穌所愛的，側身挨近耶穌的懷裡。」",
  },
  philip: {
    name: "腓力 Philip",
    icon: "🔍",
    title: "理性探索者",
    titleEn: "The Analytical Explorer",
    traits: ["理性", "好問", "務實", "跨文化"],
    traitsEn: ["Rational", "Curious", "Practical", "Cross-cultural"],
    description:
      "你喜歡問「為什麼」和「怎麼做」。腓力總是在思考實際問題——五千人怎麼吃飽？你是理性派，但你的提問推動了大家更深入思考。",
    descEn:
      "You love asking 'why' and 'how.' Philip always thought practically — how to feed 5,000? You're the rational one whose questions push everyone deeper.",
    verse: "約翰福音 6:7「腓力回答說：就是二十兩銀子的餅，叫他們各人吃一點也是不夠的。」",
  },
  nathanael: {
    name: "拿但業 Nathanael",
    icon: "💎",
    title: "真誠無偽者",
    titleEn: "The Authentic Soul",
    traits: ["真誠", "正直", "直言", "純粹"],
    traitsEn: ["Sincere", "Upright", "Outspoken", "Pure"],
    description:
      "你是「所見即所得」的人。拿但業被耶穌稱讚是「心裡沒有詭詐的」。你不會演戲，你說真話、做真事。有時候太直接，但大家都信任你。",
    descEn:
      "What you see is what you get. Jesus praised Nathanael as one 'in whom there is no deceit.' You speak truth, act real, and earn deep trust.",
    verse: "約翰福音 1:47「耶穌看見拿但業來，就指著他說：看哪，這是個真以色列人，他心裡是沒有詭詐的。」",
  },
  matthew: {
    name: "馬太 Matthew",
    icon: "📊",
    title: "系統整理王",
    titleEn: "The Organizer",
    traits: ["細心", "有條理", "記錄者", "轉化者"],
    traitsEn: ["Detail-oriented", "Systematic", "Recorder", "Transformer"],
    description:
      "你超會整理和記錄！馬太從稅吏變成了福音書作者，他把耶穌的教導系統性地記下來。你是團隊裡的「資料庫」，什麼事問你就對了。",
    descEn:
      "You're amazing at organizing and recording! Matthew went from tax collector to Gospel writer. You're the team's 'database' — everyone comes to you for info.",
    verse: "馬太福音 9:9「耶穌從那裡往前走，看見一個人名叫馬太，坐在稅關上，就對他說：你跟從我來。他就起來跟從了耶穌。」",
  },
  thomas: {
    name: "多馬 Thomas",
    icon: "🧪",
    title: "求真者",
    titleEn: "The Truth Seeker",
    traits: ["懷疑精神", "求證", "勇敢", "深度信仰"],
    traitsEn: ["Skeptical", "Evidence-based", "Courageous", "Deep Faith"],
    description:
      "你不是「別人說什麼就信什麼」的人。多馬要親眼看見才相信，但一旦他確認了，他的信仰比誰都堅定。你的懷疑不是軟弱，是追求真理的勇氣。",
    descEn:
      "You don't just take things at face value. Thomas needed to see to believe, but once convinced, his faith was unshakeable. Your doubt is courage, not weakness.",
    verse: "約翰福音 20:28「多馬說：我的主！我的神！」",
  },
  jamesA: {
    name: "亞勒腓的兒子雅各 James (son of Alphaeus)",
    icon: "🌿",
    title: "沉穩守護者",
    titleEn: "The Steady Guardian",
    traits: ["忠實", "安靜", "堅持", "可靠"],
    traitsEn: ["Faithful", "Quiet", "Persistent", "Reliable"],
    description:
      "你是那個不需要被看見，但永遠在那裡的人。小雅各默默服事，忠心到底。你像一棵大樹，根扎得很深，風吹不倒。你的穩定就是你最大的力量。",
    descEn:
      "You don't need to be seen, but you're always there. James of Alphaeus served quietly and faithfully. Like a deep-rooted tree, you stand firm through every storm.",
    verse: "馬太福音 25:23「你在不多的事上有忠心，我要把許多事派你管理。」",
  },
  thaddaeus: {
    name: "達太 Thaddaeus",
    icon: "🔥",
    title: "心靈勇士",
    titleEn: "The Heart Warrior",
    traits: ["熱心", "有正義感", "關懷", "內在力量"],
    traitsEn: ["Zealous", "Justice-minded", "Caring", "Inner Strength"],
    description:
      "你心中有一把火，為了你在乎的事可以拼命。達太問過耶穌一個很深的問題：「為什麼只向我們顯現？」你是那個為公義和真理燃燒的人。",
    descEn:
      "There's a fire in your heart. Thaddaeus asked Jesus a deep question about revelation. You burn for justice and truth, driven by genuine care for others.",
    verse: "約翰福音 14:22「猶大問耶穌說：主啊，為什麼要向我們顯現，不向世人顯現呢？」",
  },
  simonZ: {
    name: "奮銳黨的西門 Simon the Zealot",
    icon: "⚔️",
    title: "改革行動家",
    titleEn: "The Activist",
    traits: ["行動派", "正義", "改革", "勇敢"],
    traitsEn: ["Action-oriented", "Justice", "Reform", "Brave"],
    description:
      "你是那個看到不對的事就要去改變的人！奮銳黨的西門原本是政治激進派，但耶穌把他的熱情導向了更高的使命。你是天生的改革者。",
    descEn:
      "You see injustice and act! Simon the Zealot was a political activist before Jesus redirected his passion to a higher mission. You're a natural reformer.",
    verse: "路加福音 6:15「奮銳黨的西門。」",
  },
  matthias: {
    name: "馬提亞 Matthias",
    icon: "🌟",
    title: "預備好的人",
    titleEn: "The Ready One",
    traits: ["預備", "忠心", "等候", "被揀選"],
    traitsEn: ["Prepared", "Faithful", "Patient", "Chosen"],
    description:
      "你一直在準備，等著那個對的時刻。馬提亞從頭到尾都跟隨耶穌，但直到最後才被揀選成為十二使徒之一。你的等候不是浪費，是累積。",
    descEn:
      "You've been preparing all along, waiting for the right moment. Matthias followed Jesus from the start but was chosen last. Your waiting is not wasted — it's building.",
    verse: "使徒行傳 1:26「於是眾人搖籤，搖出馬提亞來；他就和十一個使徒同列。」",
  },
};

const QUESTIONS = [
  {
    q: "朋友聚會時，你通常是...",
    qEn: "At a gathering, you're usually...",
    options: [
      { text: "主動帶大家玩、炒熱氣氛", scores: { peter: 3, james: 2, simonZ: 1 } },
      { text: "默默觀察，偶爾說一句很深的話", scores: { john: 3, jamesA: 2, nathanael: 1 } },
      { text: "負責把新朋友介紹給大家認識", scores: { andrew: 3, philip: 2, matthias: 1 } },
      { text: "在角落整理照片或做紀錄", scores: { matthew: 3, thomas: 1, thaddaeus: 1 } },
    ],
  },
  {
    q: "面對一個你不確定的決定，你會...",
    qEn: "Facing an uncertain decision, you would...",
    options: [
      { text: "先做再說！做錯了再調整", scores: { peter: 3, james: 2, simonZ: 1 } },
      { text: "搜集資料、分析利弊再決定", scores: { philip: 3, thomas: 2, matthew: 1 } },
      { text: "問信任的人的意見", scores: { andrew: 2, thaddaeus: 2, matthias: 2 } },
      { text: "安靜等候，相信時候到了就會知道", scores: { jamesA: 3, matthias: 2, john: 1 } },
    ],
  },
  {
    q: "看到社會上不公義的事，你的第一反應是...",
    qEn: "Seeing injustice in society, your first reaction is...",
    options: [
      { text: "馬上行動！發文、連署、上街", scores: { simonZ: 3, james: 2, peter: 1 } },
      { text: "深入研究問題的根源", scores: { thomas: 3, philip: 2, matthew: 1 } },
      { text: "先關心受害者的感受", scores: { john: 2, thaddaeus: 3, andrew: 1 } },
      { text: "在自己的崗位上默默做該做的事", scores: { jamesA: 3, matthias: 2, nathanael: 1 } },
    ],
  },
  {
    q: "你最享受的工作模式是...",
    qEn: "Your favorite work mode is...",
    options: [
      { text: "帶領團隊衝刺目標", scores: { peter: 3, james: 2, simonZ: 1 } },
      { text: "獨自深度研究和創作", scores: { john: 3, thomas: 2, matthew: 1 } },
      { text: "跟不同的人合作交流", scores: { andrew: 2, philip: 3, thaddaeus: 1 } },
      { text: "把混亂的東西整理成有條理的系統", scores: { matthew: 3, jamesA: 1, matthias: 2 } },
    ],
  },
  {
    q: "有人對你分享一個聽起來太好的消息，你會...",
    qEn: "Someone shares news that sounds too good to be true...",
    options: [
      { text: "太棒了！我相信！馬上行動", scores: { peter: 3, james: 1, andrew: 2 } },
      { text: "嗯...讓我先查證一下", scores: { thomas: 3, philip: 2, matthew: 1 } },
      { text: "觀察對方的表情和動機", scores: { john: 2, nathanael: 3, jamesA: 1 } },
      { text: "不管真假，先關心分享這消息的人", scores: { thaddaeus: 3, andrew: 1, matthias: 2 } },
    ],
  },
  {
    q: "你在團隊中最常被稱讚的是...",
    qEn: "In a team, you're most praised for...",
    options: [
      { text: "勇氣和決斷力", scores: { peter: 3, simonZ: 2, james: 1 } },
      { text: "真誠和值得信賴", scores: { nathanael: 3, jamesA: 2, matthias: 1 } },
      { text: "創意和深度思考", scores: { john: 3, thomas: 2, philip: 1 } },
      { text: "細心和組織能力", scores: { matthew: 3, andrew: 1, thaddaeus: 1 } },
    ],
  },
  {
    q: "壓力很大的時候，你會...",
    qEn: "When under heavy pressure, you...",
    options: [
      { text: "找人傾訴，需要被理解", scores: { john: 3, thaddaeus: 2, andrew: 1 } },
      { text: "一個人安靜消化，不想被打擾", scores: { jamesA: 3, matthias: 2, thomas: 1 } },
      { text: "化壓力為動力，做更多事", scores: { peter: 2, james: 3, simonZ: 1 } },
      { text: "開始列清單，把事情拆解成小步驟", scores: { matthew: 3, philip: 2, nathanael: 1 } },
    ],
  },
  {
    q: "你最認同的一句話是...",
    qEn: "The quote you resonate with most...",
    options: [
      { text: "「與其等待完美時機，不如創造時機。」", scores: { peter: 2, simonZ: 3, james: 1 } },
      { text: "「真正的智慧來自於承認自己不知道。」", scores: { thomas: 3, philip: 2, john: 1 } },
      { text: "「一個人走得快，一群人走得遠。」", scores: { andrew: 3, thaddaeus: 2, matthias: 1 } },
      { text: "「忠於小事的人，才能被託付大事。」", scores: { jamesA: 3, matthew: 2, nathanael: 1 } },
    ],
  },
  {
    q: "如果可以選擇一種超能力...",
    qEn: "If you could choose one superpower...",
    options: [
      { text: "讀心術——了解每個人真正在想什麼", scores: { john: 3, nathanael: 2, thaddaeus: 1 } },
      { text: "時間暫停——有更多時間研究和準備", scores: { thomas: 2, matthew: 2, matthias: 3 } },
      { text: "瞬間移動——把對的人帶到對的地方", scores: { andrew: 3, philip: 2, simonZ: 1 } },
      { text: "無限勇氣——面對任何困難都不怕", scores: { peter: 2, james: 3, simonZ: 1 } },
    ],
  },
  {
    q: "你覺得最重要的品格是...",
    qEn: "The most important virtue to you is...",
    options: [
      { text: "勇氣——敢做別人不敢做的事", scores: { peter: 2, simonZ: 2, james: 3 } },
      { text: "真實——永遠做真正的自己", scores: { nathanael: 3, thomas: 2, john: 1 } },
      { text: "忠心——在小事上也不放棄", scores: { jamesA: 3, matthias: 2, matthew: 1 } },
      { text: "愛心——讓每個人感受到被在乎", scores: { john: 2, andrew: 2, thaddaeus: 3 } },
    ],
  },
];

interface QuizResults {
  primary: [string, number];
  secondary: [string, number][];
  sorted: [string, number][];
  maxScore: number;
  totalPoints: number;
}

export default function DiscipleQuiz() {
  const [phase, setPhase] = useState<"intro" | "quiz" | "result">("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [fadeIn, setFadeIn] = useState(true);
  const [results, setResults] = useState<QuizResults | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFadeIn(true);
  }, [phase, currentQ]);

  const handleStart = () => {
    setScores({});
    setCurrentQ(0);
    setSelected(null);
    setPhase("quiz");
  };

  const handleSelect = (optionIdx: number) => {
    if (selected !== null) return;
    setSelected(optionIdx);
    const option = QUESTIONS[currentQ].options[optionIdx];
    const newScores = { ...scores };
    Object.entries(option.scores).forEach(([key, val]) => {
      newScores[key] = (newScores[key] || 0) + val;
    });
    setScores(newScores);

    setTimeout(() => {
      setFadeIn(false);
      setTimeout(() => {
        if (currentQ < QUESTIONS.length - 1) {
          setCurrentQ(currentQ + 1);
          setSelected(null);
        } else {
          computeResults(newScores);
          setPhase("result");
        }
        setFadeIn(true);
      }, 300);
    }, 500);
  };

  const computeResults = (finalScores: Record<string, number>) => {
    const sorted = Object.entries(finalScores).sort((a, b) => b[1] - a[1]) as [string, number][];
    const maxScore = sorted[0][1];
    const primary = sorted[0];
    const secondary = sorted.slice(1, 3);
    const totalPoints = sorted.reduce((sum, [, v]) => sum + v, 0);
    setResults({ primary, secondary, sorted, maxScore, totalPoints });
  };

  const getBarWidth = (score: number) => {
    if (!results) return 0;
    return Math.round((score / results.maxScore) * 100);
  };

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: "100vh",
        background: "linear-gradient(170deg, #1a1207 0%, #2d1f0e 30%, #1a1510 100%)",
        color: "#f5e6c8",
        fontFamily: "'Noto Serif TC', 'Georgia', serif",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600;700;900&family=Cinzel:wght@400;600;700&display=swap');

        .gold-text {
          background: linear-gradient(135deg, #d4a44a 0%, #f5d98a 40%, #d4a44a 60%, #a67c2e 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .dq-fade-in {
          animation: dqFadeSlideIn 0.5s ease forwards;
        }

        .dq-fade-out {
          animation: dqFadeSlideOut 0.3s ease forwards;
        }

        @keyframes dqFadeSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes dqFadeSlideOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-20px); }
        }

        @keyframes dqBarGrow {
          from { width: 0%; }
        }

        @keyframes dqResultFadeIn {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .dq-option-btn {
          width: 100%;
          padding: 16px 20px;
          background: rgba(212, 164, 74, 0.06);
          border: 1px solid rgba(212, 164, 74, 0.2);
          border-radius: 12px;
          color: #f5e6c8;
          font-size: 16px;
          font-family: 'Noto Serif TC', Georgia, serif;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: left;
          line-height: 1.6;
        }

        .dq-option-btn:hover:not(.dq-selected):not(.dq-disabled) {
          background: rgba(212, 164, 74, 0.15);
          border-color: rgba(212, 164, 74, 0.5);
          transform: translateX(6px);
          box-shadow: 0 0 20px rgba(212, 164, 74, 0.1);
        }

        .dq-option-btn.dq-selected {
          background: rgba(212, 164, 74, 0.2);
          border-color: #d4a44a;
          box-shadow: 0 0 30px rgba(212, 164, 74, 0.15);
        }

        .dq-option-btn.dq-disabled {
          opacity: 0.4;
          cursor: default;
        }

        .dq-start-btn {
          display: inline-block;
          padding: 16px 48px;
          background: linear-gradient(135deg, #d4a44a, #a67c2e);
          border: none;
          border-radius: 50px;
          color: #1a1207;
          font-size: 20px;
          font-weight: 700;
          font-family: 'Noto Serif TC', Georgia, serif;
          cursor: pointer;
          transition: all 0.3s ease;
          letter-spacing: 2px;
        }

        .dq-start-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(212, 164, 74, 0.4);
        }

        .dq-progress-track {
          height: 3px;
          background: rgba(212, 164, 74, 0.1);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 40px;
        }

        .dq-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #a67c2e, #d4a44a, #f5d98a);
          border-radius: 3px;
          transition: width 0.5s ease;
        }

        .dq-result-card {
          background: rgba(212, 164, 74, 0.06);
          border: 1px solid rgba(212, 164, 74, 0.2);
          border-radius: 20px;
          padding: 32px;
          animation: dqResultFadeIn 0.8s ease forwards;
        }

        .dq-score-bar-track {
          height: 6px;
          background: rgba(255,255,255,0.06);
          border-radius: 6px;
          overflow: hidden;
        }

        .dq-score-bar-fill {
          height: 100%;
          border-radius: 6px;
          animation: dqBarGrow 1s ease forwards;
        }

        .dq-texture-overlay {
          position: fixed;
          inset: 0;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 0;
        }

        .dq-content-wrapper {
          position: relative;
          z-index: 1;
          max-width: 640px;
          margin: 0 auto;
          padding: 40px 24px;
        }

        .dq-cross-deco {
          font-family: 'Cinzel', serif;
          color: rgba(212, 164, 74, 0.3);
          font-size: 14px;
          letter-spacing: 8px;
          text-align: center;
        }

        .dq-restart-btn {
          padding: 12px 36px;
          background: transparent;
          border: 1px solid rgba(212, 164, 74, 0.4);
          border-radius: 50px;
          color: #d4a44a;
          font-size: 16px;
          font-family: 'Noto Serif TC', Georgia, serif;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .dq-restart-btn:hover {
          background: rgba(212, 164, 74, 0.1);
          border-color: #d4a44a;
        }

        .dq-share-section {
          margin-top: 24px;
          padding: 20px;
          background: rgba(212, 164, 74, 0.04);
          border-radius: 12px;
          border: 1px dashed rgba(212, 164, 74, 0.15);
          text-align: center;
        }
      `}</style>

      <div className="dq-texture-overlay" />

      <div className="dq-content-wrapper">
        {/* ====== INTRO ====== */}
        {phase === "intro" && (
          <div className="dq-fade-in" style={{ textAlign: "center", paddingTop: "10vh" }}>
            <div className="dq-cross-deco" style={{ marginBottom: 24 }}>
              ✦ ✦ ✦
            </div>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📜</div>
            <h1
              className="gold-text"
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: "clamp(28px, 5vw, 40px)",
                fontWeight: 700,
                lineHeight: 1.3,
                marginBottom: 12,
              }}
            >
              TWELVE
            </h1>
            <h2
              style={{
                fontSize: "clamp(20px, 4vw, 28px)",
                fontWeight: 700,
                marginBottom: 8,
                color: "#f5e6c8",
              }}
            >
              你是哪一位門徒？
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "rgba(245, 230, 200, 0.5)",
                fontFamily: "'Cinzel', serif",
                letterSpacing: 3,
                marginBottom: 32,
              }}
            >
              DISCIPLE PERSONALITY QUIZ
            </p>
            <p
              style={{
                fontSize: 16,
                lineHeight: 2,
                color: "rgba(245, 230, 200, 0.7)",
                marginBottom: 48,
                maxWidth: 420,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              透過 10 道情境題，
              <br />
              發現你的人格特質最像耶穌的哪一位門徒。
              <br />
              <span style={{ fontSize: 14, opacity: 0.6 }}>
                每個門徒都有獨特的恩賜與使命。
              </span>
            </p>
            <button className="dq-start-btn" onClick={handleStart}>
              開始測驗
            </button>
            <div className="dq-cross-deco" style={{ marginTop: 48 }}>
              ✝
            </div>
          </div>
        )}

        {/* ====== QUIZ ====== */}
        {phase === "quiz" && (
          <div>
            <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 13,
                  color: "rgba(212, 164, 74, 0.6)",
                  letterSpacing: 2,
                }}
              >
                QUESTION {currentQ + 1} / {QUESTIONS.length}
              </span>
              <span style={{ fontSize: 13, color: "rgba(245,230,200,0.3)" }}>
                {Math.round(((currentQ + 1) / QUESTIONS.length) * 100)}%
              </span>
            </div>
            <div className="dq-progress-track">
              <div
                className="dq-progress-fill"
                style={{ width: `${((currentQ + 1) / QUESTIONS.length) * 100}%` }}
              />
            </div>

            <div className={fadeIn ? "dq-fade-in" : "dq-fade-out"} key={currentQ}>
              <h2
                style={{
                  fontSize: "clamp(20px, 4vw, 26px)",
                  fontWeight: 700,
                  lineHeight: 1.6,
                  marginBottom: 8,
                }}
              >
                {QUESTIONS[currentQ].q}
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "rgba(245,230,200,0.4)",
                  fontFamily: "'Cinzel', serif",
                  marginBottom: 28,
                  letterSpacing: 1,
                }}
              >
                {QUESTIONS[currentQ].qEn}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {QUESTIONS[currentQ].options.map((opt, idx) => (
                  <button
                    key={idx}
                    className={`dq-option-btn ${selected === idx ? "dq-selected" : ""} ${selected !== null && selected !== idx ? "dq-disabled" : ""}`}
                    onClick={() => handleSelect(idx)}
                  >
                    <span style={{ marginRight: 12, opacity: 0.5 }}>
                      {["A", "B", "C", "D"][idx]}.
                    </span>
                    {opt.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ====== RESULT ====== */}
        {phase === "result" && results && (
          <div className="dq-fade-in">
            <div className="dq-cross-deco" style={{ marginBottom: 24 }}>
              ✦ YOUR RESULT ✦
            </div>

            {/* Primary Result */}
            {(() => {
              const d = DISCIPLES[results.primary[0]];
              const pct = Math.round((results.primary[1] / results.totalPoints) * 100);
              return (
                <div className="dq-result-card" style={{ marginBottom: 24 }}>
                  <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <div style={{ fontSize: 56, marginBottom: 8 }}>{d.icon}</div>
                    <p
                      style={{
                        fontSize: 13,
                        color: "rgba(212,164,74,0.6)",
                        fontFamily: "'Cinzel', serif",
                        letterSpacing: 3,
                        marginBottom: 4,
                      }}
                    >
                      YOU ARE MOST LIKE
                    </p>
                    <h2
                      className="gold-text"
                      style={{
                        fontFamily: "'Cinzel', serif",
                        fontSize: "clamp(22px, 5vw, 32px)",
                        fontWeight: 700,
                        marginBottom: 4,
                      }}
                    >
                      {d.name}
                    </h2>
                    <p
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: "#d4a44a",
                        marginBottom: 4,
                      }}
                    >
                      {d.title}
                    </p>
                    <p
                      style={{
                        fontSize: 13,
                        color: "rgba(245,230,200,0.4)",
                        fontFamily: "'Cinzel', serif",
                      }}
                    >
                      {d.titleEn} · Match {pct}%
                    </p>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      justifyContent: "center",
                      marginBottom: 20,
                    }}
                  >
                    {d.traits.map((t, i) => (
                      <span
                        key={i}
                        style={{
                          padding: "4px 14px",
                          background: "rgba(212,164,74,0.1)",
                          borderRadius: 20,
                          fontSize: 13,
                          color: "#d4a44a",
                          border: "1px solid rgba(212,164,74,0.2)",
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <p
                    style={{
                      fontSize: 16,
                      lineHeight: 1.9,
                      color: "rgba(245,230,200,0.85)",
                      marginBottom: 16,
                    }}
                  >
                    {d.description}
                  </p>
                  <p
                    style={{
                      fontSize: 14,
                      lineHeight: 1.7,
                      color: "rgba(245,230,200,0.5)",
                      marginBottom: 20,
                    }}
                  >
                    {d.descEn}
                  </p>

                  <div
                    style={{
                      padding: "14px 18px",
                      background: "rgba(212,164,74,0.06)",
                      borderRadius: 10,
                      borderLeft: "3px solid rgba(212,164,74,0.4)",
                    }}
                  >
                    <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(245,230,200,0.6)" }}>
                      📖 {d.verse}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Secondary Matches */}
            <div style={{ marginBottom: 24 }}>
              <p
                style={{
                  fontSize: 13,
                  color: "rgba(212,164,74,0.5)",
                  fontFamily: "'Cinzel', serif",
                  letterSpacing: 2,
                  marginBottom: 16,
                }}
              >
                YOUR BLEND
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {results.secondary.map(([key, score], idx) => {
                  const d = DISCIPLES[key];
                  return (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "12px 16px",
                        background: "rgba(212,164,74,0.04)",
                        borderRadius: 12,
                        border: "1px solid rgba(212,164,74,0.1)",
                        animationDelay: `${0.3 + idx * 0.15}s`,
                        animation: "dqResultFadeIn 0.6s ease forwards",
                        opacity: 0,
                      }}
                    >
                      <span style={{ fontSize: 28 }}>{d.icon}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{d.name}</p>
                        <p style={{ fontSize: 12, color: "rgba(245,230,200,0.4)" }}>{d.title}</p>
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          color: "#d4a44a",
                          fontFamily: "'Cinzel', serif",
                        }}
                      >
                        {Math.round((score / results.totalPoints) * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Full Breakdown */}
            <div style={{ marginBottom: 32 }}>
              <p
                style={{
                  fontSize: 13,
                  color: "rgba(212,164,74,0.5)",
                  fontFamily: "'Cinzel', serif",
                  letterSpacing: 2,
                  marginBottom: 16,
                }}
              >
                FULL BREAKDOWN
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {results.sorted
                  .filter(([, s]) => s > 0)
                  .map(([key, score], idx) => {
                    const d = DISCIPLES[key];
                    return (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{d.icon}</span>
                        <span
                          style={{
                            fontSize: 13,
                            width: 60,
                            color: "rgba(245,230,200,0.5)",
                            flexShrink: 0,
                          }}
                        >
                          {d.name.split(" ")[0]}
                        </span>
                        <div className="dq-score-bar-track" style={{ flex: 1 }}>
                          <div
                            className="dq-score-bar-fill"
                            style={{
                              width: `${getBarWidth(score)}%`,
                              background: `linear-gradient(90deg, rgba(212,164,74,0.6), rgba(212,164,74,${0.2 + (getBarWidth(score) / 100) * 0.6}))`,
                              animationDelay: `${0.2 + idx * 0.08}s`,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            color: "rgba(245,230,200,0.35)",
                            width: 28,
                            textAlign: "right",
                          }}
                        >
                          {score}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="dq-share-section">
              <p style={{ fontSize: 14, color: "rgba(245,230,200,0.5)", marginBottom: 8 }}>
                🕊️ 每位門徒都有獨特的恩賜，你的組合就是你的使命。
              </p>
              <p style={{ fontSize: 12, color: "rgba(245,230,200,0.3)", fontFamily: "'Cinzel', serif" }}>
                Every disciple had a unique gift. Your blend is your mission.
              </p>
            </div>

            <div style={{ textAlign: "center", marginTop: 32, marginBottom: 40 }}>
              <button className="dq-restart-btn" onClick={handleStart}>
                再測一次 ✦ Retake
              </button>
            </div>

            <div className="dq-cross-deco">✝</div>
          </div>
        )}
      </div>
    </div>
  );
}
