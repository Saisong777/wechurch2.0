# WeChurch Figma UI Kit Brief

This file is the source brief for building a WeChurch Figma design system and first prototype. Figma should make product decisions visible; React/Tailwind remains the implementation source of truth.

## Goal

Build a calm, durable, mobile-first church app interface that helps people know what to do today: read Scripture, pray, care for someone, and enter the right flow without hunting.

Success looks like:

- The first screen makes today's rhythm obvious within 5 seconds.
- Mobile navigation is thumb-friendly and never covers primary actions.
- Cards, buttons, forms, and states feel like one product.
- Visual warmth comes from spacing, typography, and small color accents, not decoration.
- Desktop feels spacious; mobile feels direct and uncluttered.

## Figma Pages

Starter-plan Figma files are limited to three pages, so use this compact structure:

1. `00 Cover`
2. `01 Design System`
3. `02 Homepage Prototype`

## Frames

Use these frame sizes:

- Mobile: `390 x 844`
- Small mobile: `360 x 800`
- Tablet: `768 x 1024`
- Desktop: `1280 x 900`
- Wide desktop: `1440 x 1024`

Design mobile first. Desktop should adapt the same hierarchy, not become a separate product.

## Foundations

### Color Roles

Use role names in Figma variables, not color descriptions.

| Role | Hex | Use |
|---|---:|---|
| `bg/default` | `#F8FAF9` | App background |
| `surface/default` | `#FFFFFF` | Cards, panels, popovers |
| `surface/scripture-paper` | `#FBF8F1` | Scripture surface only |
| `text/strong` | `#222C3A` | Headings and primary text |
| `text/muted` | `#5E6975` | Descriptions, metadata |
| `border/default` | `#D7DFDA` | Card and input borders |
| `brand/ink` | `#2A3F63` | Reading, active nav, Scripture accents |
| `brand/clay` | `#C96A43` | Prayer and today/now accents |
| `brand/green` | `#2F8A70` | Care and completion accents |
| `state/warning` | `#C98717` | Pinned/waiting labels |
| `state/destructive` | `#D43C3C` | Errors and destructive actions |

### Typography

Recommended Figma text styles:

| Style | Font | Size | Line | Weight | Use |
|---|---|---:|---:|---:|---|
| `Display/Page` | Noto Sans TC | 30 | 38 | 700 | Desktop page title |
| `Display/Mobile` | Noto Sans TC | 26 | 34 | 700 | Mobile page title |
| `Title/Section` | Noto Sans TC | 20 | 28 | 700 | Major card headers |
| `Title/Card` | Noto Sans TC | 16 | 24 | 700 | Card titles |
| `Body/Default` | Noto Sans TC | 15 | 24 | 400 | Main content |
| `Body/Strong` | Noto Sans TC | 15 | 24 | 600 | Emphasis |
| `Meta/Default` | Noto Sans TC | 12 | 18 | 500 | Labels and metadata |
| `Scripture/Verse` | Noto Serif TC | 21 | 36 | 400 | Scripture text only |
| `Nav/Label` | Noto Sans TC | 11 | 14 | 600 | Mobile bottom nav |

Keep letter spacing at `0`.

### Spacing

Use an 8px base grid:

- `space/1`: 4
- `space/2`: 8
- `space/3`: 12
- `space/4`: 16
- `space/5`: 20
- `space/6`: 24
- `space/8`: 32
- `space/10`: 40

### Radius

- `radius/sm`: 6
- `radius/md`: 8
- `radius/lg`: 12
- `radius/pill`: 999

Default cards should use `8px`. Reserve larger rounding for avatars and soft pill status labels.

### Shadows

Use subtle elevation only:

- `shadow/card`: `0 16 48 -34 rgba(30,58,95,0.42)`
- `shadow/nav`: `0 -18 40 -32 rgba(30,58,95,0.45)`
- `shadow/focus`: `0 0 0 4 rgba(27,117,167,0.12)`

## Core Components

Build these as Figma components with variants.

### App Header

Variants:

- `desktop/default`
- `mobile/default`
- `mobile/back`

Structure:

- Left: logo + `WeChurch`
- Center desktop: top nav
- Right: profile icon/avatar

States:

- Active nav: soft primary background, primary text
- Hover: muted background
- Focus: primary ring

### Bottom Navigation

Items:

- Home
- 查經
- 聖經
- 禱告
- 關懷

Variants:

- `inactive`
- `active`

Active style:

- Soft primary rounded rectangle behind icon and label
- Icon stroke 2.25
- Label primary, semibold

### Daily Office Header

Purpose:

Give the homepage a quick answer to "what is today's order?"

Content:

- Label: `今日面板`
- Date chip
- H1: `愛神 · 愛人`
- Body: `今天照著一個安靜的次序走：讀經、代求、關懷。`
- Scripture paper card
- Numbered rhythm:
  - `01 讀經`
  - `02 代求`
  - `03 關懷`

Mobile behavior:

- Scripture paper appears before the rhythm.
- Numbered rhythm rows stack vertically.
- Status chips show done/now/next.

Desktop behavior:

- Main daily office panel left.
- Entry index right.

### Home Domain Card

Two major variants:

- `love-god`
- `love-people`

Structure:

- Top tinted header
- Icon container
- Eyebrow
- Title
- Section rows below

Sections:

- Icon
- Title
- Summary
- Chevron
- Optional action button
- Collapsible content area

States:

- Collapsed
- Expanded
- Loading
- Empty

### Module Entry Card

Use for "主要入口".

Content:

- Icon
- Title
- Description
- Arrow icon

State:

- Default
- Hover: lift 2px, slightly stronger shadow, border tint
- Focus: primary ring

Do not use saturated full-card backgrounds. Keep the card surface white; color should live mostly in icon containers and hover borders.

### Forms

Inputs and textareas:

- Radius 8
- Border default
- Focus ring primary
- Error border destructive
- Placeholder muted

Buttons:

- Primary: primary fill
- Secondary: coral fill
- Ghost: transparent with muted hover
- Disabled: 50% opacity
- Loading: spinner icon + label change

## Prototype: Homepage

Create these frames:

1. `Home / Mobile / Default`
2. `Home / Mobile / Note expanded`
3. `Home / Mobile / Empty prayer`
4. `Home / Desktop / Default`
5. `Home / Desktop / All sections`

Interactions:

- Bottom nav item press changes active pill.
- Section row click expands/collapses.
- Save devotional note button changes to `儲存中`.
- Module card hover shows arrow movement on desktop prototype.

## Core Flow Frames

After the homepage is approved, design these next:

1. `Bible Reader / Mobile`
2. `Prayer Wall / Mobile`
3. `SoulGym Entry / Mobile`
4. `Care List / Mobile`
5. `Profile / Mobile`

Each flow must include:

- Loading state
- Empty state
- Error state
- Primary action state

## Figma To Code Rules

- Do not export auto-generated Figma-to-code output into the app.
- Figma decides hierarchy, spacing, component variants, and copy.
- React/Tailwind implementation should map Figma variables to `src/index.css` and Tailwind classes.
- Component naming should match the app where possible: `Header`, `BottomNav`, `HomeSection`, `DailyRhythmHeader`, `ModuleEntryCard`.

## Review Checklist

Before implementing a Figma screen:

- Primary task is visible without scrolling on mobile.
- No text depends on viewport-width font scaling.
- No card is nested inside another decorative card.
- Buttons have pressed, hover, focus, loading, and disabled states.
- Empty states tell the user the next action.
- Mobile bottom nav does not cover primary controls.
- Desktop layout is wider, not noisier.
