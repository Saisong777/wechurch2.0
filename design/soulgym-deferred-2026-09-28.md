# SoulGym deferred from the current product

Sai explicitly moved SoulGym to a future phase on 2026-09-28 and requested removal of its remaining entry points and steps from B.

Remove SoulGym and its notebook from personal navigation, the study-note tab/query/count/export from My Notes, and session creation/history/hosting steps plus the SoulGym growth score from the admin dashboard. Keep member management, daily devotion publishing, mail, inbox, prayer wall and independent tools. Remove the obsolete feature-toggle group so enabling stored legacy flags cannot reopen this UI.

Old `/user` and `/user/study` links return home; `/user/notebook` and `/notebook` return to current personal notes. The homepage no longer follows `?session=` into the deferred flow. The app no longer mounts SessionProvider or lazy-loads the retired participant pages. The study reader `/learn/bible`, daily devotion and small-group shared reading are current features and remain active.

Historical records, database schema, backend APIs and dormant source modules are preserved for a future phase. This is a product-surface withdrawal, not data deletion or an API security shutdown. Production A is outside scope.

Acceptance: current personal/admin/notes surfaces omit deferred features even with legacy toggles enabled; active tools still render; direct old links do not load participant steps; typecheck, full release checks, B source fingerprint and live browser verification pass. Real authenticated B member/admin screens require a separate account/device acceptance; component tests are not represented as live member testing.

## B verification

Deployment `a5f4c1c5-3d58-450a-8b63-7297f9047ec4` is SUCCESS. Live fingerprint `50b7a58f23ab37315dfc605f7fb24d7a2cf2a964a7f96d9d3eb6180469e387ea` matches source `43febd12458ee78641d2d6a7744caae3476af9fc`. Typecheck, 659 tests, 33 deployment tests, integrity and build pass. Browser guest /me has seven active record links and no SoulGym links at 390px; old participant URLs return home, old notebooks reach current notes/auth. Authenticated notes/admin removal is covered by component tests, not live account impersonation. A remains `a8a4db29-527f-4cc3-8d17-caed230f69cb`.
