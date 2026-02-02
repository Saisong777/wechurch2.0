# WeChurch - Bible Study & Prayer Platform

## Overview
WeChurch is a comprehensive Christian community platform migrated from Lovable/Supabase to Replit. It features Bible study sessions with group management, AI-powered study reports, prayer walls, icebreaker games, and message card sharing.

## Current State
- **Status**: Migrated from Lovable/Supabase to Replit
- **Database**: PostgreSQL with Drizzle ORM
- **Backend**: Express.js with API routes
- **Frontend**: React with Vite, React Router, TanStack Query, Shadcn UI
- **Styling**: Tailwind CSS with custom WeChurch theme (Sky Blue + Coral accents)

## Key Features
1. **We Live (靈魂健身房)** - Bible study sessions with group management
2. **We Learn (學習成長)** - Learning resources and materials
3. **We Play (破冰遊戲)** - Icebreaker card games for small groups
4. **We Share (分享)** - Prayer wall and message card sharing

## Project Architecture

### Directory Structure
```
├── server/              # Express backend
│   ├── index.ts        # Entry point
│   ├── routes.ts       # API routes
│   ├── storage.ts      # Database storage layer
│   ├── db.ts           # Database connection
│   └── vite.ts         # Vite dev server setup
├── shared/             # Shared types/schemas
│   └── schema.ts       # Drizzle database schema
├── src/                # React frontend
│   ├── components/     # UI components
│   ├── pages/          # Page components
│   ├── hooks/          # Custom hooks
│   ├── lib/            # Utilities
│   └── contexts/       # React contexts
└── public/             # Static assets
```

### Database Schema
The application uses PostgreSQL with the following main tables:
- `users` - User accounts and profiles
- `sessions` - Bible study sessions
- `participants` - Session participants
- `submissions` - Bible study submissions
- `ai_reports` - AI-generated study reports
- `study_responses` - Individual study responses
- `prayers` - Prayer wall entries
- `prayer_amens` / `prayer_comments` - Prayer interactions
- `icebreaker_games` / `icebreaker_players` - Game state
- `card_questions` - Icebreaker card questions
- `feature_toggles` - Feature flags
- `potential_members` - CRM tracking
- `message_cards` - Shareable message cards

### API Endpoints
- `GET/POST /api/sessions` - Session management
- `GET/POST /api/sessions/:sessionId/participants` - Participant management
- `GET/POST /api/sessions/:sessionId/submissions` - Submissions
- `GET/POST /api/sessions/:sessionId/reports` - AI reports
- `GET/POST /api/prayers` - Prayer wall
- `GET/PATCH /api/feature-toggles` - Feature flags
- `GET/POST /api/icebreaker/games` - Icebreaker games
- `GET/POST /api/message-cards` - Message cards

## Development

### Running the Application
```bash
npm run dev    # Start dev server (port 5000)
npm run build  # Build for production
npm run db:push # Push database schema
```

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-provisioned)
- `RESEND_API_KEY` - For email sending (optional)
- `LOVABLE_API_KEY` - For AI report generation (optional)

## Migration Notes
- Migrated from Supabase Edge Functions to Express routes
- Database schema converted from Supabase to Drizzle ORM
- Frontend still uses some Supabase client code (being migrated)
- Realtime features need alternative implementation

## Recent Changes
- 2026-02-02: Initial migration from Lovable to Replit
- Set up Express server with full-stack template
- Created Drizzle schema with all tables (20+ tables)
- Configured PostgreSQL database
- Fixed CSS import order for Google Fonts
- **Data Migration Completed**: Imported 1,170 records from Supabase CSV exports
- **Icebreaker Game Migration**: Fully migrated from Supabase to Express API
  - useIcebreakerGame hook converted to API calls with polling (3s intervals)
  - TurnBasedCardGame and IcebreakerGame components migrated
  - New API endpoints: /api/icebreaker/session-game, /api/icebreaker/games/:gameId/draw-card, /api/icebreaker/games/:gameId/reset
  - Card drawing now tracks usedCardIds to prevent repeat cards

### Data Migration Summary (2026-02-02)
| Table                   | Records |
|------------------------|---------|
| users                  | 106     |
| user_roles             | 106     |
| potential_members      | 117     |
| sessions               | 11      |
| study_responses        | 253     |
| ai_reports             | 72      |
| feature_toggles        | 7       |
| card_questions         | 52      |
| icebreaker_games       | 273     |
| message_cards          | 1       |
| message_card_downloads | 172     |
| **Total**              | **1,170**|

Note: Some tables (participants, submissions, prayers, prayer_amens, prayer_comments, prayer_notifications) were empty in the original Supabase export.

## User Preferences
- Interface language: Traditional Chinese (繁體中文)
- Theme: Sky Blue primary + Coral accents
- Font: Nunito (headings) + Inter (body)
