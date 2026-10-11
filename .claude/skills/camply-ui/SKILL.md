---
name: camply-ui
description: How to use the @camply/ui React component library in this app (imports, CSS, theming via --camply-* tokens, icon pack, component catalog with props, known gaps and workarounds). Use whenever building or editing UI in this project, before writing a custom component — check here first whether camply/ui already provides it.
---

# @camply/ui

The user's own React component library (60 components, dark theme by default, French built-in labels, zero runtime deps, ESM, tree-shakable). Version installed: see `package.json` (0.2.x). Typings are the source of truth: `node_modules/@camply/ui/dist/components/<Name>/<Name>.d.ts`. The source lives in `../camply/Camply-UI` (the user co-maintains it): a missing feature is fixed **there**, not worked around here.

## Setup rules

- CSS is **not** imported by the JS. `import '@camply/ui/styles.css'` once, in `src/main.tsx` (already done). It contains tokens + utilities + every component sheet.
- Import components from the barrel: `import { Button, Modal } from '@camply/ui'`.
- Icons: `import { Search, Star, Lock } from '@camply/ui/icons'` (2100+ Lucide-style icons, `size` default 16, any SVG prop). Do **not** add `lucide-react`.
- Fonts are **not** shipped: tokens reference `Manrope` / `Space Grotesk` / `JetBrains Mono`. This app loads Manrope and Space Grotesk with `@fontsource/*` in `src/main.tsx`.
- Optional `<CamplyProvider locale labels>` to override built-in labels (defaults are neutral French — fine for this app).
- Light theme: `data-camply-theme="light"` on a container (this app is dark-only).

## Theming

Everything reads `--camply-*` CSS variables. This app keeps the default camply look (dark, cyan accent); if a token must change, override it on `:root` in `src/styles/global.css`. Never hard-code colors in components — use the tokens. Main tokens:

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
- **Toast « Annuler »**: `useNotify()` / `useCollectionAction()` (`src/hooks/useNotify.ts`) wrap `toast({ action })` with the app's undo rule (refused if the collection changed since).
- `Stack` gaps follow `--camply-space-*` (no 7, no 3rem): keep a CSS class for other spacings or grids.

Domain components (card art, possession mark, rarity tag, pokédex tile, progress ruler, type chip) are app-specific and live in `src/components/`. Anything else generic belongs in camply.
