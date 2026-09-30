# Tasks

Work top to bottom. Tick a box (`- [x]`) in the same change that completes
it. Add new tasks under the right phase instead of doing unplanned work.

## 0. Scaffold

- [x] TanStack Start scaffold (pnpm, ESLint/Prettier, Nitro node output)
- [x] TanStack Query, Form, Table add-ons; Zod
- [x] Drizzle + MySQL (`mysql2` pool, UTC session timezone)
- [x] Schema: `folders` (self-referencing) + `links`
- [x] `.env.example`, `start` / `typecheck` scripts
- [x] CLAUDE.md + this task list
- [x] shadcn (`base-nova`) installed; `@/` is the only import alias

## 1. Database

- [x] Create MySQL database (utf8mb4) and fill in `.env.local`
- [x] `pnpm db:push`
- [ ] Optional seed script (`scripts/seed.ts`) with a few nested folders/links

## 2. Server layer

- [x] `src/lib/schemas.ts` — shared Zod schemas (`folderInput`, `linkInput`,
      update variants, `byId`); http(s) URL, trimmed name, optional title
- [x] `src/server/bookmarks.functions.ts` — `getTree` + `treeQueryOptions`,
      create/update/delete for folders and links (update covers move)
- [x] `src/server/bookmarks.server.ts` — Drizzle queries; cycle guard on
      folder moves; title falls back to hostname; moved items go last
- [x] Reorder support: `moveBookmark` rewrites sibling positions (transaction)

## 3. Tree UI

- [x] `src/lib/tree.ts` — build nested tree, link counts, folder options
- [x] `/` route: loader `ensureQueryData(treeQueryOptions)`, render tree
- [x] Collapsible folder rows; remember expanded state (localStorage)
- [x] Link rows open in a new tab
- [x] Empty state (`Empty`)
- [x] Verify in a real browser: hydration, dialogs, menus, select, toasts,
      drag and drop, keyboard motions

## 4. Editing

- [x] New/edit link form (TanStack Form + shared Zod schema, auto `https://`)
- [x] New/rename folder form
- [x] Delete with confirmation (lists subfolder/link counts)
- [x] Move link/folder via folder picker (`Select`) in the edit dialog
- [x] Invalidate the tree query after mutations; toasts on success/error
- [x] Drag-and-drop reorder/move (native HTML5; optimistic)
- [x] Move up/down menu items (keyboard alternative to dragging)
- [x] Vim motions in the tree (hjkl, gg/G, o) + arrow keys
- [x] `r` on a focused row opens its edit dialog
- [x] `x` cut / `p` paste a link (sticky toast, `Esc` cancels)
- [x] `d` deletes the hovered (or focused) row, via the confirm dialog
- [x] Keyboard shortcuts help: header button + `?` (`h` stays collapse)

## 5. Find

- [x] Search box filtering titles, URLs, notes and folder names (keeps
      matching ancestors visible, forces folders open while searching)
- [x] `Ctrl+K` / `/` focus search, `Enter`/`↓` jumps into results, `Esc` clears
- [x] `q` in the tree clears the search (no need to go back to the box)
- [x] `Ctrl+B` new link, `Ctrl+G` new folder

## 6. Theme

- [x] Light/dark follows the OS
- [x] Light/Dark/System theme menu
- [x] Mobile header (<500px): buttons under the title; settings in a
      `ButtonGroup`

## 7. Run on startup (localhost only)

- [x] ~~Bind to `127.0.0.1` only~~ — decided against: LAN access is fine;
      listens on all interfaces (`HOST=127.0.0.1` restricts it if needed)
- [x] `scripts/start.ps1` — sets `PORT=8008`, runs the built server from the
      project dir, restarts it if it exits, logs to `logs/server.log`
- [x] `scripts/install-startup.ps1` — registers a Windows Scheduled Task
      (trigger: at logon, hidden window, restart on failure) that runs the
      start script; plus `scripts/uninstall-startup.ps1`
- [x] Ensure the MySQL Windows service is set to start automatically
- [x] Document the build → install flow in README

## 8. Cleanup

- [x] Trim README to project-specific content
- [x] Remove unused deps/components (`match-sorter-utils`, `react-table`,
      `tooltip`, scaffold `drizzle.svg`)
- [x] Favicon (`public/favicon.svg`)
- [x] Configurable app name (`VITE_APP_NAME`, default "Bookmarks"); neutral
      storage keys; project renamed to `bookmarks`
- [x] Versioning: `pnpm version:patch|minor|major` (bump, commit, tag)
- [x] Import/export bookmarks as JSON (header menu; import adds, never
      replaces)
- [ ] Optional: import a browser HTML bookmark file

## 9. SQLite (zero-config deploy)

- [x] Replace MySQL with SQLite (`@libsql/client`, file `data/bookmarks.db`,
      `DATABASE_PATH` override); drop `mysql2`, `db:push`/`db:pull`
- [x] Migrations in `drizzle/`, applied automatically on server start
- [x] Folder delete cascades in code (FK pragma isn't kept by libsql)
- [x] Move existing MySQL data over (JSON export → import)
- [x] README/CLAUDE.md: no DB setup; backup = Export JSON or copy the file

## 10. Deploy anywhere

- [x] `Dockerfile` (multi-stage, `node:22-slim`, non-root, `/data` volume),
      `.dockerignore`, `compose.yaml`; `packageManager` pins pnpm
- [x] GitHub Action: publish image to GHCR on `v*` tags (amd64 + arm64)
- [x] README: deploy steps for Docker, Windows, Linux (systemd), macOS
      (launchd) and NixOS (`oci-containers`)
- [ ] Optional: native Nix flake + NixOS module (no container)
