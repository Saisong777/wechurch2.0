import type { DevotionEntry } from '../shared/churchDevotion';
import type { DailyDevotionBrief } from './dailyDevotion';

export function managedDevotionBrief(date: string, entry: DevotionEntry | null): DailyDevotionBrief {
  if (!entry) return {
    id: `church-schedule-unpublished-${date}`, date, planName: '教會每日靈修', dayNumber: 0,
    scriptureReference: '', devotionalTitle: '這一天的靈修尚未發佈', devotionalText: '', previewVerses: [],
    sourceStatus: 'unpublished', sourceLabel: '教會靈修課表',
  };
  return {
    id: entry.id, date: entry.date, planName: entry.planName, dayNumber: entry.dayNumber,
    scriptureReference: entry.scriptureReference, scriptureText: entry.scriptureText,
    devotionalTitle: entry.devotionalTitle, devotionalText: entry.devotionalText,
    prayer: entry.prayer, loveAction: entry.loveAction, previewVerses: [],
    headline: entry.devotionalTitle, sourceStatus: 'church-schedule', sourceLabel: '教會靈修課表',
  };
}
