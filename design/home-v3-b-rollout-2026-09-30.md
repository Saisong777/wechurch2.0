# Homepage v3 - B-only rollout

## Authorized Scope

- Apply the approved v3 homepage demo to Railway B only.
- Preserve the original handshake logo, navigation, all existing destinations, real reading data, private data boundaries, and loading/error states.
- Use an unframed desktop reading/personal split, mobile single column, restrained coral/teal accents, and two community links with visibly labeled AI illustrative photographs.
- Photos are a single 1536x1024 atlas; CSS shows its top/bottom halves without additional downloads. They do not depict actual church members or gatherings. Lazy decoding/loading and fixed aspect ratios prevent layout shift.
- No database, authentication, permission, shared navigation, or A-site changes.

## Release And Acceptance

- Initial source baseline: `437b2367869f7e7eba8eabf481a1f86d5611176d`, including page-load recovery. The release guard detected the concurrent Bible-entry update before uploading; merged live source `a66befa0ebf081a23e5ce0b01c38bd4e5a8216f5` and its verified B release record `b3ddd348-0b84-45ef-b257-403d3a797a28` before revalidation.
- Coordinated release order with the other B task, then included its final maximum-text navigation fix `8e9505bd4ada521717a9156d277161fb0bc12852` and verified release `0a63e89c-8128-4a17-a0bb-3cecfe1dc963`. Homepage acceptance begins only after the other task has finished using the shared browser.
- Work in an isolated checkout, not the in-use B source checkout or the dirty legacy workspace.
- Program checks run in the existing GitHub CI workflow, including unit tests and their deployment-check poststep. No developer-machine test server/database is started. The optional localhost database integrity suite is not run for this presentation-only change.
- `deploy-ci` requires successful checks on the exact committed source, all four existing CI steps, a clean checkout and a strict homepage-only changed-file allowlist against the verified live release. It retains the existing Railway isolation, deployed-source ancestry, migration hash, reference asset, immutable snapshot and pre-upload concurrency gates. Backend changes must use the full release path.
- User-visible desktop/mobile acceptance is performed against the actual Railway B URL. Screenshots do not establish physical iPhone acceptance.
- First B release `75c1c99d-4ddc-4e8d-a342-9d5578155360` passed source/health/Google-boundary verification. Live 320px maximum-text inspection exposed a wrapping wordmark and an oversized introductory heading; added homepage-only display-type caps while leaving reading-body enlargement and the logo image unchanged.
- Final deployment `84361bbc-10ed-4772-a9df-34413696ddf6` reached `SUCCESS`. Source `5c6f0ab2ba78090f06552548a18d611c08156888`, fingerprint `94ac43cd3f70831e84f2aea012cd425b62be610749d453aba3a8d8abe0a34361`.
- Release record `design/releases/b-84361bbc-10ed-4772-a9df-34413696ddf6.json` verifies source equality, health, live fingerprint and reference assets. A remained `a8a4db29-527f-4cc3-8d17-caed230f69cb`, identical to the pre-release observation. `productionApproved` remains false.
- The follow-up upload briefly remained in Railway INITIALIZING without a build, then proceeded to SUCCESS without cancellation, service recovery, variable changes or another upload.

## Verification Results

- [Exact-source GitHub CI](https://github.com/Saisong777/wechurch2.0/actions/runs/36691916477): typecheck and production build passed; 722 unit tests passed, 11 skipped; 42 deployment tests passed. Lint: zero errors, 288 existing warnings. The PR merge tree was checked against the source tree. Skipped tests and the unrun optional local database suite are not counted as passes.
- Railway B Google-boundary verification passed: invite-only perimeter, independent B callback, state/PKCE, basic identity scopes, forged/cancelled callbacks cannot create accounts or login sessions. No real Google consent was exercised.
- Actual B browser checks: 1440px light/dark standard text, 1440px light maximum text, 390px light/dark standard text, 320px light standard text and 320px light/dark maximum text. No document or home-element horizontal overflow; desktop two columns and mobile one column. Final 320px maximum wordmark stays on one line at 24px; the introductory heading is capped at 48px. Body/Scripture enlargement is unchanged.
- Both illustrative photos load at their 1536px natural width, with stable 3:1 crops and visible AI labels. Normal and dark screenshots inspected. Existing visible focus outlines and reduced-motion rules remain in place; no new animation added.
- First live release: eight guest flows opened real destinations (daily reading, write note, past notes, groups, wall, care, new prayer and tools). Final style-only release rechecked full Isaiah 61 reading, note login protection and the group photo link. No membership, prayer, care or note data was written.
- Authenticated state variants, loading/error/unpublished reading states and role-specific entries are covered by component tests. This is not a new end-to-end signed-in write acceptance or physical-device/Google-consent acceptance.
- Evidence: `design/previews/home-v3-desktop-light.jpg`, `home-v3-mobile-light.jpg`, `home-v3-mobile-maximum-dark.jpg`, `home-v3-viewport-checks.json` and `home-v3-guest-flows.json`. Screenshots are real B viewport captures, not mockups. Full-page capture artifacts were excluded because that capture mode rendered incorrectly in the browser tool.
- GitHub draft [PR #9](https://github.com/Saisong777/wechurch2.0/pull/9) backs up source, public-safe evidence and release records. It remains a B checkpoint, not authorization to merge/promote to A.

## Original Logo

`public/wechurch-handshake.png` SHA-256:
`80d37c876f992ae61095148155adac5aff0a7895f63241ab0e23a54f4f4bb0b7`
