// Spiritual Fitness 7-Step Study Response Types

export type InsightCategory = 'PROMISE' | 'COMMAND' | 'WARNING' | 'GOD_ATTRIBUTE';

export interface StudyResponse {
  id: string;
  session_id: string;
  user_id: string;
  
  // Phase 1: Warm-up (Green) - 暖身
  title_phrase: string | null;      // 1. 定標題
  heartbeat_verse: string | null;   // 2. 抓心跳
  observation: string | null;       // 3. 看現場
  
  // Phase 2: Core Training (Yellow) - 重訓
  core_insight_category: InsightCategory | null;  // 4. 練核心 (類別)
  core_insight_note: string | null;               // 4. 練核心 (內容)
  scholars_note: string | null;                   // 5. 學長姐的話 (Open Book)
  
  // Phase 3: Stretch (Blue) - 伸展
  action_plan: string | null;       // 6. 帶一招
  cool_down_note: string | null;    // 7. 自由發揮
  
  created_at: string;
  updated_at: string;
}

export interface StudyResponseFormData {
  title_phrase: string;
  heartbeat_verse: string;
  observation: string;
  core_insight_category: InsightCategory | null;
  core_insight_note: string;
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
  core_insight_category: null,
  core_insight_note: '',
  scholars_note: '',
  action_plan: '',
  cool_down_note: '',
};
