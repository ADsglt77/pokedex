---
name: camply-ui
description: How to use the @camply/ui React component library in this app (setup, component names, known gaps and their workarounds, which generic components the app may write itself). Use whenever building or editing UI in this project, before writing a custom component — check here first whether camply/ui already provides it.
---

# @camply/ui

The user's own React component library (dark theme by default, French built-in labels, ESM,
tree-shakable). Version installed: see `package.json`. The source lives in `../Camply-UI`
(next to this repo) when it is checked out (the user co-maintains it): its `AI-CONTEXT.md` gives the
library's own rules (setup, tokens, `variant` for the shape and `tone` for the meaning, links styled
as buttons with `asChild`, headings, dialogs). A missing feature is fixed **there** when
convenient; meanwhile the workarounds below are the only allowed ones.

## In this app

- `import '@camply/ui/styles.css'` once, in `src/main.tsx` (done), then the app's
  `src/styles/theme.css`. Components from the barrel (`@camply/ui`), icons from `@camply/ui/icons`
  (never `lucide-react`). Fonts: Manrope and Space Grotesk through `@fontsource/*` in
  `src/main.tsx`;
  `--camply-font-mono` points to the display font (`global.css`: JetBrains Mono is not loaded).
- Light theme: `data-camply-theme="light"` on `<html>` (`src/store/theme.ts`, and `public/theme.js`
  before the first paint: a file, the content security policy allows no inline script).
- Colours: the two themes are in `src/styles/theme.css` (its comments, and `docs/interface.md`);
  a colour changes there, never in a component, and is checked in both themes.
- Only camply's public API: its props and its `--camply-*` variables, never an internal class
  (`.camply-…__…`). The rare exceptions are listed below.

## Components

The `.d.ts` files in `node_modules/@camply/ui/dist/components/<Name>/` are the reference for the
props (the built JS next to them shows the behaviour): read them, don't guess.

Accordion, Alert, Avatar, Badge, Banner, Breadcrumbs, Button, ButtonGroup, Card (+ CardHeader,
CardTitle, CardDescription, CardFooter), Carousel, Checkbox, ColorPicker, Combobox,
CommandPalette, DatePicker, DescriptionList, Divider, Drawer, DropdownMenu (+ MenuItem, MenuLabel,
MenuSeparator), EmptyState, FileUpload, HoverCard, IconButton, Input, Kbd, Menubar, Meter, Modal,
MultiSelect, NumberInput, Pagination, PinInput, Popover, Progress, RadialProgress, Radio
(RadioGroup), RangeSlider, Rating, SegmentedControl, Select, Sheet, Skeleton, Slider, Snippet,
Spinner, Spoiler, Stack, Stat, Steps, Switch, Table, Tabs (TabList, Tab, TabPanel), Tag, TagInput,
Textarea, Timeline, Toast (ToastProvider, `useToast`), Toggle, Tooltip, Tree.

## Known gaps → workarounds

- **Select with "no value"**: options are strings only → use `''` as the "all" value.
- **Amounts are typed in `EuroInput` / `EuroField`** (`src/components/EuroInput.tsx`), not
  `NumberInput`: they carry the app's money rules (« 12,50 », saved when leaving the field, Enter
  or Escape, with « Annuler » ; empty means `undefined`), tested in `tests/`. `NumberInput
  allowEmpty` exists since 0.3 but has steppers and no euro parsing.
- **A field's `error` is not announced** (its text has no `role="alert"`): a refused form moves
  the focus to the field in error (`focusAfter`, `focusFirstError`), where it is read when the
  focus comes from elsewhere. Where it does not, `FieldAlert` (`src/components/FieldAlert.tsx`, a
  hidden `role="alert"` remounted by a new `key` at each refusal) also announces it: `EuroInput`
  (checked when the focus has already left) and the pseudo (one field, sent by Enter). Drop it
  when camply announces the error.
- **`SegmentedControl` segment with a drawing** (the flags of `LanguageSwitch`):
  `SegmentOption.label` is typed `string`, but camply writes it as is (`{label}`) and names the
  segment from its content. `segment()` in `LanguageSwitch` passes an SVG (`role="img"` +
  `aria-label`) through one cast; drop it when camply types `label` as `ReactNode`.
- **`Radio` with a drawing in its label** (the new favourite's `RadioGroup` in `CardActions`: the
  reference and its flag, a set code existing in both languages): `RadioProps.label` is typed
  `string`, but camply writes it as is. `CardActions` passes `<CardReference>` through one cast
  (`as unknown as string`), the same as `LanguageSwitch`; drop it when camply types `label` as
  `ReactNode` (DEC-07, F-CAMPLY-01).
- **Unchecked radios barely visible** (A11Y-02 of 2 November, DEC-07): their outline
  (`--camply-border-strong`), like the thumb of an off `Switch`, is 1.2 to 1.7:1 in both themes,
  under the 3:1 a control needs. No local workaround: raising `--camply-border-strong` would change
  every border of the app, and targeting the control takes an internal class. To fix in camply (a
  border token of at least 3:1 for unchecked radios and checkboxes).
- A group of `Checkbox` / `Toggle` has no group label: `<fieldset>` + `<legend>` (CardFilters).
- **Internal classes are not an API**: the last override of one carries the comment « Classe
  interne de camply (pas une API) : à revérifier après une mise à jour ». After a camply update,
  list them with `grep -rn '\.camply-[a-z]*__' src` and recheck each one.
- **Password reveal**: `Input` has none. `usePasswordReveal` (`src/hooks/usePasswordReveal.tsx`)
  gives a password field its `type` and an `IconButton` (`rightIcon`, `aria-pressed`): login
  and sign-up. Drop it when camply has one.
- **`Progress` in forced colors**: its fill disappears (Windows high contrast). Not fixed in the
  app (it would take an internal class): to ask camply.
- **Table on a phone**: `.stack-table` (global.css) turns a `Table` into a list of cards under
  `@container table (max-width: 36rem)` (hides `thead`, makes each `tr` a grid; the page places
  the cells with `grid-area` by `nth-child`). It relies on `.camply-table__table` / `__td`: recheck
  after a camply update. Hiding `thead` hides the sort buttons too: a sortable table is wrapped in
  `.stack-sort` with a `Select` « Trier par » in `.stack-sort-choice`, shown exactly when the list
  mode starts: `.stack-sort` becomes the only `table` container (the table's own, narrower by its
  border, is removed there), on the same controlled `sort` (`lib/table-sort.ts`). Drop
  it when camply's `Table` keeps a sort control in that mode.
- **`Combobox` as an « add » field**: pass `value=""` (controlled and empty) so the field clears
  after each pick without remounting (a `key` would lose the focus).
- **No chart component**: `src/components/PriceChart.tsx` is a small SVG line chart on camply
  tokens.
- **Toast « Annuler »**: `useNotify()` / `useCollectionAction()` (`src/hooks/useNotify.ts`) wrap
  `toast({ action })` with the app's undo rule (refused if the collection or the shopping data
  changed since).
- `Stack` gaps follow `--camply-space-*` (no 7, no 3rem): keep a CSS class for other spacings or
  grids.

## Project rules

Domain components shared by several pages (card art, possession mark, pokédex tile, progress
ruler, price chart) live in `src/components/`; a component used by one page lives in that page's
folder (e.g. `TypeChip` in `src/pages/pokemon/`). The only generic wrappers allowed here are those
camply lacks: `ConfirmDialog`, `PageHeader`, `Panel` (a page block: `Card` + titled head +
actions), `ExternalLink`, `EuroInput`/`EuroField`, `FieldAlert` (until camply announces a field's
error), and the app's shared pieces built on camply
(`StandalonePage`, `FiltersPopover`, the `EmptyState`s `Unavailable` and `NoMatch`). Anything
else generic belongs in camply.
