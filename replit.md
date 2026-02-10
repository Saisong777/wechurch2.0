# WeChurch - Bible Study & Community Platform

## Overview

WeChurch is a comprehensive Christian community platform designed to foster community engagement through Bible study, prayer sharing, and small group interactions. It supports high-concurrency usage (500+ users) with real-time features like Bible study sessions, AI-powered study reports, interactive prayer walls, icebreaker games, and message card sharing. The project aims to provide a robust, scalable, and engaging platform for Christian communities.

The platform is a full-stack TypeScript application, utilizing React for the frontend, Express.js for the backend, and PostgreSQL with Drizzle ORM for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, built with Vite.
- **Routing**: React Router DOM.
- **State Management**: TanStack Query for server state, React Context for local state.
- **UI**: Shadcn/UI (based on Radix UI) styled with Tailwind CSS (Sky Blue primary, Coral/Peach accents).
- **Content Editor**: TipTap for rich text.
- **Performance**: Lazy loading for all page components.

### Backend
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript.
- **API**: RESTful endpoints (`/api/*`).
- **Authentication**: Session-based with Replit Auth integration, supporting registered users and guests.
- **File Uploads**: Multer for image uploads.

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM for type-safe schema and migrations.
- **Key Tables**: `users`, `sessions`, `participants`, `study_responses`, `ai_reports`, `prayers`, `icebreaker_games`, `grouping_activities`, `message_cards`, `feature_toggles`, `user_reading_plans`, `password_reset_tokens`.

### Core Features
- **Prayer Wall**: Supports prayer sharing, categorization, anonymous posting, scripture references, and interactive features like 'Amen' and comments.
- **Prayer Meeting**: Facilitates group prayer sessions with short codes, QR codes, flexible grouping, anonymous prayer submission, and a PPT presentation mode for leaders.
- **Random Grouper ("神的安排")**: Enables leaders to create temporary, code-based grouping activities with real-time participant updates and privacy-focused data handling.
- **Personal Reading Plans**: Allows users to create custom Bible reading plans, track progress, and utilize features like audio auto-read (TTS) and devotional notes based on a 7-step spiritual fitness format. Includes browser notification reminders.
- **Scripture Sharing System**: Unified system for displaying and sharing scripture, including a `ScriptureCardCreator` for generating customizable image cards (uses fixed-pixel rendering at 400px width with CSS transform scaling for preview, clones node for html2canvas capture), a `FloatingToolbar` for text selection actions, `ClickableVerse` for single verses, and `ScriptureViewer` for multi-verse passages. All scripture displays must include copy/share/card functionality.
- **Bible Reading UX**: Mobile search minimization (icon button expands to search bar), 3-level font size adjustment (小/中/大 persisted to localStorage `wechurch-bible-font-size`), prev/next chapter navigation (crosses book boundaries), list/paragraph display mode toggle.
- **Universal Devotional Notes**: Reusable `DevotionalNoteDialog` component (7-step spiritual fitness format) available on all scripture displays (BiblePage, JesusTimeline, ClickableVerse, ReadingPlans). Notes can be standalone (by verse reference) or tied to reading plans. Supports editing by note ID or by verse reference lookup. Backend: `GET /api/devotional-notes/by-reference`, `GET /api/devotional-notes/:id`. In JesusTimeline, supports both event-level notes and selected-verse notes via ScriptureViewer's `onNoteForSelected` callback.
- **Devotional Notes AI Analysis**: AI-powered analysis of devotional notes using structured prompts in `server/prompts/devotional-analysis.ts`. Two modes: (1) Single-note analysis (`POST /api/devotional-notes/analyze`) reformats one note into standardized 7-section output, (2) Multi-note batch analysis (`POST /api/devotional-notes/analyze-batch`) aggregates multiple notes by date range into integrated summary with shared themes, tag distribution, highlights, and action consolidation. Frontend: "AI 整理分析" button in DevotionalNoteDialog, "AI 整合分析" button on ReadingPlansPage with DevotionalAnalysisBatchDialog for date range selection. Rules: truthfulness-first (no fabrication), highlight preservation with source attribution, tag-based output (Promise/Command/Warning/Knowledge of God), and spiritually respectful tone.
- **Universal Scripture TTS**: Reusable `ScriptureTTS` component with Chinese voice selection (filters `zh-*` voices from SpeechSynthesis API), voice preference persisted to localStorage (`wechurch-tts-voice`). Integrated into BiblePage FloatingToolbar, JesusTimeline ScriptureDisplay (including selected-verse TTS via `onReadSelected`), ClickableVerse, and ReadingExperiencePage (with voice selector dropdown).
- **Reading Reminder Simulation**: `ReadingReminderPopup` component (`src/components/reading/ReadingReminderPopup.tsx`) with `useReminderSimulation` hook. Provides a test popup with greeting, today's reading summary, TTS playback, and navigation to reading page. Test triggers on ReadingPlansPage for morning/noon/evening time slots.

### High-Concurrency Design
- Optimized for 500+ concurrent users with staggered requests, exponential backoff, extended polling, debounced auto-save, and non-blocking operations.
- **Merged Poll Endpoint**: `GET /api/sessions/:id/poll` combines session + participants + submissions into a single HTTP request, reducing per-poll requests from 3 to 1. Supports `phase`, `groupNumber`, and `v` (version hash) query params.
- **Version-Based 304**: Poll endpoint returns a version hash based on actual data state (participant groupNumbers, readyConfirmed, submission IDs). Clients send `v` param; if data unchanged, server returns 304 Not Modified (zero body transfer).
- **Phase-Aware Polling**: `useRealtimeSecure` and `useRealtime` hooks accept a `phase` parameter (`waiting`/`grouping`/`studying`/`all`) to skip unnecessary data. Waiting phase fetches session only; grouping adds participants; studying adds submissions.
- **Group-Scoped Data**: `useRealtimeSecure` accepts `groupNumber` param, so users only download their group's 4-5 participants instead of all 500+.
- **Polling Intervals**: Uses `HIGH_CONCURRENCY_CONFIG` from `retry-utils.ts` (8s base interval with 0-2s random jitter) instead of hardcoded 3-5s intervals, staggering client requests.
- **Server-Side Cache**: `SessionCache` in `server/cache.ts` caches poll responses for 2 seconds, with automatic invalidation on mutations (session updates, participant changes, submissions).
- **Database Indexes**: `idx_participants_session_id`, `idx_participants_session_group`, `idx_submissions_session_id`, `idx_study_responses_session_user`, `idx_ai_reports_session` for fast queries.
- **Efficient Comparisons**: Field-by-field comparison (groupNumber, readyConfirmed, status, verseReference) instead of JSON.stringify for change detection in polling hooks.
- **Optimized Queries**: `getStudyResponses` uses LEFT JOIN instead of N+1 separate queries for participants/users.
- **Database**: Connection pool with max 50 connections, min 10 idle.
- **Caching**: In-memory caching for Bible data and timeline events (1 hour), session poll cache (2s TTL), prayer wall cache (3s TTL), feature toggles cache (30s TTL).
- **Response Compression**: gzip compression via `compression` middleware for all API responses.
- **Rate Limiting**: In-memory per-client rate limiter (200 req/min) with automatic cleanup, returns 429 when exceeded.
- **Prayer Wall Polling**: 10s interval + 0-2s random jitter (was 5s hardcoded).
- **Prayer Notification Polling**: 30s for unread count, 60s for full list (was 15s/30s).
- **Feature Toggle Polling**: 120s interval (rarely changes).
- **Health Monitoring**: `GET /api/health` returns pool stats, memory usage, and cache stats.

### Responsive Design
- Standardized responsive patterns with consistent horizontal padding, progressive content max-widths, and responsive navigation (bottom bar on mobile, top bar on tablet/desktop).
- Specific optimizations for iPad breakpoints.

### Feature Toggle System
- Centralized feature management via a `feature_toggles` database table.
- Enables/disables features without code changes using `useFeatureToggles()` hook and `<FeatureGate>` component.
- Supports hierarchical feature dependencies (e.g., `we_live` parent controlling `bible_study` and `notebook` children).

## External Dependencies

### Database
- **PostgreSQL**: Primary database.
- **Drizzle ORM**: Database toolkit.

### Authentication
- **Replit Auth**: Primary authentication (Google, GitHub, Apple, email/password) with session storage.
- **Express Session**: Session management.

### Email Service
- **Resend**: Transactional email via Replit connector, from `noreply@wechurch.online`.

### Third-Party Integrations
- **OpenAI/AI Services**: For AI report generation.
- **api.qrserver.com**: For QR code generation.

### Frontend Libraries
- **TanStack Query**: Server state management.
- **Radix UI**: UI primitives.
- **TipTap**: Rich text editor.
- **Sonner**: Toast notifications.
- **Zod**: Schema validation.