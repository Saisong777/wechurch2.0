# Note Save and Sharing Revision

Sai explicitly requested bottom save, separate sharing to own groups or the
devotion wall, and removal of AI analysis from this editor. This supersedes the
top-save recipe in note-editor-audit-2026-09-25.md.

## Audit

The previous header save conflicts with the requested writing sequence. The
single public-share button obscures the difference between private saving and
audience selection. Privacy is repeated in both header and draft status.

## Approved Scope and Blueprint

- Editor footer, inside the dialog layout: Save (only me), Share (group/wall).
- One scrollable writing body; footer never overlays the last field. Preserve
  overflow clip protection, safe-area spacing, 16px fields and mobile full screen.
- Share first saves the private note successfully, then opens explicit audience
  and excerpt selection. Default to group, never silently fall back to public.
- Reuse the existing group membership/ownership API and wall consent/date rules.
- Group shares are named; anonymous remains a wall option only, matching server semantics.
- Remove editor AI action, request and result view; do not delete stored notes or
  historical analysis data, or alter unrelated modules.
- Keep existing wall-only callers unchanged; optional group selection is local
  to the editor sharing flow. No auth, schema or A deployment changes.

## Acceptance

Bottom actions fit small phones; long-input focus does not scroll the shell.
Private save never calls a sharing endpoint. Group and wall destinations are
mutually exclusive, recipient changes reset consent, and failed/pending saves do
not open sharing. Test empty/error group lists, explicit excerpts, stable retry
IDs and disabled controls during submission. Live B checks must not publish
synthetic content to real groups or the public wall.

## Verification and Release

- Typecheck, 384 Vitest tests in 76 files, seven deployment guards, disposable PostgreSQL/HTTP
  integrity checks and production build passed. Lint: no errors, 338 existing warnings.
- New regression coverage: private save versus share, saved source ID, blocked/pending
  saves, audience/group consent resets, empty/error group lists, selected excerpts,
  retry idempotency, named groups versus anonymous wall, separate length limits
  (12,000 group / 20,000 wall) and disabled public-wall polling in group mode.
- Actual isolated HTTP/DB checks cover nonmember and removed-member denial, source
  ownership, consent, idempotency, unchanged private original and no unintended wall post.
- Local browser fixture renders the real sharing component with synthetic data only:
  group PUT includes all three selected sections; wall POST includes only the selected
  section and anonymous=true. 320px light and 1280px dark previews were inspected.
- Live B editor tested at 320x568, 390x844, 390x420, 768x1024 and 1280x900.
  Footer remains within the viewport, writing body ends before footer, no horizontal
  overflow, dialog scrollTop=0, and header has no Save. Existing note fields were not
  edited, saved or shared; no synthetic content was posted to B.
- Physical iPhone/Android keyboard and browser toolbar behavior still require device
  acceptance; viewport sizing is not a substitute. Live group/public posting was not
  performed against real members; isolated component and DB tests cover those writes.
- B deployment: `64250cf4-4016-4a30-95a2-798e18966fcd` (SUCCESS).
  Source: `72b4e9410d280bfbb97fdbe1541f9afa1145dd4e`; 478-file fingerprint
  `2c14a63ea9a661c3be1c9eec1eece930ec7e475849ab4a4c5c2bb24b58f23be6`.
  Health and source/live hashes match. A remains
  `a8a4db29-527f-4cc3-8d17-caed230f69cb`; no migrations, auth changes or data imports.
- GitHub recovery: feature branch `codex/devotional-save-share`, fixed tag
  `b-2026-09-25-64250cf4`. Source, manifest and safe release evidence only; no DB,
  personal notes, uploads, credentials or local browser fixture.
