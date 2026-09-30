# Devotional Note Editor: Audit and Recipe

## Scope

Layout-safe redesign requested by Sai on 2026-09-25. Surface: form-flow.
Evidence: user screenshot and DevotionalNoteDialog, Dialog, AutoResizeTextarea source.
Entry points and APIs stay unchanged. B only; no database changes or A deployment.
Other routes are not audited by this change.

## Findings

1. The 500px right sheet leaves most desktop space dimmed and unused.
2. Large tinted cards add visual weight around each writing field.
3. Scripture preview consumes vertical space before writing begins.
4. Save controls require scrolling past every field.
5. The shared textarea caps height while hiding overflow; long notes need a local scroll override.

## Blueprint

Continue WeChurch Daily Rhythm with existing semantic light/dark tokens.
Centered, max-800px desktop dialog; full-viewport mobile editor. Fixed-in-layout
header with title, save and close; one scrollable body with scripture disclosure,
draft/conflict notices, three unframed writing sections, share preview and AI.
Save remains at the top rather than relying on a bottom bar above a mobile keyboard.
16px writing text, 44px minimum controls, no decorative progress bar.

Preserve all fields, test selectors, local drafts, conflicts, unsaved navigation
guard, account ownership, save status handling, sharing consent and AI controls.
Display formatting must not modify stored scripture or note content.

## Acceptance

- No right-side sheet; desktop centered and mobile fits 320px.
- Long input remains scrollable; save/close visible without reaching the last field.
- Scripture expand/collapse preserves input.
- Cancel/discard, save errors, queued saves and legacy fields covered by tests.
- B live desktop/mobile and light/dark inspection; real iPhone keyboard remains a physical-device check.

## Focus Regression Found During Live QA

On 390px, focusing the last field after entering a 30-line first field caused
the outer `overflow: hidden` dialog to scroll by 63px, moving save above the
viewport. The editor now uses `overflow: clip`; only the inner body/textarea
may scroll. This is a local editor rule, not a change to all dialogs.
Reference: [MDN overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow)
distinguishes hidden (still programmatically scrollable) from clip (not a scroll container).

## Verification and Release

- 373 Vitest tests, 7 deployment/backup guards, typecheck, disposable local
  PostgreSQL/HTTP integrity tests and build passed. Lint: 0 errors, 339 existing warnings.
- Live B: desktop centered 800px; mobile full viewport, 16px inputs, collapsible
  scripture and light/dark surfaces visually checked.
- 320x568, 390x844, 390x420, 768x1024 and 1280x900 checked with long input.
  No horizontal overflow; outer scroll stayed zero and save stayed visible.
- 30-line input can scroll inside its field. Editing the last field no longer
  scrolls the header away. Scripture pointer/Enter toggle preserves form text.
- Cancel-close preserved test input; confirmed discard removed it. Test content
  was never saved or shared to the live account. Save/error/pending/blocked and
  legacy field preservation were covered with synthetic component tests.
- Physical iPhone/Android keyboard and browser-chrome behavior remain a separate
  device check; resized Chrome viewports do not prove physical-device acceptance.
- B deployment: `566d479e-6a71-4d43-bb1e-25f21c5f1bdd`.
- Runtime source: `02b3a958226dd871c5105186459dbb27b9ab388e`.
- Fingerprint: `9315fbf1a29b5c34109dca11cca4834abb952978bfb8001d39f694529c5a4cbf`, 478 files.
- Live fingerprint and health verified. A remains `a8a4db29-527f-4cc3-8d17-caed230f69cb`.
- No database migration, source content changes, auth changes or public sharing.
