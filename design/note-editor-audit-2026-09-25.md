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
