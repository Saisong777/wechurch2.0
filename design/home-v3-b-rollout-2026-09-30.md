# Homepage v3 - B-only rollout

## Authorized Scope

- Apply the approved v3 homepage demo to Railway B only.
- Preserve the original handshake logo, navigation, all existing destinations, real reading data, private data boundaries, and loading/error states.
- Use an unframed desktop reading/personal split, mobile single column, restrained coral/teal accents, and two community links with visibly labeled AI illustrative photographs.
- Photos are a single 1536x1024 atlas; CSS shows its top/bottom halves without additional downloads. They do not depict actual church members or gatherings. Lazy decoding/loading and fixed aspect ratios prevent layout shift.
- No database, authentication, permission, shared navigation, or A-site changes.

## Release And Acceptance

- Initial source baseline: `437b2367869f7e7eba8eabf481a1f86d5611176d`, including page-load recovery. The release guard detected the concurrent Bible-entry update before uploading; merged live source `a66befa0ebf081a23e5ce0b01c38bd4e5a8216f5` and its verified B release record `b3ddd348-0b84-45ef-b257-403d3a797a28` before revalidation.
- Work in an isolated checkout, not the in-use B source checkout or the dirty legacy workspace.
- Program checks run in the existing GitHub CI workflow, including unit tests and their deployment-check poststep. No developer-machine test server/database is started. The optional localhost database integrity suite is not run for this presentation-only change.
- `deploy-ci` requires successful checks on the exact committed source, all four existing CI steps, a clean checkout and a strict homepage-only changed-file allowlist against the verified live release. It retains the existing Railway isolation, deployed-source ancestry, migration hash, reference asset, immutable snapshot and pre-upload concurrency gates. Backend changes must use the full release path.
- User-visible desktop/mobile acceptance is performed against the actual Railway B URL. Screenshots do not establish physical iPhone acceptance.
- Deployment, online verification and A-unchanged evidence: pending.

## Original Logo

`public/wechurch-handshake.png` SHA-256:
`80d37c876f992ae61095148155adac5aff0a7895f63241ab0e23a54f4f4bb0b7`
