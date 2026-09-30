# Inline Daily Devotional Notes

## Scope and Evidence

- User requests same-page writing instead of a popup on the daily devotional reader.
- Surface: content + form-flow at `/learn/church-reading`.
- Code audit: ChurchReadingPage mounts DevotionalNoteDialog outside main. Its Radix
  portal covers the reading content; a full-height mobile dialog creates a separate
  scrolling surface. This conflicts with the requested reading/writing continuity.
- Approved layout-safe change: reuse the note form inline after the reader, keeping
  all three fields and bottom private-save/share actions. Reuse Daily Rhythm tokens.
- Do not change APIs, data ownership, note schema, sharing permissions, A, or records.
- Other note contexts retain their existing dialog. Share confirmation and unsaved
  changes confirmation remain intentional dialogs, not the writing surface.

## Blueprint

- Same reading column, unframed section with a divider; no overlay or inner scroller.
- Opening moves focus to the note heading, without opening the phone keyboard.
- Repeated entry returns to the same editor without clearing input.
- Private save stays on the page. Collapse protects unsaved changes.
- Save and share remain at the end of the form; no fixed bottom controls.

## Verification

- Added regression coverage for inline semantics, private-save staying open,
  collapse/navigation draft protection, explicit sharing preview, repeated entry,
  unchanged reading tab, and positioning after asynchronous note loading.
- Initial B browser review found that positioning during the loading placeholder
  stopped short of the editor. The follow-up waits for the loaded form before
  focusing and scrolling the heading. This does not focus a textarea or open a keyboard.
- B at 390x844 and 320x568: same-page region inside main, zero dialogs, no body
  scroll lock, editor body overflow visible, static footer, zero horizontal overflow.
  At 320px, both action targets are 138x56px. Page-end spacing is 24px at 390px.
- Live review is read-only: existing note content was not edited, saved or shared.
- Final B readback at 390x844: first-open heading is at 152px, below the 56px
  mobile header (document scroll padding plus heading margin). Focus is H2, not
  an input. The existing three note lengths remain unchanged through tab switches
  and repeated entry. No synthetic note was written to B.
- Final 320x568 footer remains in normal flow with a 24px page-end gap and zero
  horizontal overflow. Desktop 1280x900 uses the 624px inner reading column;
  heading at 88px is unobscured. Collapse returns focus to the clicked entry and
  retains the selected prayer tab. Before/after screenshots inspected via browser.
- Typecheck, 393 tests / 77 files, 7 deployment guards, disposable PostgreSQL/HTTP
  integrity checks and production build passed. Changed-file ESLint is clean;
  full lint has 338 existing warnings and zero errors.
- Physical iPhone keyboard/address-bar behavior requires real-device confirmation.

## Release

- B deployment: `6f2da44e-0757-4b1f-bcfb-c1ea04a7f110`.
- Source: `759fb1e93ddf3725fd9b611776157c8f9fb8a23d`.
- Fingerprint: `be78c5e3595537e23186b9db465f0ffaf2a74bc69a47f8abdc5d79d1e3dff1d1`.
- All 479 runtime files match the immutable snapshot and live B manifest; health passed.
- A remains `a8a4db29-527f-4cc3-8d17-caed230f69cb`. No migration or data write.
- Intermediate release `a015d2b9-bba5-458f-82e3-16c2cc02d865` is superseded by
  the asynchronous positioning repair, with its release record retained.
