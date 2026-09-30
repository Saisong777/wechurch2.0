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
- Pending B-only deployment and final live readback.
