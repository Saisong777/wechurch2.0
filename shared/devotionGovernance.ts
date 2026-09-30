import { devotionDate, devotionFields, shiftDevotionDate, type DevotionEntry, type DevotionInput } from './churchDevotion';

export function devotionGaps(entries: DevotionEntry[], from: string, to: string) {
  if (!devotionDate.safeParse(from).success || !devotionDate.safeParse(to).success || from > to) return [];
  const byDate = new Map(entries.map(entry => [entry.date, entry]));
  const gaps: Array<{ date: string; status: 'missing' | 'draft' }> = [];
  for (let day = from, count = 0; day <= to && count < 366; count++) {
    const entry = byDate.get(day);
    if (!entry || entry.status !== 'published') gaps.push({ date: day, status: entry ? 'draft' : 'missing' });
    if (day === to) break;
    day = shiftDevotionDate(day, 1);
  }
  return gaps;
}

export function devotionChanges(before: DevotionInput, after: DevotionInput) {
  return devotionFields.filter(field => before[field.key] !== after[field.key]).map(field => ({
    key: field.key, label: field.label, before: String(before[field.key]), after: String(after[field.key]),
  }));
}
