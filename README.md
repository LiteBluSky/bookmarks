# Bookmarks

A personal bookmark manager: links organised into folders and subfolders,
shown as a file tree. No accounts, no sync. It runs on your own Windows
machine, starts at logon and serves on **http://localhost:8008**.

Stack: TanStack Start (React 19) on Nitro/Node, SQLite via Drizzle, shadcn/ui
and Tailwind. See [`CLAUDE.md`](./CLAUDE.md) for architecture and
conventions and [`TASKS.md`](./TASKS.md) for the work log.

## Set up on a new machine

### 1. Install prerequisites

- **Node.js 22.9+** (needs `--env-file-if-exists`): https://nodejs.org
- **pnpm**: `npm install -g pnpm`
- **Git**

No database server is needed: the data lives in a single SQLite file.

### 2. Get the code and build it

```powershell
git clone <repo-url> bookmarks
cd bookmarks
pnpm install
pnpm build
```

There's nothing to configure. The database, `data\bookmarks.db`, is created
with its tables the first time the server starts. To change a default (the
database location, or the name shown in the app via `VITE_APP_NAME`), copy
`.env.example` to `.env.local` and edit it. Don't put `PORT` in `.env.local`
(it would move the dev server).

If you use Claude Code here, link its copy of the shadcn skill (a junction
holds an absolute path, so it isn't committed):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
New-Item -ItemType Junction -Path .claude\skills\shadcn -Target (Resolve-Path .agents\skills\shadcn).Path
```

### 3. Install the startup task

```powershell
.\scripts\install-startup.ps1
```

This registers a Windows Scheduled Task called **Bookmarks** that runs
`scripts\start.ps1` each time you log on, and starts it straight away. It
runs under `conhost --headless`, so there is **no window** to close by
accident. Open http://localhost:8008.

No admin rights are needed. If PowerShell refuses to run the script, run it
once with
`powershell -ExecutionPolicy Bypass -File .\scripts\install-startup.ps1`.

## How it runs

- `scripts\start.ps1` sets `PORT=8008`, kills any server a previous run left
  behind, and runs `.output\server\index.mjs` with `.env.local` loaded. If
  the server exits it restarts it after 5 seconds. Ending `node.exe` in
  Task Manager therefore just restarts it; to really stop it, use
  `scripts\stop.ps1` or `uninstall-startup.ps1`.
- Don't use plain `powershell -WindowStyle Hidden` as the task action: when
  Windows Terminal is the default terminal it opens a visible window anyway,
  and closing that window kills the server.
- Output goes to `logs\server.log`, which is cleared each time the task
  starts.
- The server listens on **all interfaces**, so other devices on your network
  can reach it at `http://<this-pc-ip>:8008`. There's no login, so anyone on
  the network can edit your bookmarks. If Windows shows a firewall prompt
  for Node.js the first time, allow it for the networks you want. To open
  the port explicitly (admin PowerShell):

  ```powershell
  New-NetFirewallRule -DisplayName 'Bookmarks 8008' -Direction Inbound -Protocol TCP -LocalPort 8008 -Action Allow
  ```

  To limit it to this machine only, add `$env:HOST = '127.0.0.1'` next to
  `PORT` in `scripts\start.ps1`.

- It uses about 70 MB of RAM and effectively no CPU when idle.

## Day-to-day

| Task                              | Command                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Deploy changes (after `git pull`) | `pnpm install; .\scripts\stop.ps1; pnpm build; .\scripts\install-startup.ps1` |
| Restart the server                | `.\scripts\install-startup.ps1`                                               |
| Check it's running                | `Get-ScheduledTask Bookmarks` / open `logs\server.log`                        |
| Stop until next logon             | `.\scripts\stop.ps1`                                                          |
| Start again after `stop.ps1`      | `Start-ScheduledTask Bookmarks`                                               |
| Stop and remove from startup      | `.\scripts\uninstall-startup.ps1`                                             |
| Back up the data                  | ⋮ menu → Export JSON, or copy `data\bookmarks.db`                             |
| Restore a backup                  | ⋮ menu → Import JSON (adds to what's there)                                   |

Schema changes are applied automatically when the server starts, so a
deploy never needs a separate database step. Stop the server before
`pnpm build`: while it runs, Windows keeps the SQLite library in `.output`
locked and the build fails with `EPERM`. Likewise, copy `data\bookmarks.db`
only while the server is stopped.

Re-running `install-startup.ps1` replaces the task and restarts the server,
which is what picks up a new build. `Stop-ScheduledTask` on its own doesn't
stop the server (it only ends the `conhost` wrapper); use `stop.ps1`.

To move your bookmarks to a new machine, either Export JSON on the old one
and Import it on the new one, or copy `data\bookmarks.db` across before the
new server's first start.

## Development

```bash
pnpm dev          # http://localhost:3000, hot reload (separate from the 8008 instance)
pnpm typecheck
pnpm lint
pnpm format
pnpm db:studio    # browse the data
pnpm db:generate  # after editing src/db/schema.ts: write a migration (commit it)
```

After any nontrivial change: `pnpm typecheck && pnpm lint && pnpm build`.

### Releasing a version

With a clean working tree:

```bash
pnpm version:patch   # 0.1.0 -> 0.1.1  (fixes)
pnpm version:minor   # 0.1.0 -> 0.2.0  (new features)
pnpm version:major   # 0.1.0 -> 1.0.0  (breaking changes)
git push --follow-tags
```

Each bumps `version` in `package.json`, commits it as `Release vX.Y.Z` and
tags it `vX.Y.Z`.
