export const releaseFlags = {
  pastoral: 'pastoral_beta',
  serving: 'serving_beta',
  facilities: 'facilities_beta',
  framework: 'framework_beta',
  lineLogin: 'line_login_beta',
  dailyDevotion: 'daily_devotion_beta',
} as const;

export type ReleaseFlag = (typeof releaseFlags)[keyof typeof releaseFlags];
