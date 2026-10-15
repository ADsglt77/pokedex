---
name: camply-ui
description: How to use the @camply/ui React component library in this app (imports, CSS, theming via --camply-* tokens, icon pack, component catalog with props, known gaps and workarounds). Use whenever building or editing UI in this project, before writing a custom component — check here first whether camply/ui already provides it.
---

# @camply/ui

The user's own React component library (60 components, dark theme by default, French built-in labels, zero runtime deps, ESM, tree-shakable). Version installed: see `package.json` (0.2.x). Typings are the source of truth: `node_modules/@camply/ui/dist/components/<Name>/<Name>.d.ts`, and the built JS next to them shows the behaviour. The source lives in `../camply/Camply-UI` when that repo is checked out next to this one (the user co-maintains it): a missing feature is fixed **there** when convenient; meanwhile the workarounds below are the only allowed ones.

## Setup rules

- CSS is **not** imported by the JS. `import '@camply/ui/styles.css'` once, in `src/main.tsx` (already done). It contains tokens + utilities + every component sheet.
- Import components from the barrel: `import { Button, Modal } from '@camply/ui'`.
- Icons: `import { Search, Star, Lock } from '@camply/ui/icons'` (2100+ Lucide-style icons, `size` default 16, any SVG prop). Do **not** add `lucide-react`.
- Fonts are **not** shipped: tokens reference `Manrope` / `Space Grotesk` / `JetBrains Mono`. This app loads Manrope and Space Grotesk with `@fontsource/*` in `src/main.tsx`.
- Optional `<CamplyProvider locale labels>` to override built-in labels (defaults are neutral French — fine for this app).
- Light theme: `data-camply-theme="light"` on a container (this app is dark-only).

## Theming

Everything reads `--camply-*` CSS variables. This app restyles camply's dark theme in Pokémon colours: `src/styles/theme.css` (loaded right after camply's styles) redefines the `--camply-*` tokens on `:root` — navy backgrounds, yellow accent, Pokédex red for the brand (`--brand-*`, logo only), danger coral and warn orange kept distinct from the accent. Change a colour there, never in a component. Never hard-code colors in components — use the tokens. Main tokens:

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
| Bottom sheet / side panel | `Sheet` (`side: bottom\|top`), `Drawer` (`side: left\|right`) | same shape as Modal |
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

## Known gaps → workarounds

- **Select with "no value"**: options are strings only → use `''` as the "all" value.
- **`NumberInput` cannot be emptied** (it commits `0` on blur): every amount goes through `src/components/CommitInput.tsx` — `EuroInput` (saved when leaving the field, on Enter or Escape, with « Annuler ») or `EuroField` (controlled by a form, e.g. OrderForm). `CommitInput` is the generic « saved on blur » field (link, note). Fix upstream when convenient.
- **`SegmentedControl` has no `label` / `hint`**: `src/components/SegmentedField.tsx` adds them with camply's field classes (`camply-field`, `camply-field__label`, `camply-field__desc`, hint linked by `aria-describedby`). A group of `Checkbox` has no group label either: `<fieldset>` + `<legend className="camply-field__label">` (PlannerPanel).
- **`Progress` track**: `ProgressRuler.module.css` restyles `.camply-progress__track`. Internal classes are not an API: recheck them after a camply update.
- **Table inside a `Panel`**: `<Panel flush>` drops the `.camply-table__wrap` border and aligns the first and last columns on the panel title (`Panel.module.css`). A `Stat` shown flat in a panel (`CardPrice`) and the compact `.stat-grid` on phones (`global.css`) restyle `.camply-stat__*` the same way.
- **`Combobox` as an « add » field**: pass `value=""` (controlled and empty) so the field clears after each pick without remounting (a `key` would lose the focus).
- **`CardTitle` stops at `headingLevel` 2**: a page whose title sits in a `Card` (`AuthCard`, for LoginPage and WelcomePage) renders its own `<h1>` styled with the display font.
- **`MenuLabel` is an uppercase caption**: for an e-mail or a sentence in a `DropdownMenu`, override `text-transform` / `letter-spacing` with a class (AccountMenu).
- **`Card` renders a `div`** (no `as`): give it `role="article"` when it stands for one (WishCard).
- **No chart component**: `src/components/PriceChart.tsx` is a small SVG line chart on camply tokens.
- **Toast « Annuler »**: `useNotify()` / `useCollectionAction()` (`src/hooks/useNotify.ts`) wrap `toast({ action })` with the app's undo rule (refused if the collection or the shopping data changed since).
- `Stack` gaps follow `--camply-space-*` (no 7, no 3rem): keep a CSS class for other spacings or grids.

Domain components shared by several pages (card art, possession mark, pokédex tile, progress ruler, price chart, preference fields) live in `src/components/`; a component used by one page lives in that page's folder (e.g. `TypeChip` in `src/pages/pokemon/`). The only generic wrappers allowed here are those camply lacks: `ConfirmDialog`, `PageHeader`, `Panel` (a page block: `Card` + titled head + actions), `ExternalLink`, `CommitInput`/`EuroInput`/`EuroField`, `SegmentedField`. Anything else generic belongs in camply.
