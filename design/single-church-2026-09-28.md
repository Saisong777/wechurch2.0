# Single active church

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
