# Bookmarks

A personal bookmark manager: links organised into folders and subfolders,
shown as a file tree. No accounts, no sync. It runs on your own Windows
machine, starts at logon and serves on **http://localhost:8008**.

Stack: TanStack Start (React 19) on Nitro/Node, MySQL via Drizzle, shadcn/ui
and Tailwind. See [`CLAUDE.md`](./CLAUDE.md) for architecture and
conventions and [`TASKS.md`](./TASKS.md) for the work log.

## Set up on a new machine

### 1. Install prerequisites

- **Node.js 22.9+** (needs `--env-file-if-exists`): https://nodejs.org
- **pnpm**: `npm install -g pnpm`
- **MySQL 8**: https://dev.mysql.com/downloads/installer/ (the default
  `MySQL80` Windows service is fine)
- **Git**

### 2. Make sure MySQL starts with Windows

In an **admin** PowerShell:

```powershell
Set-Service MySQL80 -StartupType Automatic
Start-Service MySQL80
```

(Check the service name with `Get-Service *mysql*`.)

### 3. Create the database

```sql
CREATE DATABASE bookmarks CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Use root, or create a dedicated user:

```sql
CREATE USER 'bookmarks'@'localhost' IDENTIFIED BY 'choose-a-password';
GRANT ALL PRIVILEGES ON bookmarks.* TO 'bookmarks'@'localhost';
```

### 4. Get the code and configure it

```powershell
git clone <repo-url> bookmarks
cd bookmarks
pnpm install
Copy-Item .env.example .env.local
```

Edit `.env.local` and set `DATABASE_URL`, e.g.
`mysql://bookmarks:choose-a-password@localhost:3306/bookmarks`.
Optionally set `VITE_APP_NAME` to change the name shown in the app.
Don't put `PORT` in `.env.local` (it would move the dev server).

### 5. Create the tables and build

```powershell
pnpm db:push
pnpm build
```

### 6. Install the startup task

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

| Task                              | Command                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| Deploy changes (after `git pull`) | `pnpm install; pnpm db:push; pnpm build; .\scripts\install-startup.ps1` |
| Restart the server                | `.\scripts\install-startup.ps1`                                         |
| Check it's running                | `Get-ScheduledTask Bookmarks` / open `logs\server.log`                  |
| Stop until next logon             | `.\scripts\stop.ps1`                                                    |
| Start again after `stop.ps1`      | `Start-ScheduledTask Bookmarks`                                         |
| Stop and remove from startup      | `.\scripts\uninstall-startup.ps1`                                       |
| Back up the data                  | `mysqldump -u root -p bookmarks > bookmarks.sql`                        |
| Restore a backup                  | `mysql -u root -p bookmarks < bookmarks.sql`                            |

Re-running `install-startup.ps1` replaces the task and restarts the server,
which is what picks up a new build. `Stop-ScheduledTask` on its own doesn't
stop the server (it only ends the `conhost` wrapper); use `stop.ps1`.

To move your bookmarks to a new machine, dump the database on the old one
and restore it on the new one after step 3.

## Development

```bash
pnpm dev          # http://localhost:3000, hot reload (separate from the 8008 instance)
pnpm typecheck
pnpm lint
pnpm format
pnpm db:studio    # browse the data
```

After any nontrivial change: `pnpm typecheck && pnpm lint && pnpm build`.
