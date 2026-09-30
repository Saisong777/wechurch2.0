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
- Full release run: 130 test files / 742 tests passed; 42 deployment checks, typecheck, build and isolated DB integrity passed. Lint: zero errors, 288 existing warnings. An initial course-import timeout passed in isolation and in the complete release rerun.
- B deployment `c717ef7c-d16f-4321-9a8c-e8ff54c0be37` succeeded from `03aade7`; fingerprint `60d43a6db1ec7087aa8a0df9aec7391001d2c01a02f82719ab3ea64c0365cea5`. Matching GitHub-safe manifest is in `design/releases/`.
- Live B synthetic private-note acceptance: 11 HTTP checks passed, fixtures removed, production deployment unchanged. An initial encrypted maintenance connection failed; subsequent readback found no stranded fixtures, and the full acceptance rerun passed.
- `staging:verify` passed when run after fixture cleanup. Its first overlapping run detected the two temporary test accounts and correctly rejected the changing account count; do not run these checks concurrently.
- Live authenticated Chrome: homepage decimal markers and full text visually verified on desktop; collapsed note delete controls and confirmation visually verified at 390px. Confirmation defaulted to Keep; cancelled without submitting deletion of the user's note. Browser automation had transient command timeouts; keyboard activation and final DOM readback confirmed the flow. Viewport override reset.
- Physical iPhone acceptance remains unverified this turn; browser responsive checks are not physical-device acceptance. Screenshots containing personal data are retained outside Git only.
- Pre-change encrypted recovery set `b-recovery-1790759763178`: five encrypted files read back successfully. Migration 0023 applied. No additional off-device upload or full restore drill performed this turn.

## Data Boundary
Migration 0023 only creates a tombstone table. Existing member notes are not deleted during release. Deletion occurs only after the member confirms a specific note. Pre-change encrypted B backup is required. Historical encrypted backups retain their existing retention policy; this is not an erasure-from-all-backups feature.
