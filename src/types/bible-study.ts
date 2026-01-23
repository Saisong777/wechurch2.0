export interface User {
  id: string;
  name: string;
  email: string;
  gender: 'male' | 'female';
  groupNumber?: number;
  joinedAt: Date;
}

export interface Session {
  id: string;
  bibleVerse: string;
  verseReference: string;
  status: 'waiting' | 'grouping' | 'studying' | 'completed';
  createdAt: Date;
  groups: Group[];
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
  groupSize: number;
  method: 'random' | 'gender-balanced';
}
