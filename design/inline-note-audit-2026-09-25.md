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

Pending implementation, automated tests, B deployment, and browser readback.
Physical iPhone keyboard/address-bar behavior requires real-device confirmation.
