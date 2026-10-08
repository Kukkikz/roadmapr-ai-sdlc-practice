---
version: alpha
name: Roadmapr
description: A calm, editorial feedback-and-roadmap product UI on a white canvas with near-black ink type. Primary actions are a near-black rectangle with 12px corners; secondary actions are white with a hairline outline. Brand voltage comes from a few full-width signature surfaces (dark ink, forest, cream) and from warm pastel status colours, never from gradients or heavy shadows. Type is Inter at weights 400 and 500 only.

colors:
  primary: "#181d26"
  primary-active: "#0d1218"
  ink: "#181d26"
  body: "#333840"
  muted: "#41454d"
  hairline: "#dddddd"
  border-strong: "#9297a0"
  canvas: "#ffffff"
  surface-soft: "#f8fafc"
  surface-strong: "#e0e2e6"
  surface-dark: "#181d26"
  signature-forest: "#0a2e0e"
  signature-cream: "#f5e9d4"
  signature-coral: "#aa2d00"
  status-open-bg: "#e0e2e6"
  status-planned-bg: "#cfe0fb"
  status-in-progress-bg: "#f4d35e"
  status-shipped-bg: "#a8d8c4"
  status-declined-bg: "#f6d9cf"
  on-primary: "#ffffff"
  on-dark: "#ffffff"
  link: "#1b61c9"
  link-active: "#1a3866"
  info: "#254fad"
  info-border: "#458fff"
  success: "#006400"
  success-border: "#39bf45"
  danger: "#aa2d00"

typography:
  display-lg:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 40px
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: 0
  display-md:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 32px
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: 0
  title-lg:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: 0
  title-md:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  title-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  label-md:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  button:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  body-md:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: 0.16px
  code:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0

rounded:
  sm: 6px
  md: 10px
  lg: 12px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 96px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: 12px 24px
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: 12px 24px
  button-secondary-on-dark:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: 12px 24px
  vote-button:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  vote-button-voted:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  top-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    height: 64px
  board-header:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-md}"
    padding: 48px
  idea-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.title-sm}"
    rounded: "{rounded.md}"
    padding: 16px
  status-badge-open:
    backgroundColor: "{colors.status-open-bg}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 4px 8px
  status-badge-planned:
    backgroundColor: "{colors.status-planned-bg}"
    textColor: "{colors.info}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 4px 8px
  status-badge-in-progress:
    backgroundColor: "{colors.status-in-progress-bg}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 4px 8px
  status-badge-shipped:
    backgroundColor: "{colors.status-shipped-bg}"
    textColor: "{colors.success}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 4px 8px
  status-badge-declined:
    backgroundColor: "{colors.status-declined-bg}"
    textColor: "{colors.danger}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 4px 8px
  tag-chip:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.body}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 4px 8px
  filter-rail:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    typography: "{typography.body-md}"
    width: 240px
  roadmap-column:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.title-sm}"
    rounded: "{rounded.lg}"
    padding: 16px
  comment:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    typography: "{typography.body-md}"
    padding: 16px
  team-reply:
    backgroundColor: "{colors.signature-cream}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 16px
  signature-dark-card:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.display-md}"
    rounded: "{rounded.lg}"
    padding: 48px
  signature-forest-card:
    backgroundColor: "{colors.signature-forest}"
    textColor: "{colors.on-dark}"
    typography: "{typography.display-md}"
    rounded: "{rounded.lg}"
    padding: 48px
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 12px 16px
    height: 44px
  text-input-focus:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  text-link:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.link}"
    typography: "{typography.body-md}"
  empty-state:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.body}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 48px
---

## Overview

Roadmapr is a quiet, editorial product UI. The floor is a white canvas with near-black ink type, generous whitespace and hairline dividers. Nothing competes for attention until it needs to: the single most important action in a view is a near-black button, and everything else is white with a hairline outline.

Brand voltage comes from three places only: the near-black and forest **signature cards** used for the few moments that matter (saving an owner link, a board's empty state, a "shipped" celebration), the warm pastel **status colours** that make a board scannable at a glance, and confident type size rather than weight.

This tone is adapted from the Airtable-style reference in `DESIGN-airtable.md`, which describes a marketing site. Roadmapr takes its palette, type restraint, radii and button pair, and leaves out the marketing-only parts (hero bands, pricing pills, logo strips, rainbow stripes). Roadmapr does not use Airtable's name, logo or wording.

**Key characteristics**

- Primary button is `{colors.primary}` with white text and `{rounded.lg}` corners. One primary action per viewport.
- Secondary button is white with a 1px `{colors.hairline}` outline and `{colors.ink}` text.
- Weight 400 for display type, 500 for titles, labels and buttons. Never 600 or 700.
- No gradients, no mesh, no glow, no heavy shadows. Depth comes from colour blocks and hairlines.
- Status is always shown as a coloured badge with a text label, never colour alone.
- Pill shapes are not used. Badges and chips use `{rounded.sm}`; icon buttons use `{rounded.full}`.

## Colors

### Ink and surfaces

- **Primary / Ink** (`{colors.primary}`): primary button, headings, the dark signature card. **Primary active** (`{colors.primary-active}`) is the pressed state.
- **Body** (`{colors.body}`) is running text; **Muted** (`{colors.muted}`) is meta text and captions.
- **Canvas** (`{colors.canvas}`) is the page floor. **Surface soft** (`{colors.surface-soft}`) holds roadmap columns, tag chips and empty states. **Surface strong** (`{colors.surface-strong}`) is the `open` badge background.
- **Hairline** (`{colors.hairline}`) outlines inputs, cards and dividers. **Border strong** (`{colors.border-strong}`) outlines disabled controls.

### Signature surfaces

- **Surface dark** (`{colors.surface-dark}`) and **Forest** (`{colors.signature-forest}`) carry full-width cards with white type.
- **Cream** (`{colors.signature-cream}`) marks **team replies** in comment threads, so they read as "from the team" at a glance.

### Status

Each idea status has a fixed background and a text colour that meets 4.5:1 contrast against it.

| Status      | Background                       | Text               |
| ----------- | -------------------------------- | ------------------ |
| open        | `{colors.status-open-bg}`        | `{colors.ink}`     |
| planned     | `{colors.status-planned-bg}`     | `{colors.info}`    |
| in progress | `{colors.status-in-progress-bg}` | `{colors.ink}`     |
| shipped     | `{colors.status-shipped-bg}`     | `{colors.success}` |
| declined    | `{colors.status-declined-bg}`    | `{colors.danger}`  |

### Semantic

- **Link** (`{colors.link}`) is for inline links only, never for buttons. **Link active** (`{colors.link-active}`) is the pressed state.
- **Info border** (`{colors.info-border}`) is the focus ring and focused-input outline. **Success** (`{colors.success}`) and **Danger** (`{colors.danger}`) are for confirmation and error messages.

## Typography

Font: **Inter** (variable), falling back to `system-ui`. It substitutes the licensed grotesk in the reference. Use `font-feature-settings: "tnum"` for vote counts so numbers align.

| Token                     | Size | Weight | Use                                                     |
| ------------------------- | ---- | ------ | ------------------------------------------------------- |
| `{typography.display-lg}` | 40px | 400    | Board title on the board header                         |
| `{typography.display-md}` | 32px | 400    | Idea title on the detail page, signature card headlines |
| `{typography.title-lg}`   | 24px | 400    | Section titles ("Comments", "Roadmap")                  |
| `{typography.title-md}`   | 20px | 500    | Roadmap column titles                                   |
| `{typography.title-sm}`   | 18px | 500    | Idea titles in lists                                    |
| `{typography.label-md}`   | 16px | 500    | Vote count, form labels                                 |
| `{typography.button}`     | 16px | 500    | Button labels                                           |
| `{typography.body-md}`    | 14px | 400    | Descriptions, comments, nav                             |
| `{typography.caption}`    | 13px | 500    | Badges, chips, meta lines                               |

Emphasis comes from size and colour contrast, not weight. Body text is never smaller than 14px.

**Monospace:** JetBrains Mono (400 and 500, 13px) is used only for secret links and tokens, such as the owner link, invite links and board share links. It is not used for body text or numbers.

## Layout

- **Canvas:** 1280px maximum content width, centred, with `{spacing.xxl}` side padding. Spacing snaps to a 4px grid using the `spacing` tokens.
- **Top nav:** 64px tall, white, hairline bottom border. Left: the team and board name. Right: a secondary "Roadmap" link and the primary "Submit idea" button for Visitors; Members also see "Dashboard".
- **Board page (desktop):** a 240px `{components.filter-rail}` on the left (status, tags, sort) and the idea list in the remaining width. Idea cards stack in a single column with `{spacing.md}` gaps.
- **Idea detail:** a single reading column about 720px wide, with the vote button fixed at the left of the title.
- **Roadmap:** three equal columns (planned, in progress, shipped) of `{components.roadmap-column}`.
- **Vertical rhythm:** `{spacing.section}` (96px) between major bands on marketing-style pages only. Product screens use `{spacing.xl}` and `{spacing.lg}`.

## Elevation & Depth

Color-block first, hairline second, shadow last. Cards are flat with a 1px `{colors.hairline}` border. The only shadow is a faint one under open menus and the submit-idea dialog. Focus is a 2px `{colors.info-border}` ring.

## Shapes

| Token            | Value  | Use                                       |
| ---------------- | ------ | ----------------------------------------- |
| `{rounded.sm}`   | 6px    | Inputs, badges, chips                     |
| `{rounded.md}`   | 10px   | Idea cards, vote button, team replies     |
| `{rounded.lg}`   | 12px   | Buttons, roadmap columns, signature cards |
| `{rounded.full}` | 9999px | Avatars and icon buttons only             |

**Implementation note.** The pixel values above are authoritative. Stitch re-expresses this scale under its own token names when it imports this file (its `md` is 6px and its `xl` is 12px, and it has no 10px step), so Stitch-generated markup sets radii per element (`rounded-[10px]`). The app defines the three steps explicitly as `--radius-sm` 6px, `--radius-md` 10px and `--radius-lg` 12px and never relies on Stitch's token names.

## Components

Only Default, Active (pressed) and Focus states are specified.

- **`button-primary` / `button-secondary`:** the button pair. Primary for the one main action ("Submit idea", "Continue"); secondary for everything else. Disabled controls use `{colors.border-strong}` outline and `{colors.muted}` text.
- **`vote-button`:** shows an up arrow and the vote count in `{typography.label-md}`. `vote-button-voted` inverts to ink with white text, so the voted state does not rely on colour alone (the arrow also fills).
- **`idea-card`:** vote button at left; title, two-line description, then a meta row with the status badge, tag chips, comment count and relative time.
- **`status-badge-*`:** one per status, always with its text label.
- **`tag-chip`:** soft grey chip; a Member-assigned colour appears only as a 4px left marker, not as the whole chip.
- **`comment` and `team-reply`:** comments are plain on white with a hairline divider. Team replies sit on `{colors.signature-cream}` with a "Team" label and the Member's display name.
- **`signature-dark-card`:** used for the **save-your-owner-link** state after creating a Team, with the link in a mono block, a copy button and a plain warning that it is shown once. `signature-forest-card` is for a board's first-run empty state.
- **`text-input` / `text-input-focus`:** 44px tall, 1px hairline border, focus border `{colors.info-border}`. Each field has a visible label above it; error text is `{colors.danger}` below the field.
- **`empty-state`:** `{colors.surface-soft}` panel with a short sentence and one primary action.

## Do's and Don'ts

### Do

- Keep exactly one primary button per viewport.
- Show status and vote state with text or an icon as well as colour.
- Use cream only for team replies, and the dark and forest cards only for the moments listed above.
- Use whitespace instead of dividers where possible.

### Don't

- Don't use `{colors.link}` for a button.
- Don't add gradients, glows or heavy shadows.
- Don't use bold (600+) type or pill shapes.
- Don't introduce accent colours outside this file.
- Don't use colour alone to convey status.

## Responsive Behavior

Desktop only for the MVP: screens are designed and tested at 1024px and wider. Mobile and tablet layouts are out of scope (see `SPEC.md`, NF2), so no mobile or tablet design exists and none should be inferred. Content is capped at 1280px and gains outer margin on wider screens instead of scaling up.

Interactive targets are still at least 44px tall so the product stays usable on touch laptops.

## Accessibility

- Text meets WCAG AA contrast (4.5:1; 3:1 for 18px and larger).
- Every interactive element is keyboard-reachable with a visible focus ring.
- Every form field has a visible label; errors are announced and associated with their field.
- Honeypot fields are hidden from assistive technology.

## Known gaps

- Mobile and tablet layouts and dark mode are out of MVP scope.
- Pastel status backgrounds are inherited from the reference; their text contrast was computed (all at least 4.5:1) but not yet checked in a rendered build.
- The Stitch screens are reference only. Their sample copy is illustrative; the app uses the wording in `SPEC.md` and `CONTEXT.md`.
