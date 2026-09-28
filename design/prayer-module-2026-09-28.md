# Prayer Module: Daily Use and Privacy

## Authorized Scope

Improve personal prayer, deliberate sharing to a family or the public wall,
progress tracking, and completion. Railway B only; no A release, member-data
cleanup, new notification service, or database migration. Reuse the approved
Together design and existing authentication. This is functional engineering,
not a new brand or information-architecture redesign.

## Acceptance Criteria

- Private creation and inline editing; full text and earlier responses readable.
- Waiting, answered, and ended prayers remain distinguishable. Continuing to
  wait must not remove a prayer from the active list.
- Subsequent progress appends a dated entry without replacing earlier response
  text. Existing stored records are left untouched.
- Search private titles, prayer text and response history; filter active/history.
- Keep previews and explicit audience/anonymity consent. An optional urgent flag
  applies only to the public copy. Never include private responses automatically.
- Optional closure of an owned public copy is in the same transaction as saving
  the private answer. Comments remain available to its owner, not to other users.
- Reopening a private original does not reopen or republish any shared copy.
- Shared family copies remain independent; owners may deliberately withdraw them.
- PATCH requires an updated-at token; stale saves return 409. PUT retries return
  the existing owned record without overwriting later edits. Foreign owners get
  404 and guests get 401.
- Member switches unmount private drafts. One route guard covers pending edits;
  local list filters are disabled while editing to avoid hiding unsaved work.
- Mobile controls are at least 44px. No extra viewport-height page shell.
- Both walls stay separate destinations. Prayer wall search and incremental DOM
  rendering reduce long-list clutter. Polling is 30s, inactive-tab polling off.

## Boundaries

History uses the existing 10,000-character response field, not an unlimited
event store. The limit is checked before writing. List rendering is incremental;
the API still fetches complete lists, so this is not server-side pagination or
a new capacity certification. Completed records can be explicitly selected for
sharing too; publishing a new public copy remains an affirmative new publication.
There is no automatic prayer publication, email, LINE delivery, or AI analysis.

## Verification

Unit tests cover inline editing, history preservation, waiting status, search,
account-switch cleanup, consent and urgent sharing. Disposable PostgreSQL HTTP
tests cover required tokens, stale writes, cross-account access, create retries,
anonymous interactions, closing and private reopening. B browser acceptance uses
only a synthetic test identity and removes its fixtures afterwards. Desktop and
mobile viewport tests do not replace physical iPhone acceptance.

## B Release Evidence

- Source: `95914b1e8e1bd3801a687fce2737cf29d0fdcedd`.
- Railway B: `4113ec50-033f-4022-92e0-929733509a52`, SUCCESS.
- Runtime fingerprint: `82f0bdbb3a32ab6f2b3429e91cf0b72b6f83ae6245bb55db7a295a988f002c8d`, 556 files.
- 108 test files / 623 tests, 33 deployment/recovery tests, typecheck, build and
  disposable database HTTP checks passed. Lint: zero errors, 359 warnings across
  the repository; this release does not claim to resolve all lint warnings.
- B live OAuth boundary checks passed (not a fresh real-user Google consent).
- B 390px and 1440px: inline edit, progress save, anonymous family/public sharing,
  urgent mark, comment, public closure, preserved history, dark appearance and
  horizontal overflow checks passed. Ten screenshots were captured with a
  disposable member identity; the fixture and all its prayer copies were removed.
- A remains `a8a4db29-527f-4cc3-8d17-caed230f69cb`. No schema change or member-data
  rewrite. Physical iPhone acceptance is still pending for this prayer update.
- GitHub-safe restore tag: `b-2026-09-28-4113ec50`; encrypted data backups remain
  separate and are not included in the source manifest.
