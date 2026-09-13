import { formatScriptureText } from './scriptureDisplay';

export interface ChurchReadingSummary {
  id: string;
  date?: string;
  planName: string;
  dayNumber: number;
  scriptureReference: string;
  scriptureText?: string;
  scriptureStatus?: 'ready' | 'unavailable';
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

export function churchScripturePreview(reading: ChurchReadingSummary) {
  if (reading.previewVerses.length) return reading.previewVerses.slice(0, 2).map(verse => `${verse.verse} ${formatScriptureText(verse.text)}`).join('\n');
  return formatScriptureText(reading.scriptureText?.trim().split(/\n+/).slice(0, 2).join('\n') || '經文暫時無法載入');
}

// A loading placeholder must never invent the church's reading schedule.
export function getChurchReadingForToday(date = new Date()): ChurchReadingSummary {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  return {
    id: `church-schedule-unpublished-${day}`, date: day, planName: '教會每日靈修', dayNumber: 0,
    scriptureReference: '', devotionalTitle: '這一天的靈修尚未發佈', devotionalText: '', previewVerses: [],
    sourceStatus: 'unpublished', sourceLabel: '教會靈修課表',
  };
}

export async function fetchChurchReadingForToday(date?: string): Promise<ChurchReadingSummary> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const response = await fetch(`/api/church-reading/today${query}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch church daily devotion');
  }
  return response.json() as Promise<ChurchReadingSummary>;
}
