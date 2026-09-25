# WeChurch Together: Current Design Recipe

## Approved 2026-09-13
The three standing people mark is the approved identity. Runtime asset:
`public/wechurch-together.png`, displayed through `WeChurchLogo`.
Primary navigation: Today, Bible, Prayer, Sharing Walls, Groups.
Keep one sticky mobile header, Back / Home / Menu; no bottom navigation.
Personal records remain private unless explicitly shared. Existing role and
feature gates remain unchanged.

Use evergreen primary, darker coral action accent, neutral white reading surfaces;
tokens live in `src/index.css`. Controls default to at least 44px, card radius 8px.
Reading width 672px, body 18px/32px. Admin uses compact task-first lists.
No oversized explanation panels above content. Secondary help lives in disclosures.
See `design/ui-ux-refresh-2026-09-13.md` for scope and verification.
## Bible Integration Added 2026-09-25

Merge the supplied study reader into the existing `/learn/bible` and `/bible`
function, not a separate advanced-study destination. Keep the daily devotion
unchanged. Reuse the shared header, Together tokens and member authentication.
Scripture stays primary; comparison is two columns on desktop, paired blocks
on phones. Reference tools use a desktop side column and an explicit mobile
reading/reference switch. Inline verse actions remain reachable mid-chapter.
Cross references and dictionaries use bounded accessible dialogs; private notes
expand inline. Personal records remain separate from the read-only study DB.
See `design/bible-integration-2026-09-25.md` for scope and acceptance evidence.

## Appearance Added 2026-09-25

Default to light; offer explicit light, dark, and system choices through one
shared control. Store the preference per browser, not in the member record.
Desktop headers use a 44px icon menu; the existing mobile menu and personal
settings use a three-option segmented control. Do not add another navigation bar.
Dark mode uses neutral charcoal surfaces, mint primary, and coral accents.
Use semantic tokens for reading, forms, popovers, and management surfaces.
Keep QR canvases, photos, and exported media in their original colors.
See `design/appearance-2026-09-25.md` for B release evidence and limitations.

## Mobile Scroll and Appearance Repair 2026-09-25

Use document scrolling, not a viewport-height body with its own overflow:auto.
Horizontal clipping must not create another scroll container. The app shell owns
the small-viewport minimum; shared mobile pages must not add another viewport of
minimum height. Keep sticky navigation and native window-based Back restoration.
Place the labeled appearance selector first in the existing mobile menu:
明亮 / 深色 / 跟隨系統. No additional navigation bar or touch-scroll interception.
See `design/mobile-scroll-audit-2026-09-25.md` for scope and iOS acceptance limits.

## Daily Reader Added 2026-09-25

The daily devotion uses the scoped `church-reader` surface: a 672px reading
column, Scripture reference as the headline, compact date/day context and an
optional plan disclosure. Scripture, devotion and prayer are separate tabs;
the full passage opens by default, with the existing collapse preference kept.
Use 16-26px user-selected body type (20px default, line-height 1.9), retaining
fixed-size controls. Keep a note action before the content and next-step actions
after it. No second sticky bar or bottom navigation is introduced.

Inspiration: the user-selected iM Bible app's focused reading tabs and font
adjustment, translated into Together's existing tokens and brand. Explicit
line-start headings format imported prose; unknown prose remains complete.
Data, routes, sharing and note persistence are unchanged. Scope and evidence:
`design/reader-audit-2026-09-25.md`.

## Note Editor Added 2026-09-25

On `/learn/church-reading`, devotional writing now expands inline after the
reader in the same column. No portal, overlay, height lock, or nested scrolling
body. Opening focuses the heading without activating the keyboard. Private save
keeps the editor open; collapse preserves the unsaved-changes confirmation and
returns focus to its entry button. Save / Share remain at the end of the form.
See `design/inline-note-audit-2026-09-25.md` for this superseding reader layout.

Other note contexts retain a centered 800px dialog on desktop and a full-height
editor on phones, not a right sheet. Keep close in the top header and private
Save / Share in the bottom footer, outside the scrollable writing body. Sharing
requires choosing an own group or the public wall and confirming selected content;
the editor has no AI analysis action. Keep an optional scripture disclosure and unframed sections,
16px inputs and 44px controls. Retain local drafts, conflict recovery and explicit
share preview. Scoped styles must not change other dialogs or note storage.
See `design/note-sharing-audit-2026-09-25.md` for the latest actions, superseding
the top-save layout in `design/note-editor-audit-2026-09-25.md`.

The sections below are historical experiments, not current navigation or palette.

---

# WeChurch Dashboard DesignRecipe

## 2026-09-12 Site Navigation Update

Sai requires navigation to remain reachable midway through long reading. Mobile
uses one compact sticky top bar (Back, page title/Home, Menu), without bottom
navigation. The duplicate homepage logo/avatar row and shared page header are
hidden on mobile. Page actions such as Bible search and font size move into the
top menu through a shared portal; account settings and role-aware account actions
are available there too. Dedicated login/admin headers and desktop navigation
are unchanged. The B environment safety banner remains separate.

The primary four destinations remain Home, Bible, Prayer, Care. The dropdown
adds Group, Personal, and Tools; it is anchored below the bar without changing
document height, has a scrollable height limit, and closes on navigation,
outside press, or Escape. Shared navigation targets are at least 48px high.
Restore reading position on Back; preserve daily Scripture expansion in the
same history entry. Protect unsaved devotional, prayer, and personal care drafts.
Details and verification limits: `design/site-navigation-flow-2026-09-12.md`.

## 2026-09-12 Personal Navigation Update

User-approved product scope: primary navigation is Home, Bible, Prayer, Care.
SoulGym remains reachable from the personal management page, not the homepage
or primary navigation. Portal pages show one link per action and no explanatory
hero or moments panel. Care starts with the user's private list; forms open on
demand. Keep privacy notices, validation, empty/error states and confirmations.
No new visual reference or brand system was introduced. Verification and release:
`design/personal-navigation-care-2026-09-12.md`.

## Scope

This document records the Dashboard experiments at `/`. A and B are visual-only
style variants. C and D are `layout-safe` homepage variants that change the first
screen hierarchy while preserving routes, data fetching, local persistence,
authentication, existing feature entry points, and collapsible section behavior.

Observed staging surface: `https://wechurch-staging-staging.up.railway.app/`

## Existing UI audit

### Current design tokens

Source of truth: `src/index.css`.

| Role | Current value | Observed use |
|---|---|---|
| Background | `150 24% 98%` / `#F8FAF9` | app canvas |
| Foreground | `218 28% 18%` | headings and body ink |
| Primary | `218 40% 28%` | Scripture, active nav, primary emphasis |
| Secondary | `17 55% 53%` | prayer / care action emphasis |
| Accent | `162 50% 38%` | completion and supporting status |
| Muted | `155 18% 93%` | soft surfaces |
| Muted foreground | `214 12% 42%` | descriptions and metadata |
| Border | `160 14% 86%` | cards, dividers, inputs |
| Radius | `.5rem` | default controls and cards |
| Shadow | `--card-shadow` | restrained card elevation |
| Scripture surface | `#FBF8F1` | Scripture-only material |

### Shared components

- `src/components/layout/Header.tsx` — sticky header, navigation, profile menu.
- `src/components/ui/card.tsx` — card shell used by the two main Dashboard columns.
- `src/components/ui/button.tsx` — interaction and focus states.
- `src/components/ui/collapsible.tsx` — expandable Dashboard sections.
- `src/components/icons/WeChurchLogo.tsx` — brand mark.
- `src/pages/Index.tsx` — Dashboard composition, `HomeSection`, daily rhythm,
  Scripture, prayer, care, and entry cards.

### Current strengths

- The first screen already communicates a clear three-part rhythm: Scripture,
  prayer, and care.
- Scripture has its own paper-like surface and serif treatment.
- The implementation already includes keyboard focus styles and mobile-readable
  typography adjustments.

### Current opportunities

- The hero, two large cards, and entry cards use similar rounded/elevated chrome;
  hierarchy can be made more intentional without changing the information model.
- The visual language currently mixes soft shadows, tinted headers, and several
  gradient tokens even though the Dashboard does not need decorative energy.
- A/B comparison needs a stable token-level switch rather than duplicated page
  logic.

## StyleIndex directions

The 74-reference library was filtered to the pastoral/community brief:
warm, trustworthy, low-noise, mobile-first, and clear about today's next step.
Full reference passes used `airbnb`, `notion`, `stripe`, and `webflow`; only
abstract principles are carried forward.

### A — 日課 / Daily Office — implemented

Anchor traits: generous human spacing, workspace hierarchy, one distinct reading
material, restrained accent roles, and an obvious first action.

Good fit: keeps the existing pastoral warmth and makes the Scripture → prayer →
care sequence feel like a daily liturgy rather than a task list.

Mismatch warning: avoid marketplace photography, illustration language, product
copy, and recognizable brand color systems.

### B — 週報 / Bulletin — implemented

Anchor traits: near-monochrome structure, hairline rules, compact information
density, functional color, and strong alignment.

Good fit: gives leaders a durable working surface and makes live counts/statuses
easier to scan.

Mismatch warning: avoid turning a pastoral homepage into an admin console; keep
the Scripture material and human language.

### C — 陪伴 / Love God, Love People Companion — implemented

Anchor traits: essence-first hierarchy, warm time-of-day tint, fewer larger
surfaces, and a daily companion frame around loving God and loving people.

Good fit: this is the clearest match for the product north star: a daily
assistant that helps Christians practice the two greatest commandments.

Mismatch warning: avoid making the app feel like generic wellness software; keep
Scripture, prayer, care, and concrete people-oriented action visible.

### D — 晨光圖卡 / Illustrated Morning Companion — implemented

Anchor traits: original morning devotional artwork, an editorial first screen,
and the same essence-first companion card from C.

Good fit: adds emotional warmth and a stronger morning-opening ritual without
changing any product function.

Mismatch warning: the image must stay secondary to the daily essence. On mobile,
the artwork is capped as a short atmospheric banner so Scripture, `愛神`, and
`愛人` remain visible early.

## Project-owned DesignRecipe

Name: `WeChurch Daily Rhythm`

Intent: let a person understand today's spiritual rhythm within five seconds,
then enter the right existing flow without hunting.

Product north star: WeChurch is a daily companion for practicing `愛神、愛人`.
`愛神` means growing intimacy with God through daily Scripture and devotion.
`愛人` means building better relationships with people through weekly care and
prayer for real people, needs, and situations.

### Borrowed principles

```yaml
source_audit_trail:
  - source: notion
    borrowed: workspace hierarchy and calm surface grouping
    brand_sanitized: true
  - source: airbnb
    borrowed: generous spacing and human-scale action emphasis
    brand_sanitized: true
  - source: stripe
    borrowed: one primary action and disciplined semantic color roles
    brand_sanitized: true
  - source: webflow
    borrowed: alignment, hairline structure, and compact labels for status
    brand_sanitized: true
  - source: WeChurch
    borrowed: Scripture paper, Chinese serif, and the love-God/love-people model
    brand_sanitized: false
```

### Adjustable tokens

```yaml
tokens:
  background: '#F8FAF9'
  surface: '#FFFFFF'
  scripture_surface: '#FBF8F1'
  ink: '#222C3A'
  primary: '#2A3F63'
  prayer: '#C96A43'
  care: '#2F8A70'
  border: '#D7DFDA'
  radius_card: '8px'
  radius_status: '999px'
  shadow_card: '0 16px 48px -34px rgba(30, 58, 95, .42)'
  density: 'calm'
  scripture_font: 'Noto Serif TC / system serif'
```

## Variant implementation

The Dashboard reads a query parameter:

- A: `/?styleLab=1&dashboardVariant=a` — `日課 / Daily Office`; default when
  no variant is specified.
- B: `/?styleLab=1&dashboardVariant=b` — `週報 / Bulletin`.
- C: `/?styleLab=1&dashboardVariant=c` — `陪伴 / Love God, Love People
  Companion`.
- D: `/?styleLab=1&dashboardVariant=d` — `晨光圖卡 / Illustrated Morning
  Companion`.

The Style Lab switch is only visible when `styleLab=1` is present. A and B reuse
the same JSX and differ only through `data-dashboard-variant` and CSS
token/chrome overrides in `src/index.css`. C and D conditionally swap the hero's
right-side numbered rhythm into a single essence-first companion panel with the
same underlying data and existing destinations. D adds the project-owned image
asset at `public/images/morning-companion-hero.png`. C and D intentionally avoid
a second `愛神・愛人` summary block in the hero; detailed areas below are renamed
as `深入操練` and `實踐清單` so they read as follow-up work, not duplicate
summaries.

## QA checklist

- [x] Existing `/` Dashboard structure preserved.
- [x] Existing links and collapsible sections preserved.
- [x] A/B is token-level and query-selectable.
- [x] C is layout-safe, query-selectable, and keeps existing feature entry
  points while adding only redundant quick links to existing routes.
- [x] D is layout-safe, query-selectable, adds a project-owned morning image, and
  keeps the same required routes as C.
- [x] Brand references are abstracted; no raw brand colors, fonts, logos, or copy
  are passed into the implementation.
- [x] Verify A, B, C, and D on desktop and mobile against the local production build.
  Desktop was checked at 1280x720. Mobile was checked with Chrome DevTools
  emulation at 390x844. Static preview logs API JSON warnings because Vite
  preview has no app server/API; the live staging analysis was done separately
  against the Railway app.
- [ ] After review, choose one variant and remove or gate the Style Lab switch
  before production promotion.

## Daily Home Simplification (2026-09-11)

The default homepage now uses `DailyHome`: three unframed sections for daily
devotion, personal prayer, and personal care. The earlier A/B/C/D layouts above
remain available only with `styleLab=1`; they are historical experiments, not
the default page blueprint.

- One Scripture preview and a start/continue action appear in the first mobile
  viewport. Full reading and devotion remain at `/learn/church-reading`.
- Note editing, pending/blocked local drafts, and note history remain reachable.
- Show at most one personal prayer and one supplied care contact. No shared
  prayer content or sample people are inserted into the personal summary.
- Preserve the five navigation destinations. Tools and permitted host management
  are compact links, not additional module cards.
- Reuse existing typography/colors, 44px primary targets, wrapping action rows,
  and a constrained 768px reading column. No new imagery or shared token edits.
- QA: 390x844 and 1280x900 screenshots, plus 320x568 overflow/CTA check;
  76 tests passed. See `design/home-simplification-implementation-2026-09-11.md`.

## Church Devotion Administration (2026-09-11)

- `/admin/church-devotions` uses an unframed work-focused table with date, status,
  and title filters. Import/edit are dialogs, not dashboard cards.
- Sheet uploads and Google Sheets share column mapping, validation, preview,
  and explicit draft confirmation. Duplicate dates default to preserving data.
- Date swaps and shifts move the whole day's content; batch publication requires
  confirmation. Drafts do not appear as real published daily content.
- Reuse existing controls, typography, colors, and 8px-or-less table radius.
  Tables scroll internally on mobile; page width stays within the viewport.
- Verified desktop 1280x900 and mobile 390x844; implementation and limits are in
  `design/church-devotion-management-2026-09-11.md`.

## Small Group Life (2026-09-11)

- `/groups` reuses existing group identities with four compact tabs: reading,
  notes, prayer, and shared care. Keep the five bottom navigation destinations.
- Reading remains an unframed text column. Cards are only repeated posts or care
  contacts; controls reuse existing icons, inputs, checkboxes, and dialogs.
- Personal-to-group sharing requires explicit confirmation and shows the group
  name. Care has consent/anonymization confirmation and no automatic CRM copy.
- Date, responsible member, next action, status, watches, and history are visible
  without adding another dashboard. Conflicts preserve the current draft.
- Verified desktop 1280x900 and mobile 390x844; 320x568 prayer overflow check also
  passed. See `design/small-group-life-implementation-2026-09-11.md`.

## Personal Prayer Sharing (2026-09-11)

- Private records have selection checkboxes and a sticky selection action row.
  Preview only selected titles/prayers, never the private grace response.
- Audience, anonymity, and explicit consent are independent controls. Changing
  the audience or text resets consent; dialogs preserve drafts on errors.
- Existing group and public destinations appear next to each private record,
  with separate withdrawal controls. Public cards show full prayer text.
- Reuse existing typography, spacing, icons, and dialogs. No global theme edits.
- Verified 390x844 and 1280x900; public wall width checked at 320x568.
  See `design/personal-prayer-sharing-2026-09-11.md`.

## Public Prayer Interactions (2026-09-11)

Lifecycle update: completed prayers now leave the public feed and remain in
their owner's history. A separate daily devotion wall expires at Taiwan midnight.
Shared text stays separate from private notes. See `design/daily-public-walls-2026-09-11.md`.

- Urgency is a checkbox and badge, with active urgent prayers sorted first.
- Reactions use Lucide icons, accessible pressed state, counts, and undo.
- Expanded conversations are unframed, with a compact response-type menu,
  multiline input, and three fixed-size icon stickers. Preserve failed drafts.
- Anonymous authors stay anonymous in replies; collapsed posts fetch only counts.
- Verified 320x568, 390x844, and 1280x900. See
  `design/prayer-wall-interactions-2026-09-11.md` for evidence and limits.
