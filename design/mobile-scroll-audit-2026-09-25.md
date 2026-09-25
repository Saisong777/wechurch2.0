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
