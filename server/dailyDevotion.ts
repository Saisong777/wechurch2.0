export interface DailyDevotionBrief {
  id: string;
  date: string;
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

const DEFAULT_MORNING_BRIEF_URL = "https://wechurch-daily-devotion-api-production.up.railway.app/morning-brief";
const CACHE_TTL_MS = 10 * 60 * 1000;
const briefCache = new Map<string, { expiresAt: number; data: DailyDevotionBrief }>();
const FALLBACK_STARTED_AT = "2026-05-14";
const FALLBACK_READINGS = [
  {
    id: "church-reading-love-god-neighbor",
    scriptureReference: "馬太福音 22:37-39",
    devotionalTitle: "從愛神開始，也走向愛人",
    devotionalText: "耶穌把律法的重心收束在愛裡：先讓全人回到神面前，再把這份愛帶進與人的關係。今天先問自己，哪一件事可以更真實地愛神，也更具體地愛一個人。",
    previewVerses: [
      { verse: 37, text: "耶穌對他說：「你要盡心、盡性、盡意愛主你的神。」" },
      { verse: 38, text: "這是誡命中的第一，且是最大的。" },
      { verse: 39, text: "其次也相倣，就是要愛人如己。" },
    ],
  },
  {
    id: "church-reading-abide",
    scriptureReference: "約翰福音 15:4-5",
    devotionalTitle: "先住在主裡",
    devotionalText: "枝子不是靠焦慮結果子，而是因為連在葡萄樹上。今天先停留在主裡，讓行動從連結出發。",
    previewVerses: [
      { verse: 4, text: "你們要常在我裡面，我也常在你們裡面。" },
      { verse: 5, text: "我是葡萄樹，你們是枝子；常在我裡面的，我也常在他裡面，這人就多結果子。" },
    ],
  },
  {
    id: "church-reading-mercy",
    scriptureReference: "彌迦書 6:8",
    devotionalTitle: "行公義，好憐憫，謙卑同行",
    devotionalText: "神喜悅的生命不是宗教表現的堆疊，而是在日常中活出公義、憐憫與謙卑。今天可以留意一個具體場景，少一點自我中心，多一點同行。",
    previewVerses: [
      { verse: 8, text: "世人哪，耶和華已指示你何為善。他向你所要的是什麼呢？只要你行公義，好憐憫，存謙卑的心，與你的神同行。" },
    ],
  },
  {
    id: "church-reading-peace",
    scriptureReference: "腓立比書 4:6-7",
    devotionalTitle: "把掛慮帶到神面前",
    devotionalText: "保羅不是叫我們假裝沒有掛慮，而是把掛慮轉成禱告。今天把一件壓在心上的事向神說，並在感謝中等候祂的平安。",
    previewVerses: [
      { verse: 6, text: "應當一無掛慮，只要凡事藉著禱告、祈求，和感謝，將你們所要的告訴神。" },
      { verse: 7, text: "神所賜、出人意外的平安必在基督耶穌裡保守你們的心懷意念。" },
    ],
  },
  {
    id: "church-reading-one-another",
    scriptureReference: "希伯來書 10:24-25",
    devotionalTitle: "彼此相顧，激發愛心",
    devotionalText: "信仰不是孤單維持的計畫，而是彼此相顧的生活。今天想起一個人，主動問候、鼓勵或代禱。",
    previewVerses: [
      { verse: 24, text: "又要彼此相顧，激發愛心，勉勵行善。" },
      { verse: 25, text: "你們不可停止聚會，好像那些停止慣了的人，倒要彼此勸勉。" },
    ],
  },
  {
    id: "church-reading-new-mercies",
    scriptureReference: "耶利米哀歌 3:22-23",
    devotionalTitle: "每天早晨新的憐憫",
    devotionalText: "神的慈愛不是昨天用完就沒有的資源。新的早晨，祂仍以憐憫托住我們，也使我們能用柔軟的心面對自己與別人。",
    previewVerses: [
      { verse: 22, text: "我們不致消滅，是出於耶和華諸般的慈愛；是因他的憐憫不致斷絕。" },
      { verse: 23, text: "每早晨，這都是新的；你的誠實極其廣大！" },
    ],
  },
  {
    id: "church-reading-good-shepherd",
    scriptureReference: "詩篇 23:1-3",
    devotionalTitle: "讓主重新牧養我",
    devotionalText: "大衛不是說自己沒有缺乏感，而是宣告耶和華是他的牧者。今天把疲倦、分心與不安交在主面前，讓祂使你甦醒。",
    previewVerses: [
      { verse: 1, text: "耶和華是我的牧者，我必不致缺乏。" },
      { verse: 2, text: "他使我躺臥在青草地上，領我在可安歇的水邊。" },
      { verse: 3, text: "他使我的靈魂甦醒，為自己的名引導我走義路。" },
    ],
  },
];

function taipeiDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayNumberFromDate(date: string) {
  const start = new Date(`${FALLBACK_STARTED_AT}T00:00:00+08:00`).getTime();
  const current = new Date(`${date}T00:00:00+08:00`).getTime();
  if (Number.isNaN(current)) return 1;
  return Math.max(1, Math.floor((current - start) / 86400000) + 1);
}

export function buildFallbackDailyDevotionBrief(date = taipeiDateString()): DailyDevotionBrief {
  const dayNumber = dayNumberFromDate(date);
  const reading = FALLBACK_READINGS[(dayNumber - 1) % FALLBACK_READINGS.length];
  return {
    ...reading,
    id: `${reading.id}-${date}`,
    date,
    planName: "教會每日讀經",
    dayNumber,
    headline: reading.scriptureReference,
    focus: reading.devotionalTitle,
    keyVerse: reading.previewVerses[0]?.text,
    prayer: "主啊，讓我今天先回到你面前，從被你愛開始去愛人。",
    loveAction: "今天主動關心一個人，用一句真誠的問候開始。",
    sourceLabel: "Local fallback reading",
    sourceStatus: "fallback",
  };
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function stripTags(value: string) {
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h1|h2|h3|li|section)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

function extractFirst(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  return match ? stripTags(match[1]) : "";
}

function extractSection(html: string, className: string) {
  const pattern = new RegExp(`<section class="${className}">([\\s\\S]*?)<\\/section>`, "i");
  const match = html.match(pattern);
  return match ? match[1] : "";
}

function extractDivByClass(html: string, className: string) {
  const pattern = new RegExp(`<div class="${className}">([\\s\\S]*?)<\\/div>`, "i");
  const match = html.match(pattern);
  return match ? match[1] : "";
}

function parseDevotionalBlocks(sectionHtml: string) {
  const blocks = new Map<string, string>();
  const pattern = /<div class="devotional-block">\s*<h3 class="devotional-heading">([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sectionHtml))) {
    blocks.set(stripTags(match[1]), stripTags(match[2]));
  }
  return blocks;
}

function parseScripture(scriptureHtml: string) {
  return stripTags(scriptureHtml)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^(\d+:\d+|\d+)\s+(.+)$/);
      if (!match) return { verse: index + 1, text: line };
      return { verse: index + 1, text: `${match[1]} ${match[2]}` };
    });
}

function parseListItems(sectionHtml: string) {
  const items: string[] = [];
  const pattern = /<li>[\s\S]*?<span class="mark">[\s\S]*?<\/span>\s*<span>([\s\S]*?)<\/span>[\s\S]*?<\/li>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sectionHtml))) {
    items.push(stripTags(match[1]));
  }
  return items;
}

function parseStartupSteps(sectionHtml: string) {
  const steps: Array<{ label: string; text: string }> = [];
  const pattern = /<div class="step">\s*<strong>([\s\S]*?)<\/strong>\s*<span class="muted">([\s\S]*?)<\/span>\s*<\/div>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sectionHtml))) {
    steps.push({ label: stripTags(match[1]), text: stripTags(match[2]) });
  }
  return steps;
}

export function parseMorningBriefHtml(html: string, requestedDate: string): DailyDevotionBrief {
  const headline = extractFirst(html, /<h1>([\s\S]*?)<\/h1>/i);
  const subtitle = extractFirst(html, /<p class="subtitle">([\s\S]*?)<\/p>/i);
  const [datePart, scriptureReference = "", themesText = ""] = subtitle
    .split("·")
    .map((part) => part.trim());
  const devotionSection = extractSection(html, "devotion");
  const devotionalBlocks = parseDevotionalBlocks(devotionSection);
  const devotionalTitle = extractFirst(devotionSection, /<h3>([\s\S]*?)<\/h3>/i);
  const keyVerse = extractFirst(devotionSection, /<div class="verse">([\s\S]*?)<\/div>/i);
  const focus = devotionalBlocks.get("今日重點") || devotionalTitle;
  const devotionalText = devotionalBlocks.get("真理導航")
    || [...devotionalBlocks.values()].join("\n\n")
    || focus;
  const scriptureHtml = extractDivByClass(devotionSection, "scripture");
  const sourceLine = extractFirst(html, /<footer>([\s\S]*?)<\/footer>/i);
  const statusMatch = sourceLine.match(/Status:\s*([^·]+)/i);
  const rowMatch = sourceLine.match(/row\s+(\d+)/i);
  const date = datePart || requestedDate;

  return {
    id: `morning-brief-${date}`,
    date,
    planName: "WeChurch 每日靈修",
    dayNumber: rowMatch ? Number(rowMatch[1]) : 1,
    scriptureReference,
    devotionalTitle: devotionalTitle || headline || "今日靈修",
    devotionalText,
    previewVerses: parseScripture(scriptureHtml),
    headline,
    themes: themesText ? themesText.split(/[，,]/).map((theme) => theme.trim()).filter(Boolean) : [],
    keyVerse,
    focus,
    prayer: extractFirst(extractSection(html, "love-god"), /<p>([\s\S]*?)<\/p>/i),
    loveAction: extractFirst(extractSection(html, "love-people"), /<p>([\s\S]*?)<\/p>/i),
    workCommands: parseListItems(extractSection(html, "command")),
    startupSteps: parseStartupSteps(extractSection(html, "flow")),
    sourceLabel: sourceLine,
    sourceStatus: statusMatch?.[1]?.trim(),
  };
}

export async function fetchDailyDevotionBrief(date = taipeiDateString()): Promise<DailyDevotionBrief> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD.");
  }

  const cached = briefCache.get(date);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const baseUrl = process.env.MORNING_BRIEF_API_URL || DEFAULT_MORNING_BRIEF_URL;
  const url = new URL(baseUrl);
  url.searchParams.set("date", date);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "text/html,text/plain;q=0.9,*/*;q=0.8" },
    });
    if (!response.ok) {
      throw new Error(`Morning brief request failed: ${response.status}`);
    }

    const html = await response.text();
    const data = {
      ...parseMorningBriefHtml(html, date),
      sourceUrl: url.toString(),
    };
    briefCache.set(date, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } finally {
    clearTimeout(timeout);
  }
}
