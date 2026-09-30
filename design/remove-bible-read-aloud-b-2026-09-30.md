# Remove Bible Read-Aloud

## Scope
- User-requested removal of all read-aloud controls from the B Bible reader.
- Remove full-chapter and selected-verse speech, shared floating-toolbar callbacks, the standalone ScriptureTTS component, and reading-plan playback/voice/speed controls and speech lifecycle effects.
- Preserve Bible content, translation comparison, study tools, text layout, notes, day navigation and reading completion. No database, authentication, reference assets or A deployment changes.
- Existing inert browser voice preferences need no destructive storage cleanup.

## Acceptance
- Source scan must find no read-aloud UI or speech synthesis references in runtime src files.
- Reader regression tests retain comparison, inline notes and cross-references; reading-plan test renders, switches day and unmounts without a speech API.
- Typecheck, release tests, build, live B fingerprint and desktop/mobile browser checks required. Physical-device testing is a separate acceptance boundary.

## Release
- Source: `b0cefd2e0833d56f8bd3ba466519a529aede465f` (pushed to GitHub).
- Railway B: `1a688c71-b07d-462b-a1fe-5ea95a8edb56`, SUCCESS. Fingerprint `2728fd43d9ecd61ba744e21d60d2127e751c80e969cc2e996958a8dc4c7fd848` matches the immutable source snapshot and live container.
- Typecheck, 130 test files / 738 tests, 42 deployment checks, isolated database integrity suite and production build passed. The disposable test database was removed and its absence verified.
- Live B checks passed; A remains at `a8a4db29-527f-4cc3-8d17-caed230f69cb`. No migration or member-content write was required.
- Authenticated Chrome readback: no read-aloud control, selected verse works, inline note editor opens with all three fields, translation comparison loads both texts, study panel loads commentary. No note was saved during this UI check.
- Desktop screenshot and mobile 390x844 / 320x740 checks passed. Mobile document widths equal viewport widths (390 / 320), with no horizontal overflow.
- Screenshot artifacts: `bible-without-read-aloud-desktop.png` and `bible-without-read-aloud-mobile.png` in the current Codex visualization directory; not copied into GitHub.
- Physical iPhone testing and real Google consent were not repeated for this UI-only release. Browser viewport simulation is not physical-device acceptance.
