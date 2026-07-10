# WeChurch Product Log

## 2026-05-16 Daily Devotion Integration

### Current Status

We paused after integrating the external morning brief into the WeChurch daily devotion experience.

External source:
https://wechurch-daily-devotion-api-production.up.railway.app/morning-brief?date=2026-05-16

### Completed

- Added a backend parser/proxy for the morning brief API.
- Added `/api/church-reading/today?date=YYYY-MM-DD`.
- Converted the external HTML morning brief into app-friendly JSON.
- Connected the home page daily panel to the synced devotion data.
- Upgraded `/learn/church-reading` into a fuller daily devotion page.
- Added a "每日靈修" entry in `/learn`.
- Kept the existing built-in church reading content as fallback when the external API is unavailable.
- Added parser test coverage for the morning brief format.

### Daily Devotion Page Now Shows

- 今日標題
- 今日經文
- 今日重點
- 靈修短文
- 今日愛神
- 今日愛人
- 今日工作指令
- 7:00 啟動流程
- 寫靈修筆記
- 回看筆記

### Verified

- `npx tsc --noEmit`
- `npm test` passed: 23 tests
- `npm run build`
- `npm run lint` passed with existing warnings only
- `npm audit --audit-level=moderate`: 0 vulnerabilities
- Local API parsed 2026-05-16 successfully:
  - 23 scripture verses
  - 3 work commands
  - 5 startup steps
- Mobile smoke passed for:
  - `/learn/church-reading`
  - `/learn`
- Browser preview confirmed the page renders the 2026-05-16 devotion content.

### Files Touched For This Integration

- `server/dailyDevotion.ts`
- `server/dailyDevotion.test.ts`
- `server/routes.ts`
- `src/lib/churchReading.ts`
- `src/pages/ChurchReadingPage.tsx`
- `src/pages/Index.tsx`
- `src/pages/LearnPage.tsx`
- `vitest.config.ts`

### Important Note

The repository currently has many pre-existing uncommitted changes across the app. The daily devotion integration was built on top of that current working state and was not pushed yet.

### Next Product Direction

Continue refining WeChurch as a clearer, stronger church platform:

- Polish the daily devotion page for mobile reading comfort.
- Improve the home page daily panel so it feels like a calm daily command center.
- Make "每日靈修" flow naturally into notes, prayer, grace records, and care actions.
- Add better empty, loading, and API-failure states for daily devotion.
- Consider adding date navigation for previous and next daily devotion entries.
- Add sharing/export options for a daily devotion card.
- Continue simplifying navigation so first-time users know what to do without instruction.
- Review all mobile screens for tap size, spacing, and scroll rhythm.
- Keep strengthening SoulGym stability, AI summaries, and facilitator workflows.
