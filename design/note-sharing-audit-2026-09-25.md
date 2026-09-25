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
