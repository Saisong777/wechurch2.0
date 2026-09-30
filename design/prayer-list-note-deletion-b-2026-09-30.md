# Homepage Prayer List and Note Deletion

## Scope
- B only. Preserve homepage v3 release 84361bbc and its source 5c6f0ab.
- Homepage lists every supplied waiting personal prayer in an ordered list, with full text. Existing owner-scoped query, ordering, login/loading/error states and action links remain.
- Each note exposes Delete without expansion. Confirmation defaults to keeping the note and explains related-share withdrawal and retained reading check-ins.
- Server DELETE requires authenticated ownership and the current version; anonymous, other-owner and stale requests are rejected. Failed transactions retain the original and shares. Repeated successful deletions are idempotent for the owner only.
- Delete private note content, public wall copies and imported source text. Withdraw and clear linked family shares; existing replies remain inaccessible through the withdrawn share. Reading progress remains, with its note link cleared.
- Content-free deletion tombstones prevent stale create retries. Imported-note replay fails closed for manual review instead of silently restoring a deleted note. Migration verification counts intentional deletions separately from missing data.
- Device-only drafts are removed only from the current account on this device. Their confirmation explicitly excludes cloud notes.

## Verification
- Targeted component tests: ordered full prayer list, duplicate text handling, private-data guards; delete/cancel/error/conflict/device draft flows.
- Disposable DB HTTP checks: permissions, versions, injected failure rollback, share removal, stale-save rejection, imported note deletion and retained check-ins.
- Deployment, runtime fingerprint, browser checks and remaining device limits will be recorded after release.

## Data Boundary
Migration 0023 only creates a tombstone table. Existing member notes are not deleted during release. Deletion occurs only after the member confirms a specific note. Pre-change encrypted B backup is required. Historical encrypted backups retain their existing retention policy; this is not an erasure-from-all-backups feature.
