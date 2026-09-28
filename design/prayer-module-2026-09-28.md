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

Release identifiers and actual results are recorded after B verification.
