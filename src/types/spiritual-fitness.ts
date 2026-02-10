// Spiritual Fitness 7-Step Study Response Types

export type InsightCategory = 'PROMISE' | 'COMMAND' | 'WARNING' | 'GOD_ATTRIBUTE';

export interface StudyResponse {
  id: string;
  sessionId: string;
  userId: string;
  
  titlePhrase: string | null;
  heartbeatVerse: string | null;
  observation: string | null;
  
  coreInsightCategory: string | null;
  coreInsightNote: string | null;
  scholarsNote: string | null;
  
  actionPlan: string | null;
  coolDownNote: string | null;
  
  hidden?: boolean;
  createdAt: string;
  updatedAt: string;

  // snake_case aliases for backward compat
  session_id?: string;
  user_id?: string;
  title_phrase?: string | null;
  heartbeat_verse?: string | null;
  core_insight_category?: string | null;
  core_insight_note?: string | null;
  scholars_note?: string | null;
  action_plan?: string | null;
  cool_down_note?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StudyResponseFormData {
  title_phrase: string;
  heartbeat_verse: string;
  observation: string;
  core_insight_category: InsightCategory[];
  core_insight_note: Record<string, string>;
  scholars_note: string;
  action_plan: string;
  cool_down_note: string;
}

export type ProgressStatus = 'not_started' | 'warming_up' | 'heavy_lifting' | 'stretching';

export interface StudyResponsePublic extends StudyResponse {
  participant_name: string | null;
  group_number: number | null;
  email: null; // Always masked
  progress_status: ProgressStatus;
}

export const INSIGHT_CATEGORIES: { value: InsightCategory; label: string; emoji: string; description: string }[] = [
  { value: 'PROMISE', label: '應許', emoji: '✨', description: 'Promise' },
  { value: 'COMMAND', label: '命令', emoji: '📣', description: 'Command' },
  { value: 'WARNING', label: '警戒', emoji: '🛑', description: 'Warning' },
  { value: 'GOD_ATTRIBUTE', label: '認識神', emoji: '👑', description: 'God' },
];

export const getProgressStatusLabel = (status: ProgressStatus): { label: string; labelEn: string; color: string } => {
  switch (status) {
    case 'warming_up':
      return { label: '暖身中', labelEn: 'Warming Up', color: 'text-green-600' };
    case 'heavy_lifting':
      return { label: '重訓中', labelEn: 'Heavy Lifting', color: 'text-yellow-600' };
    case 'stretching':
      return { label: '收操中', labelEn: 'Cooling Down', color: 'text-blue-600' };
    default:
      return { label: '尚未開始', labelEn: 'Not Started', color: 'text-muted-foreground' };
  }
};

export const emptyFormData: StudyResponseFormData = {
  title_phrase: '',
  heartbeat_verse: '',
  observation: '',
  core_insight_category: [],
  core_insight_note: {},
  scholars_note: '',
  action_plan: '',
  cool_down_note: '',
};

export function parseCategories(raw: string | null): InsightCategory[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  if (['PROMISE', 'COMMAND', 'WARNING', 'GOD_ATTRIBUTE'].includes(raw)) {
    return [raw as InsightCategory];
  }
  return [];
}

export function parseNotes(raw: string | null, categories: InsightCategory[]): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {}
  if (categories.length > 0 && raw.trim()) {
    return { [categories[0]]: raw };
  }
  return {};
}

export function serializeCategories(cats: InsightCategory[]): string {
  return JSON.stringify(cats);
}

export function serializeNotes(notes: Record<string, string>): string {
  return JSON.stringify(notes);
}
