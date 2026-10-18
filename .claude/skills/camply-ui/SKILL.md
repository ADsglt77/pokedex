---
name: camply-ui
description: How to use the @camply/ui React component library in this app (imports, CSS, theming via --camply-* tokens, icon pack, component catalog with props, known gaps and workarounds). Use whenever building or editing UI in this project, before writing a custom component — check here first whether camply/ui already provides it.
---

# @camply/ui

The user's own React component library (60 components, dark theme by default, French built-in labels, zero runtime deps, ESM, tree-shakable). Version installed: see `package.json` (0.3.x). Typings are the source of truth: `node_modules/@camply/ui/dist/components/<Name>/<Name>.d.ts`, and the built JS next to them shows the behaviour. The source lives in `../Camply-UI` (next to this repo) when it is checked out (the user co-maintains it): a missing feature is fixed **there** when convenient; meanwhile the workarounds below are the only allowed ones.

## Setup rules

- CSS is **not** imported by the JS. `import '@camply/ui/styles.css'` once, in `src/main.tsx` (already done). It contains tokens + utilities + every component sheet.
- Import components from the barrel: `import { Button, Modal } from '@camply/ui'`.
- Icons: `import { Search, Star, Lock } from '@camply/ui/icons'` (2100+ Lucide-style icons, `size` default 16, any SVG prop). Do **not** add `lucide-react`.
- Fonts are **not** shipped: tokens reference `Manrope` / `Space Grotesk` / `JetBrains Mono`. This app loads Manrope and Space Grotesk with `@fontsource/*` in `src/main.tsx`.
- Optional `<CamplyProvider locale labels>` to override built-in labels (defaults are neutral French — fine for this app).
- Light theme: `data-camply-theme="light"` on a container. This app sets it on `<html>` (`src/store/theme.ts`, and `public/theme.js` before the first paint: a file, not an inline script, since the content security policy only allows the site's own scripts).

## Theming

Everything reads `--camply-*` CSS variables. This app has two themes in `src/styles/theme.css` (loaded right after camply's styles), no blue anywhere: dark (default, `:root`) — neutral dark grey, yellow accent, danger coral, warn orange; light (`:root[data-camply-theme='light']`) — warm pastel white, red accent, danger crimson. Info is purple in both. The Poké Ball logo uses `--brand-*` (same in both themes). Anything else that must differ per theme gets an app token there too: `--empty-sprite-opacity` and `--empty-sprite-opacity-large` (the greyed sprite of a Pokémon without a card), `--link`, `--link-underline`, `--link-underline-hover` (links; ink with a red underline in the light theme, so red stays the brand and the main action), `--chart-line`, `--chart-fill`. `--camply-bg` is also the browser bar colour (read by `src/store/theme.ts`); its frozen copies (`index.html`, the manifest, `public/theme.js`) are named in `theme.css`. Change a colour there, never in a component; check both themes. Never hard-code colors in components — use the tokens. Main tokens:

`--camply-bg, --camply-surface, --camply-surface-2, --camply-elevated, --camply-overlay, --camply-text, --camply-text-strong, --camply-text-muted, --camply-accent, --camply-accent-hover, --camply-accent-contrast, --camply-accent-soft, --camply-accent-border, --camply-danger*, --camply-warn*, --camply-success*, --camply-info*, --camply-border, --camply-border-soft, --camply-border-strong, --camply-radius-{xs,sm,,lg,xl,pill}, --camply-space-{1..6,8}, --camply-shadow-{sm,md,lg,pop}, --camply-ring, --camply-field-bg, --camply-font-{sans,display,mono}`.

Every component accepts `className` and `style`; single-root components forward refs.

**Two axes, never mixed**: `variant` is the shape, `tone` the meaning — a destructive button is `<Button tone="danger">`, a warning is `tone="warn"` (never `"warning"`).

## Catalog (most useful here)

| Need | Component | Key props |
|---|---|---|
| Button | `Button` | `variant: primary\|secondary\|ghost\|soft`, `tone`, `size: sm\|md\|lg`, `fullWidth`, `loading`, `leftIcon`, `rightIcon`, `asChild` |
| Link styled as a button | `Button asChild` | `<Button asChild variant="ghost"><Link to="/pokedex">Pokédex</Link></Button>` — never a `<button>` that navigates |
| Icon-only button | `IconButton` | `label` (required, aria), `variant`, `tone`, `size`, children = icon, `asChild` |
| Toggle button (pressed) | `Toggle` | `pressed`, `onChange(pressed)`, `size` |
| Grouped buttons | `ButtonGroup` | `orientation`, `attached`, `size` |
| Dialog | `Modal` | `open`, `onClose`, `title`, `description`, `footer`, `size: sm\|md\|lg\|full`, `closeOnBackdrop`, `showClose` |
| Bottom sheet / side panel | `Sheet` (`side: bottom\|top`, `height`, `handle`), `Drawer` (`side: left\|right`, `width`) | `open`, `onClose`, `title`, `footer` like Modal, but no `description` nor `size` |
| Text input | `Input` | `label`, `hint`, `error`, `leftIcon`, `rightIcon`, `size` + native input props |
| Textarea | `Textarea` | `label`, `hint`, `error` |
| Select | `Select<T extends string>` | `options: {value,label,disabled?}[]`, `value`, `onChange(value)`, `label`, `placeholder`, `size` |
| Segmented control | `SegmentedControl<T>` | `options: {value,label}[]`, `value`, `onChange`, `size: sm\|md`, `fullWidth`, `aria-label` |
| Switch / Checkbox | `Switch`, `Checkbox` | `label`, `hint`, `error` + native input props (`checked`, `onChange`) |
| Radio group | `RadioGroup` + `Radio` | group: `value`, `onChange`, `label`, `hint`; radio: `value`, `label`, `hint` |
| Toasts | `ToastProvider` (once, at root) + `useToast()` | `toast({ title, description?, tone: default\|success\|info\|warn\|danger, duration?, action?: { label, onClick } }) → id`, `dismiss(id)` |
| Alerts / banners | `Alert` (`tone`, `title`, `dismissible`), `Banner` (`tone`, `action`) | closable via `open` / `onOpenChange` (no `onDismiss`) |
| Empty state | `EmptyState` | `title`, `description`, `icon`, `actions`, `headingLevel` (2–6, default 3), `align: center\|start` |
| Badges / tags | `Badge` (`variant: soft\|solid\|outline`, `tone`, `icon`), `Tag` | |
| Loading | `Spinner` (`size`, `label`), `Dots`, `Skeleton` (`variant: text\|rect\|circle`, `width`, `height`), `SkeletonText` (`lines`) | |
| Progress | `Progress` (`value`, `max`, `tone`, `label`, `showValue`), `Meter`, `RadialProgress`, `Stat` | |
| Data display | `Card` (+ `CardHeader/Title/Description/Footer`, `CardTitle headingLevel`), `DescriptionList` (`items: {term, description}[]`), `Table`, `Divider`, `Kbd` | |
| Tabs / disclosure | `Tabs` + `TabList` + `Tab` + `TabPanel`, `Accordion`, `Spoiler` | |
| Overlays | `Tooltip` (`content`, `placement`), `Popover`, `HoverCard`, `DropdownMenu` + `MenuItem` | |
| Layout | `Stack` (`as`, `direction`, `gap: 0-6,8`, `align`, `justify`, `wrap`) | `as="section"`, `"header"`, `"aside"`, `"ul"`… keeps the semantics |
| Files | `FileUpload` (`accept`, `onFilesChange`, `maxSize`, `label`, `hint`) | |
| Carousel | `Carousel` (`slidesPerView`, `arrows`, `indicator`, `index`, `onIndexChange`) | |

## Component variables and props that replaced workarounds (camply 0.3)

Since 0.3, what this app used to patch through internal classes is camply API — use it, never an internal class:

- **Dialogs**: only the content of a `Modal` / `Drawer` / `Sheet` scrolls (header and footer stay; `size="full"` fills the window, with a small margin on phones). A sticky child (`position: sticky; top: 0`) sticks to the edge of the scrolling area (SetPicker's search). `initialFocus={ref}` focuses a field on open (SetPicker) and focus returns to the trigger. The focus trap only measures the first and last focusables.
- **`SegmentedControl label` / `hint`** for a form field (CardForm « Ajouter comme », OrderForm « État ») ; `aria-label` for a view switcher. Light-theme thumb: `--camply-segmented-*` variables in `theme.css`.
- **`Stat variant="plain"`** (PricePanel, flat in its panel) and **`size="sm"`** (stat grids on phones: `useStatSize()`, `src/hooks/useStatSize.ts`). A rise is green (`success`) in camply itself.
- **`DescriptionList layout="split"`**: amounts (SummaryLedger, OrderTotals) — label takes the room, amount right in tabular figures.
- **`Table bordered={false}`** inside `<Panel flush>`, which sets `--camply-table-edge-padding: var(--space-panel)` so the edge columns align on the panel title.
- **`Progress`**: `--camply-progress-height` / `--camply-progress-track` (ProgressRuler).
- **Toasts above the phone tab bar**: `--camply-toast-offset-y` on `:root:has(.shell)` (AppShell; camply adds the safe area).
- **`CardTitle headingLevel={1}`** (AuthCard), **`Card as="article"`** (WishCard), **`MenuLabel uppercase={false}`** (AccountMenu: an e-mail, a sentence).

## Known gaps → workarounds

- **Select with "no value"**: options are strings only → use `''` as the "all" value.
- **Amounts are typed in `EuroInput` / `EuroField`** (`src/components/EuroInput.tsx`), not `NumberInput`: they carry the app's money rules (« 12,50 », saved when leaving the field, Enter or Escape, with « Annuler » ; empty means `undefined`), tested in `tests/`. `NumberInput allowEmpty` exists since 0.3 but has steppers and no euro parsing.
- A group of `Checkbox` / `Toggle` has no group label: `<fieldset>` + `<legend>` (CardFilters).
- **Internal classes are not an API**: the last override of one carries the comment « Classe interne de camply (pas une API) : à revérifier après une mise à jour ». After a camply update, list them with `grep -rn '\.camply-[a-z]*__' src` and recheck each one.
- **Table on a phone**: `.stack-table` (global.css) turns a `Table` into a list of cards under `@container table (max-width: 36rem)` (hides `thead`, makes each `tr` a grid; the page places the cells with `grid-area` by `nth-child`). It relies on `.camply-table__table` / `__td`: recheck after a camply update.
- **`Combobox` as an « add » field**: pass `value=""` (controlled and empty) so the field clears after each pick without remounting (a `key` would lose the focus).
- **No chart component**: `src/components/PriceChart.tsx` is a small SVG line chart on camply tokens.
- **Toast « Annuler »**: `useNotify()` / `useCollectionAction()` (`src/hooks/useNotify.ts`) wrap `toast({ action })` with the app's undo rule (refused if the collection or the shopping data changed since).
- `Stack` gaps follow `--camply-space-*` (no 7, no 3rem): keep a CSS class for other spacings or grids.

Domain components shared by several pages (card art, possession mark, pokédex tile, progress ruler, price chart) live in `src/components/`; a component used by one page lives in that page's folder (e.g. `TypeChip` in `src/pages/pokemon/`). The only generic wrappers allowed here are those camply lacks: `ConfirmDialog`, `PageHeader`, `Panel` (a page block: `Card` + titled head + actions), `ExternalLink`, `EuroInput`/`EuroField`. Anything else generic belongs in camply.
