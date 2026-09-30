# Single active church

Update 2026-09-29: Sai subsequently authorized assigning all current B members.
All 68 accounts are now assigned to iM; see [assignment evidence](member-church-assignment-2026-09-29.md).
The original catalog-only change described below did not itself assign membership.

Sai requested that all church choices be removed except iM行動教會. The active
catalog is now defined in shared/churches.ts and reused by the server and UI.
Its existing persisted ID remains IM 行動教會 to avoid rewriting membership,
pastoral scope or historical data. Display name is iM行動教會.

B was inspected before the change: the church-bearing tables contained no
other-church records; all 65 users had an unset church. The extra options were
seeded code, not organizations whose member data needed deletion. No database
records or private content are deleted, and no bulk membership assignment occurs.

- CRM no longer invents church options from arbitrary legacy profile values.
- Family matching defaults to the sole active church without a redundant select.
- Family creation/matching reject inactive churches; retired scopes do not map
  onto iM permissions.
- Family directory requests cannot retrieve a retired church's listed families.
- Management, profile and mail selectors use the active catalog and display label.
- Unknown historical scopes remain distinct for authorization and old data remains
  available to appropriately authorized administrators, not silently reassigned.
- Add future approved churches to the catalog; do not infer them from member text.

Verification includes catalog/alias and profile UI tests, real HTTP directory and
management-option checks, existing cross-church authorization tests, and B browser
readback. A is not authorized for this release.

## Acceptance

- 108 test files / 617 tests; 33 deployment/backup tests; typecheck, isolated
  PostgreSQL HTTP checks and production build passed.
- B deployment b9638923-cfda-49f9-82c8-a3637e520503 succeeded, source c6b9a26,
  554-file fingerprint c5930de303ea489f5816fe74c992992607ef00b1298de3452bb2faaceeb6ced7.
- Live B acceptance at 390px and 1440px: entry/feed/management, sole church label
  and automatic selection, five authenticated API reads, message/invite/matching
  persistence passed; disposable fixture removed. Physical-phone testing is not
  claimed. Production A remained unchanged.
