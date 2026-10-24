# WeChurch Handshake: Current Design Recipe

## Shared Reading Notes Updated 2026-10-16

The small-family reading view keeps Handshake A semantic tokens and the existing
672px reading column. Its 16–26px font control shares the daily reader's browser
preference and `church-reader` prose rules; navigation, forms, and buttons retain
their fixed sizes. Scripture, devotion, response prayer, and love action all follow
the selected reading size. No additional sticky navigation is introduced.

Writing opens inline below the reading, with 看見 / 領受 / 回應 preloaded from
the owner's private note for that date and reference. Each field has a separate
share choice. The preview contains only selected fields, followed by explicit
consent for the named small family. “儲存筆記並分享至小家” saves the complete
private note and selected public copy in one server transaction. The separate,
cancelable “同時標記已讀完這天進度” choice defaults on; independent read marking
remains available. Private notebooks and the earlier general share/source flows
remain reachable.

Drafts belong to the exact owner, church, small family, date, and devotion. Closing
or changing context preserves that draft without showing it in another context.
Transport failures and 5xx responses retain their immutable original attempt;
retries require an explicit click. Known 4xx rejections provide explicit draft
recovery through reloading and comparing the latest original. If private access
cannot be confirmed, preserve a selectable read-only draft and notebook link,
without offering submission. Conflicts require comparing the latest original
inline with the retained draft, and a new preview and audience consent. Tomorrow
remains read-only. This-day family insights appear below reading; “回看小家領受”
opens the existing paginated 亮光 history with its edit and withdrawal controls.

Implementation-mode checks cover component focus, scope isolation, cancellation,
failure/retry, conflict recovery, reading size, and preserved entry flows. These
program checks do not claim Railway B visual or real-device acceptance; 320,
390, and 1200px light/dark browser checks remain a separate release gate.

## Current product scope: SoulGym deferred 2026-09-28

SoulGym is reserved for a separate future project. Remove its member entries, study-note
category, activity hosting/history and participant/host steps from the current
app. Keep historical data; retired source is recoverable from Git history. Old participant links
return home; old notebooks lead to current personal notes. Keep independent Bible
study tools, daily devotion, groups and active administration. This supersedes
earlier sections retaining a personal SoulGym entry.
See `design/soulgym-deferred-2026-09-28.md`.

## System Records and AI Retirement 2026-09-28

No AI generation, note analysis, prayer classification, model SDK or report-export
UI is part of this release. Preserve historical database content, not active
model integrations. See `design/ai-retirement-2026-09-28.md`.

Administrator system records are collapsed by default and fetched only when
opened. Show bounded seven-day recorded event/error totals and recent error
locations/times, with an optional operation breakdown. Never infer platform
health, safety, actual user counts or product maturity from these counts. Failed
fetches must be labeled, not rendered as a healthy zero. Use unframed sections
and compact two-column totals rather than nested score cards.

## Handshake A Approved 2026-09-28

Sai selected the upright handclasp forming the center of a W, with no cross or
religious totem. Approved light palette: indigo `#293C65`, canvas `#F7F8FC`,
Scripture ivory `#FFF9EF`, ink `#202B40`, ochre `#93631F`. Dark mode adapts the
same semantic roles for readable contrast. This section supersedes historical
Together logo and evergreen/coral color descriptions below.

Assets: `public/wechurch-handshake.png` (transparent raster mark) and
`public/wechurch-handshake-app.png` (square app icon). Old assets remain for
rollback. Shared header, favicon, Apple touch icon, web manifest and reading
notification all use the new identity. The raster mark is not claimed to be an
SVG master. Dark headers display a white mark.

Homepage scope is layout-safe: compact date/title, one ivory Scripture surface,
a full-width primary reading action, separate note actions, open personal prayer
and care sections, then the existing community links. Do not replace real data
with mockup text, remove drafts/statuses or change requests, routing or privacy.
Keep the single sticky top navigation and all existing entry points.
See `design/handshake-a-home-2026-09-28.md` for acceptance and release evidence.


## Prayer Life Updated 2026-09-28

Private prayers use a compact 768px reading column, active/history filters and
inline editors with bottom actions. Keep the dated response history expandable.
Sharing is a deliberate preview with audience consent, never an implicit side
effect of saving. Completion may explicitly close the public copy, never publish
the private response. Retain separate wall navigation and semantic theme tokens.
See `design/prayer-module-2026-09-28.md` for scope and verification boundaries.

## Family Life Added 2026-09-28

Member-facing pastoral groups are named 小家. Keep existing `/groups` links and
identifiers. Use three onboarding choices (matching, directory, invitation) and
three family views (feed, shared reading, information). The feed is chronological,
with ordinary messages, prayer and Bible insights; compose inline, keep private
sources separate, and require sharing consent. CRM owns scoped assignment,
handover and transfer controls, not access to private journals. Keep Together's
44px controls, 8px item corners and semantic light/dark tokens. See
`design/families-2026-09-28.md` for authorization and migration boundaries.

## Historical identity approved 2026-09-13 (superseded by Handshake A)
The three standing people mark was the previous identity. Historical asset:
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

## Care And Pastoral Visits (2026-09-28)

- Extend Together with compact owner-only people rows and inline editors, not drawers.
- Keep next-care dates, chronological notes, archive/restore and small-family care distinct.
- Visits require an explicit share preview. Never copy personal care notes into pastoral requests.
- Same-church pastoral inbox sorts urgent requests first, supports assigned dates and visible progress.
- Homepage and CRM care show a polling reminder; this is not external push or emergency dispatch.
- See `design/care-workflow-2026-09-28.md` for privacy boundaries and verification.

## Grace Book (2026-09-28)

- Extend the approved Together recipe; private, single-column and inline editing.
- Grace book is a filtered owner-only record collection, not an additional public wall.
- Separate answered prayers from dated standalone stories. Ended prayers remain history.
- Reuse semantic light/dark colors, 44px controls, restrained repeated-item cards and
  explicit sharing preview. No new fixed navigation, nested scroll shell or AI action.
- See `design/grace-book-2026-09-28.md` for migration, privacy and acceptance evidence.

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
- Expanded conversations are unframed, with visible response-mode segments,
  multiline input, and three compact stickers on one row. Preserve failed drafts.
- Owner management stays in the card's overflow menu; destructive actions require
  confirmation. Composer appears before reply history, with a full-width submit.
- See `design/prayer-response-ux-2026-09-28.md` for the mobile response redesign.
- Mobile prayers now default to compact author/summary rows with three reactions;
  retain a 32px member avatar beside the name, with an anonymous icon for private identity.
  explicit expand reveals the unchanged details/actions without unmounting drafts.
  Desktop stays expanded. See `design/prayer-mobile-list-2026-09-28.md`.
- Anonymous authors stay anonymous in replies; collapsed posts fetch only counts.
- Verified 320x568, 390x844, and 1280x900. See
  `design/prayer-wall-interactions-2026-09-11.md` for evidence and limits.

## Mobile menu refinement 2026-09-28

Six everyday destinations use a two-column grid, with care completing the third row.
Keep existing routes and labels, page action portal and all permission checks.
Settings/tools are quieter secondary links; appearance stays visible below navigation.
Staff links have their own labelled section and logout remains a separate action.
Use semantic colors, 44px minimum controls and the existing bounded scroll panel.
See `design/mobile-menu-2026-09-28.md`.

## Simple Personal Care (2026-09-28)

The ordinary care record is one note plus an optional reminder. Show the latest
written record for continuity. Keep method classification and contact background
optional, reuse the A palette, and retain 44px targets in both themes. Existing
reminders remain visible and are only replaced or cancelled by explicit edits.
Historical agreements remain readable. See `design/simple-care-flow-2026-09-28.md`.

## Leader Overview Added 2026-09-28

`/work` opens with scoped pastoral status, with a leader shortcut on the daily
home and the same overview in CRM. Preserve Handshake A tokens and shared mobile
navigation. Three quiet summaries lead to concrete follow-up actions, without
spiritual scores or decorative charts. A gathering roster uses four explicit
states; unrecorded is never absence. Shared content retains its existing audience
and private records stay out of leader totals. See
`design/leader-dashboard-2026-09-28.md` for implementation boundaries.

## Castle portrait immersion (2026-10-24)

The iM castle is an explorable world. On portrait screens up to 640px wide, use
vertical space for a close view rather than fitting the entire island width.
The initial/reset camera keeps its established position and a 42° vertical field
of view, with a 5.5% downward composition offset. The island may extend beyond the
horizontal edges. Opening a sheet changes label occlusion, never camera scale;
resizing changes projection while preserving the user's zoom, orbit and target.
Desktop and landscape retain their existing fit and inset rules.

Use the castle's existing jade, ivory stone, coral and warm daylight palette,
serif brand heading and system UI type. A compact brand anchor, 46px exploration
and menu controls, a right-hand 44px camera rail and a short login/presence entry
leave the world dominant. The default portrait view has no large detail or status
card. Building selection opens the existing places sheet with its real route;
mode, night/pause, account, church, full presence and notices remain in the menu
sheet. Notices, drafts and connection failures have a visible badge/status entry;
the full explanation and retry/leave actions remain available there. Each slot
renders once. Sheets scroll internally and return focus when closed.

Reference audit trail: Root observed the supplied mobile policy-island reference
on 2026-10-24. Borrowed only close portrait composition, compact floating controls
and on-demand bottom sheets. No logo, identity, copy, code or reference assets are
used in the product. The existing iM Three geometry and access boundaries remain.

CPU projection predicts the real island geometry occupies about 66% of portrait
height at 390×844 and 320×568. This is a composition check, not visual acceptance.
Root must verify the same frozen release on B at both sizes, open/close both sheets,
check error/presence actions and 44px targets, then recheck landscape/desktop and
traditional-mode scroll. No localhost UI acceptance or author visual self-signoff.

## Castle content windows (2026-10-24)

Use the same existing data router and real lazy page definitions for the castle
background and the foreground content. On desktop the content is a centered
window with visible castle context; mobile uses an almost full-height sheet.
The window has a fixed 44px close/return header and its own scroll viewport.
Keep that viewport as an isolated fixed-position containing block so a page's
mobile selection toolbar stays below the window header; nested Radix portals
remain above it. Bible chapter changes and notebook reading positions use a
narrow viewport scroll context, with the original window scroll fallback for
ordinary pages. No global scroll monkeypatch or copied page content.

Castle navigation uses ordinary links and the original permission/feature gates.
Supported internal content routes inherit a successfully committed castle origin;
redirects, query changes and nested routes remain real URL entries. A bounded
50-entry tab registry remembers only history keys and whitelisted home UI mode,
never content, tokens, membership or arbitrary state. Marked reloads can restore
a new window instance; unmarked deep links remain ordinary pages. Refresh still
rebuilds WebGL and presence. Security/admin/external OAuth flows retain full-page
behavior. Closing pushes the safe complete origin URL through the existing
unsaved-change blocker. Back can reopen the last content entry; an explicit
full-page exit also traverses the blocker.

Keep the same castle DOM/scene/presence while a window is active and make its
background inert. Background Escape listeners stop, while the topmost Radix
Dialog/Select/AlertDialog owns Escape and focus. On successful opening only,
close the home editor/account UI that ordinary route departure would unmount;
blocked Stay must retain the draft and keep the window closed. Modal body locks
remain owned by Radix. The existing castle class owns only its own CSS.

Author CPU integration verifies committed navigation, one background mount,
redirects/params/query/Back/Forward/reload/explicit exit, dirty Stay/Discard,
nested Escape, focus and independent scroll. Root and independent QA must still
verify real page content, GPU state, fixed toolbars/portals and mobile layouts on
the same B release. No author UI self-signoff or localhost preview.


## Castle place content (2026-10-24 / v6)

Building/label activation directly opens the real destination in the existing same-router window. Ground movement, orbit and modified DOM links remain their original operations. A finite route metadata map supplies a place emblem, actual place and function title; no location/query values become display names or permission decisions.

The foreground alone provides CastleContentPresentationContext. The conventional Header becomes only its original rightContent business tools (Bible mobile search and A−/A+); logo, site navigation, back/account/appearance and ReadingNavigation are absent there. Traditional and background headers retain their original branch. Bible/reading/notes remain available from castle places/menu and real content links.

Material recipe: forest #174f49, ivory parchment #fffdf4, mint #c7e7de, gold #d8c58d, terracotta #bd6b4b. The place emblem, restrained serif function title and single 44px close control are the signature. Scoped foreground tokens carry the material into reading surfaces, local category tabs, forms and filters; destructive/validation colors keep their semantics. Scripture text keeps its existing font sizing and reading behavior. Mobile uses a near-full-height parchment sheet with its own scroll; viewport containing block and nested portal precedence stay intact.

The login window contains the original LoginForm and its errors/actions without marketing/brand/verse decoration. Options fetch, handlers, OAuth and return targets remain unchanged. No new data, permissions, backend or dependencies. Verify single activation/history push, foreground-only styling/tools, traditional restore, current-function naming, nested dialogs, dirty close/Back and first-layout scroll cleanup; final desktop/mobile/landscape appearance is verified on Railway B by the coordinator, not by CPU checks.


## 2026-10-24 · 十二門徒人格／相聚小亭

沿用 iM 城堡・地點內容配方：森林綠 #174f49、米白 #fffdf4、薄荷 #c7e7de、金 #d8c58d、陶土 #bd6b4b。標題沿既有 Noto Serif TC／Songti TC，正文用系統無襯線；不再載入外部字體、棕黑金色滿頁背景或固定全頁紋理。十二個門徒紋章作為相聚的視覺記號，故事與閱讀優先。

相聚小亭唯一活動為十二門徒人格，點建築直接開測驗；城堡內舊 /play 也呈現同一測驗，傳統 /play 保留四個既有工具。沿用 we_play + disciple_quiz 層級開關，載入／錯誤時不開測驗。

24題四選一、選取後按下一題、可回頭修改；以真實近期行為作答。十二類各8次、A/B/C/D各2次，同分全部並列。題庫配對近均衡（54對各2次、12對各3次），不是所有對完全相同；數字為選中次數，不冒充機率、準確率或常模。這是未經心理計量信效度驗證的情境遊戲；創作角色、經文明說及傳統對應分列。

結果可查看回答依據、可能強項、成長方向、同行小任務及朋友提問。只在分頁 sessionStorage 暫存有版本且驗證過的答案／題號，不上傳、不存身分、沒有自動分享。重新開始需確認；複製失敗提供可選取摘要。44px操作、手機單欄、內捲與標題焦點、原生radio鍵盤、無自動跳題及延遲計時器；尊重減少動態偏好。保留城堡Window原捲動介面及關閉／子視窗語意。

驗收需含：計分公平與12類可獨勝、全部同分、不完整／異常草稿、回頭修改不疊分、重載續作與重測取消、關閉再進、複製失敗、feature failclosed、城堡單入口／傳統工具保留，桌面390/320/橫向真B流程。來源及限制見 disciple-quiz-v7 的研究與獨立QA，結構檢查不等於真人效度。
