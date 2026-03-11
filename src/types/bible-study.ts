export interface User {
  id: string;
  name: string;
  email: string;
  gender: 'male' | 'female';
  groupNumber?: number;
  joinedAt: Date;
  location: string;
  readyConfirmed: boolean;
}

export interface Session {
  id: string;
  shortCode?: string;
  bibleVerse: string;
  verseReference: string;
  status: 'waiting' | 'grouping' | 'verification' | 'studying' | 'completed';
  createdAt: Date;
  groups: Group[];
  allowLatecomers?: boolean;
  icebreakerEnabled?: boolean;
  icebreakerLevel?: 'L1' | 'L2' | 'L3';
}

export interface Group {
  id: string;
  number: number;
  members: User[];
}

export interface StudySubmission {
  id: string;
  sessionId: string;
  userId: string;
  groupNumber: number;
  name: string;
  email: string;
  bibleVerse: string;
  theme: string;
  movingVerse: string;
  factsDiscovered: string;
  traditionalExegesis: string;
  inspirationFromGod: string;
  applicationInLife: string;
  others: string;
  submittedAt: Date;
}

export interface GroupingSettings {
  minSize: number;
  maxSize: number;
  method: 'random' | 'gender-balanced' | 'gender-separated';
}
