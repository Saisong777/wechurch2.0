export interface ChurchReadingSummary {
  id: string;
  date?: string;
  planName: string;
  dayNumber: number;
  scriptureReference: string;
  devotionalTitle: string;
  devotionalText: string;
  previewVerses: Array<{ verse: number; text: string }>;
  headline?: string;
  themes?: string[];
  keyVerse?: string;
  focus?: string;
  prayer?: string;
  loveAction?: string;
  workCommands?: string[];
  startupSteps?: Array<{ label: string; text: string }>;
  sourceLabel?: string;
  sourceStatus?: string;
  sourceUrl?: string;
}

const CHURCH_READING_STARTED_AT = '2026-05-14';

const CHURCH_DAILY_READINGS: ChurchReadingSummary[] = [
  {
    id: 'church-reading-love-god-neighbor',
    planName: '教會每日讀經',
    dayNumber: 1,
    scriptureReference: '馬太福音 22:37-39',
    devotionalTitle: '從愛神開始，也走向愛人',
    devotionalText: '耶穌把律法的重心收束在愛裡：先讓全人回到神面前，再把這份愛帶進與人的關係。今天讀這段經文時，不必急著完成什麼；先問自己，今天有哪一件事可以更真實地愛神，也更具體地愛一個人。',
    previewVerses: [
      { verse: 37, text: '耶穌對他說：「你要盡心、盡性、盡意愛主你的神。」' },
      { verse: 38, text: '這是誡命中的第一，且是最大的。' },
      { verse: 39, text: '其次也相倣，就是要愛人如己。' },
    ],
  },
  {
    id: 'church-reading-abide',
    planName: '教會每日讀經',
    dayNumber: 2,
    scriptureReference: '約翰福音 15:4-5',
    devotionalTitle: '先住在主裡',
    devotionalText: '枝子不是靠努力讓自己結果子，而是因為連在葡萄樹上。今天的靈修可以從一個簡單的停留開始：把心重新放在主裡，讓今天的行動不是從焦慮出發，而是從連結出發。',
    previewVerses: [
      { verse: 4, text: '你們要常在我裡面，我也常在你們裡面。枝子若不常在葡萄樹上，自己就不能結果子。' },
      { verse: 5, text: '我是葡萄樹，你們是枝子；常在我裡面的，我也常在他裡面，這人就多結果子。' },
    ],
  },
  {
    id: 'church-reading-mercy',
    planName: '教會每日讀經',
    dayNumber: 3,
    scriptureReference: '彌迦書 6:8',
    devotionalTitle: '行公義，好憐憫，謙卑同行',
    devotionalText: '神喜悅的生命不是宗教表現的堆疊，而是在日常中活出公義、憐憫與謙卑。今天可以留意一個具體場景：我可以在哪裡少一點自我中心，多一點憐憫與同行？',
    previewVerses: [
      { verse: 8, text: '世人哪，耶和華已指示你何為善。他向你所要的是什麼呢？只要你行公義，好憐憫，存謙卑的心，與你的神同行。' },
    ],
  },
  {
    id: 'church-reading-peace',
    planName: '教會每日讀經',
    dayNumber: 4,
    scriptureReference: '腓立比書 4:6-7',
    devotionalTitle: '把掛慮帶到神面前',
    devotionalText: '保羅不是叫我們假裝沒有掛慮，而是把掛慮轉成禱告。今天若有一件反覆壓在心上的事，可以不用整理得很漂亮，直接向神說，並在感謝中等候祂的平安保守你的心。',
    previewVerses: [
      { verse: 6, text: '應當一無掛慮，只要凡事藉著禱告、祈求，和感謝，將你們所要的告訴神。' },
      { verse: 7, text: '神所賜、出人意外的平安必在基督耶穌裡保守你們的心懷意念。' },
    ],
  },
  {
    id: 'church-reading-one-another',
    planName: '教會每日讀經',
    dayNumber: 5,
    scriptureReference: '希伯來書 10:24-25',
    devotionalTitle: '彼此相顧，激發愛心',
    devotionalText: '信仰不是孤單維持的計畫，而是彼此相顧的生活。今天可以想起一個人，主動問候、鼓勵或代禱，讓聚會之外的日常也成為教會彼此建造的地方。',
    previewVerses: [
      { verse: 24, text: '又要彼此相顧，激發愛心，勉勵行善。' },
      { verse: 25, text: '你們不可停止聚會，好像那些停止慣了的人，倒要彼此勸勉。' },
    ],
  },
  {
    id: 'church-reading-new-mercies',
    planName: '教會每日讀經',
    dayNumber: 6,
    scriptureReference: '耶利米哀歌 3:22-23',
    devotionalTitle: '每天早晨新的憐憫',
    devotionalText: '神的慈愛不是昨天用完就沒有的資源。新的早晨，祂仍以憐憫托住我們。今天可以先領受這份不靠表現換來的恩典，再用比較柔軟的心面對自己與別人。',
    previewVerses: [
      { verse: 22, text: '我們不致消滅，是出於耶和華諸般的慈愛；是因他的憐憫不致斷絕。' },
      { verse: 23, text: '每早晨，這都是新的；你的誠實極其廣大！' },
    ],
  },
  {
    id: 'church-reading-good-shepherd',
    planName: '教會每日讀經',
    dayNumber: 7,
    scriptureReference: '詩篇 23:1-3',
    devotionalTitle: '讓主重新牧養我',
    devotionalText: '大衛不是說自己沒有缺乏感，而是宣告耶和華是他的牧者。今天可以把疲倦、分心與不安交在主面前，讓祂使你躺臥、甦醒，也重新引導你走義路。',
    previewVerses: [
      { verse: 1, text: '耶和華是我的牧者，我必不致缺乏。' },
      { verse: 2, text: '他使我躺臥在青草地上，領我在可安歇的水邊。' },
      { verse: 3, text: '他使我的靈魂甦醒，為自己的名引導我走義路。' },
    ],
  },
];

export function getChurchReadingForToday(date = new Date()): ChurchReadingSummary {
  const start = new Date(`${CHURCH_READING_STARTED_AT}T00:00:00`);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const currentDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysSinceStart = Math.max(0, Math.floor((currentDay - startDay) / (1000 * 60 * 60 * 24)));
  const reading = CHURCH_DAILY_READINGS[daysSinceStart % CHURCH_DAILY_READINGS.length];

  return {
    ...reading,
    dayNumber: daysSinceStart + 1,
  };
}

export function getChurchReadingForDayNumber(dayNumber: number): ChurchReadingSummary {
  const normalizedDay = Math.max(1, dayNumber);
  const reading = CHURCH_DAILY_READINGS[(normalizedDay - 1) % CHURCH_DAILY_READINGS.length];

  return {
    ...reading,
    dayNumber: normalizedDay,
  };
}

export function getChurchReadingByReference(scriptureReference: string): ChurchReadingSummary | undefined {
  const readingIndex = CHURCH_DAILY_READINGS.findIndex(
    (reading) => reading.scriptureReference === scriptureReference,
  );
  if (readingIndex < 0) return undefined;

  return {
    ...CHURCH_DAILY_READINGS[readingIndex],
    dayNumber: readingIndex + 1,
  };
}

export async function fetchChurchReadingForToday(date?: string): Promise<ChurchReadingSummary> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const response = await fetch(`/api/church-reading/today${query}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch church daily devotion');
  }
  return response.json();
}
