# WeChurch - Bible Study & Community Platform

## Overview

WeChurch is a comprehensive Christian community platform designed for Bible study sessions, prayer sharing, and small group engagement. The application supports high-concurrency scenarios (500+ users) with features including real-time Bible study sessions with group management, AI-powered study reports, prayer walls, icebreaker games, and message card sharing.

The platform is built as a full-stack TypeScript application with a React frontend and Express backend, using PostgreSQL with Drizzle ORM for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **Routing**: React Router DOM for client-side navigation
- **State Management**: TanStack Query for server state, React Context for local state (AuthContext, SessionContext)
- **UI Components**: Shadcn/UI component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom WeChurch theme (Sky Blue primary, Coral/Peach secondary accents)
- **Rich Text**: TipTap editor for content creation
- **Code Splitting**: Lazy loading for all page components to improve initial load performance

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with tsx for development
- **API Design**: RESTful endpoints under `/api/*` prefix
- **Authentication**: Session-based auth with Replit Auth integration, supporting both registered users and guest participants
- **File Uploads**: Multer for handling message card image uploads

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit for schema migrations (`drizzle-kit push`)
- **Key Tables**:
  - `users` / `auth_users` - User accounts (dual table for Replit Auth compatibility)
  - `user_roles` - Role-based access control (member, leader, future_leader, admin)
  - `sessions` - Bible study sessions with status tracking
  - `participants` - Session participants with group assignments
  - `study_responses` - 7-step spiritual fitness study responses
  - `ai_reports` - AI-generated study summaries (group and overall)
  - `prayers` / `prayer_amens` / `prayer_comments` - Prayer wall interactions
  - `icebreaker_games` / `icebreaker_players` - Game state management
  - `grouping_activities` / `grouping_participants` - Random grouper with unique short codes
  - `message_cards` - Shareable image cards with download tracking

### Prayer Wall (禱告牆)
The prayer wall enables community prayer sharing with:
- **Three view modes**: All prayers, My prayers (user's own), Answered prayers (celebration view)
- **Category filtering**: Filter by thanksgiving, supplication, praise, or other
- **Answered prayer tracking**: Mark prayers as answered with celebration banner UI (emerald theme)
- **Scripture reference support**: Attach Bible verses to prayers when creating
- **Anonymous posting**: Option to post prayers anonymously
- **Pinned prayers**: Admin can pin important prayers to top
- **Amen/代禱**: React to prayers with amen support
- **Comments**: Comment thread on each prayer
- **Mobile optimized**: Horizontally scrollable tabs with 44px minimum touch targets

### Prayer Meeting (禱告會)
The prayer meeting feature allows leaders to create prayer sessions with grouping and AI-powered prayer classification:
- **4-digit short codes**: Each meeting has a unique code for easy joining
- **QR code generation**: Automatic QR codes for mobile scanning
- **Flexible grouping modes**: Group by size or by count, with gender separation options
- **Anonymous prayer option**: Users can submit both named and anonymous prayers with a single save button
- **AI Prayer Report Generation**: Uses GPT-4o-mini with "Church Prayer Secretary" role to generate comprehensive 4-section Markdown reports:
  - **(a) 個人/小組代禱摘要**: Summary of individual/group prayer requests
  - **(b) 分類代禱事項**: Categorized prayers with 12 categories (疾病醫治, 職場工作, 人際關係, 親子家庭, 婚姻關係, 財務供應, 學業考試, 信仰成長, 事工服事, 靈魂得救, 感恩讚美, 其他)
  - **(c) 匿名代禱牆**: Anonymized prayer wall for projection display
  - **(d) 緊急代禱事項**: Urgent prayers with reasons highlighted
- **Prayer Report Storage**: Full Markdown report stored in `prayerReport` field of prayerMeetings table
- **Dual View Modes**: Toggle between "報告檢視" (report view with formatted Markdown) and "列表檢視" (traditional list view)
- **Anonymous prayer classification**: Stored separately in `anonymousPrayerCategory` and `isAnonymousPrayerUrgent` fields
- **Urgent prayer detection**: AI detects:
  - Severe illness (cancer, hospitalization)
  - Death, near-death, suicide ideation
  - Emergency events (accidents, disasters)
  - Mental health crises (depression, anxiety, emotional breakdown)
  - Relationship crises (divorce, separation, affairs, abortion)
  - Severe financial crises (bankruptcy, unemployment, debt)
- **Pastoral Alerts**: Report includes ⚠️ section for content requiring pastoral attention (suicide, self-harm, criminal matters)
- **Prayer list view**: Categorized view with urgent prayers highlighted, filterable by group
- **Own prayer visibility**: Users see their own prayers highlighted in sky blue with "我" badge
- **Presentation mode**: Full-screen display for projecting prayer requests with keyboard navigation
- **Historical meetings**: View past prayer meetings with their prayers and classifications
- **Backend routes**:
  - POST `/api/prayer-meetings/:id/classify-prayers` - Generate AI prayer report (4-section Markdown stored in prayerReport field)
  - GET `/api/prayer-meetings/:id/prayer-list?group=X&mode=all` - Retrieve categorized prayer list (mode: all/named/anonymous)
  - GET `/api/prayer-meetings/history` - Retrieve closed/completed prayer meetings

### Random Grouper ("神的安排")
The random grouper feature allows leaders to create grouping activities with:
- **Unique 4-digit codes**: Each activity gets a unique short code (e.g., "A3B7") for easy sharing
- **QR code generation**: Automatic QR codes via api.qrserver.com for mobile scanning
- **Multiple concurrent activities**: Each leader can run independent activities simultaneously
- **Privacy-focused**: Activity data and participants are deleted when the activity is closed
- **Role-based access**: Only leader/future_leader/admin can create activities; all users can join with code
- **Real-time updates**: 3-second polling for participant lists during active sessions
- **Group display modes**:
  - Participants see only their own group with large colored group number and member list
  - Leaders see all groups with complete participant lists for verification
  - Groups distinguished by 8 distinct colors for easy identification
- **Activity deletion handling**: When leader closes activity, all participants are redirected to homepage with notification

### Scripture Sharing System
The app features unified scripture sharing components used across the platform. **RULE: All Bible scripture displays across the entire site must have copy/share/card functionality.**

Components:
- **ScriptureCardCreator**: Unified card creation modal used site-wide. Features:
  - 6 gradient background presets + custom image upload (max 5MB)
  - 4 aspect ratios: square, portrait (3:4), story (9:16), landscape (4:3)
  - 3 font sizes and 9 text positioning options (3x3 grid)
  - Personal message field
  - Mobile-optimized scrollable dialog with touch support
  - Smart download: opens image viewer on mobile (long-press to save), direct download on desktop
  - Loading states during image generation
  - Uses html2canvas for image generation
- **FloatingToolbar**: Appears near selected text with copy/share/card actions; fixed bottom bar on mobile (z-index 9999), floating near selection on desktop
- **ClickableVerse**: Single verse display with tap-to-share functionality for the homepage daily scripture
- **ScriptureViewer**: Multi-verse selection with floating toolbar for passage sharing; used in JesusTimelinePage

When adding new scripture displays:
1. Use `ClickableVerse` for single verses (e.g., daily verse)
2. Use `ScriptureViewer` for multi-verse passages (e.g., timeline events, study content)
3. Both components include copy, share, and card creation functionality
4. If inside a clickable parent container, ensure `e.stopPropagation()` is used on verse clicks
5. ScriptureCardCreator is the ONLY card creation component - do not create alternatives

### High-Concurrency Design
The application is optimized for 500+ concurrent users with:
- Staggered request initialization (random 0-1.5s delays)
- Exponential backoff with jitter for retries
- Extended polling intervals (5-10 seconds) to reduce server load
- Debounced auto-save (1.5 second delay)
- Non-blocking background operations
- **Database connection pool**: Configured with max 20 connections, min 5 idle connections
- **In-memory caching**: Bible data and timeline events cached for 1 hour
- **Health monitoring endpoints**: `/api/health`, `/api/health/detailed`, `/api/health/db`

### Directory Structure
```
├── server/              # Express backend
│   ├── index.ts         # Server entry point
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Database access layer (IStorage interface)
│   ├── db.ts            # Drizzle database connection
│   ├── vite.ts          # Vite dev server integration
│   └── resend.ts        # Email service integration
├── shared/              # Shared code between frontend/backend
│   ├── schema.ts        # Drizzle database schema
│   └── models/          # Shared type definitions
├── src/                 # React frontend
│   ├── components/      # UI components (admin/, user/, prayer/, icebreaker/, layout/, ui/)
│   ├── pages/           # Page components (lazy loaded)
│   ├── hooks/           # Custom React hooks
│   ├── contexts/        # React context providers
│   ├── lib/             # Utility functions
│   └── types/           # TypeScript type definitions
├── public/              # Static assets
└── migrations/          # Database migrations
```

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connected via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### Authentication
- **Replit Auth**: Primary authentication system with session storage in PostgreSQL
  - Supports Google, GitHub, Apple, and email/password login
  - Login page at `/login` with prominent "使用 Google 帳號繼續" button
  - Auth routes: `/api/login` (begin login), `/api/logout` (logout), `/api/auth/user` (get user)
- **Express Session**: Session management with `connect-pg-simple` for PostgreSQL session store

### Email Service
- **Resend**: Transactional email service for notifications, accessed via Replit connector
- **Domain**: Emails sent from `noreply@wechurch.online`

### Third-Party Integrations
- **OpenAI/AI Services**: Used for generating study reports (AI report generation)

### Frontend Libraries
- **TanStack Query**: Server state management with caching
- **Radix UI**: Accessible UI primitives
- **TipTap**: Rich text editor
- **Sonner**: Toast notifications
- **Zod**: Schema validation

### Development Tools
- **Vitest**: Unit testing framework
- **ESLint**: Code linting with TypeScript support
- **TypeScript**: Full type safety across frontend and backend