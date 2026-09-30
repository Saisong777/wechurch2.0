# Mobile Scroll and Appearance Repair

Scope: layout-safe repair of the shared app shell and mobile menu, authorized by
the user's screenshot and request. Preserve routes, window-based reading-position
restoration, notes, auth, API calls, brand and desktop controls. B only.

## Audit

- index.html fixes html/body to 100% height and gives body inline overflow:auto.
  Live B at 390x844 confirms body height 844 while its content is 1311px tall.
  This creates a constrained body overflow boundary alongside document scrolling.
- src/index.css also assigns body overflow-x:hidden, which can turn the other
  axis into auto and retain an unwanted scroll container after removing inline CSS.
- Both AppLayout and each routed page impose min-height:100vh; short tabs can keep
  extra height below content, in addition to the mobile header and staging banner.
- AppearanceControl exists but is below page actions, navigation and account actions.
  It can require scrolling inside the menu and is not visibly labeled as appearance.
- Chrome's bottom-of-document rendering has only 24px below the reader footer;
  the large blank area in the supplied iPhone image is not reproduced in Chrome.
  The constrained root geometry is confirmed; physical iOS behavior remains to verify.

## Repair Blueprint

Use normal document scrolling with auto-height body and non-scroll-container
horizontal clipping. Keep overscroll behavior and theme-colored root. Give the
outer shell a small-viewport minimum; remove nested full-viewport minimum only
for shared mobile pages. Do not add fixed body, touchmove cancellation, synthetic
height polling or another navigation bar. Put a labeled appearance selector first
inside the existing mobile menu, retaining all navigation/account destinations.

Success: one document scroller, content-sized body, no extra scrolling past the
reader footer, reachable sticky navigation, menu themes immediately visible,
dark/light/system persistence, all note and navigation regressions passing.

## References

- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow
  distinguishes clip from scroll-container-producing hidden/auto.
- https://webkit.org/blog/13152/webkit-features-in-safari-16-0/
  documents overscroll behavior support; do not equate support with full iOS QA.

## Verification

- 387 tests / 77 files, typecheck, seven deployment guards, disposable DB/HTTP
  integrity and build passed. Scoped ESLint has no errors or warnings.
- Live B, 390x844 prayer tab: body changed from fixed 844px to content-sized
  1311px; body scrollHeight equals body height, body scrollTop stays 0 and
  overflow is clip/visible. Repeated downward scrolling stops at scrollY 467,
  with only 24px after the reader footer and sticky navigation at top 0.
- 320x568: prayer body 1387px, same 24px footer gap, no horizontal overflow.
  Appearance is the menu's first region; all three controls are 44px high and
  fit inside the first visible menu area without scrolling.
- 390x420: note editor footer stays visible and outer dialog scrollTop is 0;
  closing it restores body overflow:visible and the 24px reader footer gap.
- Live dark selection changes theme and browser theme-color; dark and system
  selection remain checked after reload. Original light preference restored.
- Home at 390x844 ends at its actual footer (body height=scrollHeight=1011px);
  no independent body scrolling, sticky nav remains reachable. Bible hub and
  return navigation work. Existing unit tests cover reading-position restoration.
- 1280x900 desktop retains its existing appearance dropdown, with no horizontal
  overflow and mobile navigation hidden. No live notes were edited or saved.
- Physical iPhone elastic scrolling, keyboard and browser chrome cannot be
  reproduced by Chrome viewport resizing. The root layout defect is fixed and
  measured; the user's exact iOS gesture still needs physical-device acceptance.

## B Release

- Deployment `40f945e8-605d-419e-876d-14e472344712`: SUCCESS, health passed.
- 479-file fingerprint `1705add25f4cb368e75405f2dd50a1a7e47829eae571972e27b44314fa1c5f02`
  matches the committed source and live B release.
- Branch `codex/mobile-scroll-appearance`; recovery tag `b-2026-09-25-40f945e8`.
- A remains `a8a4db29-527f-4cc3-8d17-caed230f69cb`. No database, auth, membership,
  Scripture, notes or shared-content changes. GitHub contains code and safe release
  evidence, not database backups or secrets.
