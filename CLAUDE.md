# Bookmarks

A personal, local-only bookmark manager. The display name is configurable
(`VITE_APP_NAME`, default "Bookmarks", read via `APP_NAME` in
`src/lib/config.ts`) — never hardcode a product name in UI, titles or
storage keys. It runs on the owner's machine or home server (Windows
natively, or Docker on any OS / NixOS), serves on `http://localhost:8008`,
and does one thing: store links, organised into folders and subfolders,
shown as a file tree.

Keep it **clean, minimal and to the point**. No accounts, no sync, no tags,
no previews/favicons scraping, no analytics. If a feature isn't about
storing, organising or opening links, it doesn't belong here.

Work is tracked in [`TASKS.md`](./TASKS.md) — read it first, pick the next
unchecked task, and tick it off (`- [x]`) in the same change that completes
it. Add new tasks there rather than doing unplanned work.

## Stack

| Concern       | Choice                                                            |
| ------------- | ----------------------------------------------------------------- |
| Framework     | TanStack Start (React 19, file-based routing, server functions)   |
| Server output | Nitro (node) → `.output/server/index.mjs`                         |
| DB            | SQLite (one file) via `@libsql/client`                            |
| ORM           | Drizzle (`drizzle-orm/libsql`, `drizzle-kit`)                     |
| Data fetching | TanStack Query (SSR-integrated via `router-ssr-query`)            |
| Forms         | TanStack Form + Zod                                               |
| UI            | shadcn/ui (`base-nova`, **Base UI** engine) + Tailwind v4, lucide |
| Tooling       | pnpm, ESLint (`@tanstack/eslint-config`), Prettier, TypeScript    |

### UI: always use shadcn components

**Use a shadcn component whenever one fits** — never hand-roll a styled
`div`/`span`/`button` for something shadcn provides. Follow the shadcn skill
(`.claude/skills/shadcn/`) and its rules; the ones that bite most here:

- It's the **Base UI** flavour: custom triggers use `render={<Button />}`
  (not `asChild`); a `Button` rendering an `<a>` needs `nativeButton={false}`;
  `Select` takes an `items` prop and a `{ value: null }` item for "none".
- Check `src/components/ui/` before adding; add with
  `pnpm dlx shadcn@latest add <name>`; read `pnpm dlx shadcn@latest docs <name>`
  when unsure of an API.
- Forms: `FieldGroup` + `Field` + `FieldLabel` + `FieldError`, with
  `data-invalid` on `Field` and `aria-invalid` on the control.
- Icons inside `Button` get `data-icon="inline-start|inline-end"`, no size
  classes. Semantic colour tokens only (`text-muted-foreground`, …), `gap-*`
  not `space-*`, `className` for layout only.
- Toasts: `toast.add({ title, type })` from `@/components/ui/toast` (Base UI
  toast manager; `<Toaster>` wraps the app in `__root.tsx`).
- `src/components/ui/**` is vendored shadcn source — excluded from ESLint and
  Prettier. Don't edit it for app-specific styling; compose around it.

## Data model (`src/db/schema.ts`)

- `folders` — `id`, `name`, `parentId` (self-reference, `null` = root),
  `position`, timestamps. Deleting a folder cascades to its subfolders and
  links.
- `links` — `id`, `title`, `url`, `description?`, `folderId` (`null` = root),
  `position`, `favoritePosition?` (set = favourite; orders the favourites),
  timestamps.
- `position` orders siblings within the same parent (folders and links are
  ordered separately; folders render before links, like a file explorer).

The dataset is small (one person's bookmarks), so the app loads **all
folders and links in one server function** and builds the tree client-side.
Don't add pagination or per-folder lazy loading unless it's actually slow.

## Architecture conventions

- **Server functions**: `src/server/bookmarks.functions.ts` holds the
  `createServerFn` RPCs + `treeQueryOptions` (safe to import anywhere);
  `src/server/bookmarks.server.ts` holds the Drizzle queries (server-only —
  import it only from `*.functions.ts`). Never import `@/db` from a component.
- Moving a folder is guarded server-side against cycles (into itself or a
  descendant); the folder picker also hides those options.
- Use `.validator(zodSchema)` on server functions — **not** the deprecated
  `.inputValidator()` (verified deprecated in the installed version).
- **Zod schemas are shared**: define them once in `src/lib/schemas.ts` and
  use the same schema for the TanStack Form validator and the server-function
  validator.
- **Query keys / options** live next to the server functions as
  `queryOptions(...)` factories (e.g. `treeQueryOptions`). Routes prefetch
  with `context.queryClient.ensureQueryData(...)` in `loader`; components
  read with `useSuspenseQuery`. Mutations invalidate the tree query.
- A route's `loader` must come **before** `component`/`head` in the options
  object or `Route.useLoaderData()` types collapse.
- Tree helpers (`buildTree`, `filterTree`, `flattenFolders`) are pure
  functions in `src/lib/tree.ts`. UI lives in `src/components/bookmarks/`.
- In `beforeLoad`/loaders, always `throw redirect(...)`, never call it bare.
- Imports: `@/…` alias for `src/` (tsconfig `paths`, resolved by Vite via
  `tsconfigPaths`). Files run outside Vite (e.g.
  `drizzle.config.ts`) must use relative imports.
- SQLite: `src/db/index.ts` opens `DATABASE_PATH` (default
  `data/bookmarks.db`, created if missing) and runs the `drizzle/`
  migrations on startup — no manual DB step on deploy. Schema change: edit
  `schema.ts`, `pnpm db:generate`, commit the migration.
- The running server locks `.output`'s native libsql binary, so
  `pnpm build` fails with `EPERM` while it's up: run `scripts/stop.ps1`
  first, then `install-startup.ps1` after.
- Don't rely on foreign-key cascades: SQLite needs a per-connection pragma
  that libsql doesn't keep, so `removeFolder` deletes descendants itself.
  Keep deletes of anything with children explicit like that.
- Name/title tie-breaks sort `collate nocase` (case-insensitive).
- No auth. The server listens on all interfaces, so it's reachable from the
  LAN. This is deliberate (the owner accepted it); don't change it
  unasked.

## UI

Single page (`src/routes/index.tsx`): header (New folder, New link, then a
`ButtonGroup` of import/export menu, shortcuts help and theme menu; below
500px the buttons wrap under the title), search box, then the tree. Folders
are `Collapsible` rows (expanded state persisted in localStorage), links
open in a new tab, and each row has a hover `DropdownMenu` (new
link/subfolder here, edit/move, copy URL, move up/down, delete). Create/edit
happens in a `Dialog`, delete confirms in an `AlertDialog`. Theme:
Light/Dark/System dropdown (`src/lib/theme.ts`; an inline head script
applies it before first paint).

**Import/export** (`src/components/bookmarks/import-export-menu.tsx`): JSON
file `{ format: 1, folders: [{ name, folders, links }], links: [{ title, url,
description?, favorite? }] }` — nested, no ids; `favorite` is the 1–9 rank. Export is built client-side
(`toBookmarksFile` in `src/lib/tree.ts`); import is validated by
`bookmarksFile` (client and server) and **appended** after the existing
top-level items in one transaction — it never replaces or dedupes.
Imported favourites go after the existing ones; any past the 9th are
imported as plain links.

**Favourites**: at most 9 (`MAX_FAVORITES`, enforced server-side in
`setFavorite`). Listed above the search (`favorites-list.tsx`), each row
with the same hover menu as in the tree (`LinkMenu`); toggled from the link's row menu or `f`
(`src/hooks/use-favorite.ts`, optimistic).

**Drag and drop** (`src/components/bookmarks/tree-dnd.tsx`) is native HTML5
DnD, no library. Folders and links are ordered separately (folders always
first), so a folder drops before/after a folder or inside a folder; a link
drops before/after a link or inside a folder; a dashed zone at the bottom
moves to the top level. `resolveMove` turns a drop into
`{ kind, id, parentId, index }` (or null for invalid/no-op); the
`moveBookmark` server fn rewrites sibling positions in a transaction and
`useMoveBookmark` applies it optimistically. Disabled while searching.

**Keyboard**

- Global (`src/lib/shortcuts.ts`): `Ctrl+K` search, `Ctrl+B` new link,
  `Ctrl+G` new folder (⌘ on macOS). Avoid browser-reserved combos
  (Ctrl+L/N/T/W/F) when adding more.
- Tree, vim-style (`src/hooks/use-tree-keyboard.ts`): `j/k` down/up, `h`
  collapse / go to parent, `l` expand / into first child, `H` collapse all,
  `gg`/`G` first/last, `n`/`N` next/previous visible link (wraps),
  `o`/`Enter` open or toggle, `f` add/remove favourite (hovered row, else
  focused), `1`–`9` open that favourite in a new tab, `r` edit, `d` delete (hovered row, else
  focused; confirms first), `/` search, `q` clear the search. Arrow keys
  mirror hjkl. `x` cuts a link, `p` pastes it into the focused folder /
  after the focused link (top level if nothing focused), `Esc` cancels
  (`src/hooks/use-cut-link.ts`; sticky toast while cut). Rows opt in with
  `data-tree-item`, `data-kind`, `data-id`, `data-parent-id` on their
  focusable element, and `data-tree-row` on the hover area (row + its menu).
- `?` (or the header keyboard button) opens the shortcuts help
  (`src/components/bookmarks/shortcuts-dialog.tsx`) — keep its list in sync
  when adding or changing a shortcut.
- In search: `Enter`/`↓` jumps to the first row, `Esc` clears.
- All of it is off while a dialog is open or while typing in a field.

## Commands

```bash
pnpm dev            # dev server on http://localhost:3000
pnpm build          # production build -> .output/
pnpm start          # run the built server (reads .env.local; PORT env, default 3000)
pnpm db:generate    # write a migration after editing schema.ts
pnpm db:migrate     # apply migrations (the server also does this on start)
pnpm db:studio      # browse data
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm format         # prettier --write + eslint --fix
pnpm generate-routes
pnpm version:patch  # / version:minor / version:major — bump, commit, tag vX.Y.Z
```

After any nontrivial change run `pnpm typecheck && pnpm lint && pnpm build`.
Treat `eslint --fix` output as untrusted — re-run `typecheck` afterwards.

## Environment

See `.env.example`. Nothing is required; overrides (`DATABASE_PATH`,
`VITE_APP_NAME`) go in `.env.local` (gitignored). Don't put `PORT` in
`.env.local` — Vite picks it up and moves the dev server off 3000.
Production uses port 8008: on Windows it's set by `scripts/start.ps1`, run
at logon by a Scheduled Task (`scripts/install-startup.ps1` /
`uninstall-startup.ps1` / `stop.ps1`); in Docker by the `Dockerfile` (data
in the `/data` volume, runs as uid 1000). `.github/workflows/docker.yml`
publishes the image to `ghcr.io/liteblusky/bookmarks` on every `v*` tag
(amd64 + arm64). Keep `.dockerignore` excluding `data/` and `.env*` so
personal data never lands in an image. Deploy steps for Docker, Windows,
Linux, macOS and NixOS are in the README — keep them in sync when changing
any of this.

## Skill loading (TanStack Intent)

Before substantial work on a TanStack library, check for version-matched
guidance shipped with the installed package:

```bash
pnpm dlx @tanstack/intent@latest list
pnpm dlx @tanstack/intent@latest load <package>#<skill>
```
