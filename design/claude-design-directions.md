# Claude Design Directions for WeChurch

Claude Design was asked to explore three visual directions for WeChurch without editing code or files. Recommendation: use Direction 1, `日課 / The Daily Office`, then graft a few practical elements from Direction 3.

## Direction 1 — 日課 / The Daily Office

Feel: the day arrives already ordered: read the Word, pray, care for one person.

Key moves:

- Keep the calm base surface.
- Move primary blue toward ink-indigo for less SaaS energy.
- Add a Scripture-paper cream surface used only for Scripture.
- Use a Chinese serif for Scripture and devotional verse only.
- Structure the homepage as a numbered rhythm: `01 讀經`, `02 代求`, `03 關懷`.
- Keep entry cards below the fold.

Risk:

- Numbering must feel liturgical, not like a productivity checklist.

## Direction 2 — 晨光 / Morning Light

Feel: opening the app feels like light through a window.

Key moves:

- Warm background.
- Time-of-day light tint.
- Large verse-first hero.
- Fewer, larger cards.

Risk:

- Can look like generic AI-wellness gradients.
- Higher contrast/accessibility risk.

## Direction 3 — 週報 / Bulletin

Feel: a durable working page, like a well-kept church bulletin or shepherd's handbook.

Key moves:

- Nearly monochrome with functional color only.
- Dense live counts.
- Labeled sections with hairline rules.
- Useful for leaders and pastoral tracking.

Risk:

- Can feel administrative instead of pastoral.

## Recommendation

Use `日課 / The Daily Office`.

Why:

- It best answers the product job: make today's rhythm clear immediately.
- It is calm and durable without relying on decorative gradients.
- Scripture becomes a distinct material, not just another content card.
- It preserves most existing tokens and needs only a small visual shift.

Graft from Direction 3:

- Functional color discipline.
- Live counts inside the numbered rhythm.

Borrow carefully from Direction 2:

- Subtle time-of-day tint only, no flashy gradient hero.

## Prototype First

Build these first in Figma:

1. Mobile `日課` homepage with Scripture-paper hero.
2. Numbered rhythm spine with done/undone/live count states.
3. Empty states for no prayer and no care contact.
4. Desktop adaptation with the same rhythm, not a separate dashboard.
