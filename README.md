# Bookmarks

A personal bookmark manager: links organised into folders and subfolders,
shown as a file tree. No accounts, no sync. It runs on your own machine or
home server and serves on **http://localhost:8008**.

Stack: TanStack Start (React 19) on Nitro/Node, SQLite via Drizzle, shadcn/ui
and Tailwind. See [`CLAUDE.md`](./CLAUDE.md) for architecture and
conventions and [`TASKS.md`](./TASKS.md) for the work log.

There's nothing to configure and no database server: the data is one SQLite
file, created with its tables the first time the server starts. Optional
settings (see `.env.example`): `DATABASE_PATH` (where the file lives,
default `data/bookmarks.db`) and `VITE_APP_NAME` (the name shown in the app;
build-time).

> **No login.** The server listens on all interfaces, so anyone who can reach
> port 8008 can read and edit your bookmarks. Keep it on your LAN (or behind
> something like Tailscale); don't forward the port to the internet.

## Deploy

Pick one:

| Where              | How                                        |
| ------------------ | ------------------------------------------ |
| Any OS with Docker | [Docker](#docker-any-os)                   |
| Windows, no Docker | [Windows](#windows-native-starts-at-logon) |
| Linux, no Docker   | [Linux](#linux-native-systemd)             |
| macOS, no Docker   | [macOS](#macos-native-launchd)             |
| NixOS server       | [NixOS](#nixos)                            |

The native options need **Node.js 22.9+** (https://nodejs.org), **pnpm**
(`npm install -g pnpm`, or `corepack enable`) and **Git**. Always build on
the machine that runs it: `pnpm build` bundles the SQLite binary for the
current OS, so a build from one OS won't run on another.

### Docker (any OS)

Works the same on Linux, macOS (Docker Desktop / OrbStack) and Windows
(Docker Desktop).

**Build from source** (needs only Git and Docker):

```bash
git clone <repo-url> bookmarks
cd bookmarks
docker compose up -d --build        # http://localhost:8008
```

**Or use the published image** (built by GitHub Actions for every version
tag, for `linux/amd64` and `linux/arm64`):

```bash
docker run -d --name bookmarks --restart unless-stopped \
  -p 8008:8008 -v bookmarks-data:/data \
  ghcr.io/liteblusky/bookmarks:latest
```

The data lives in the `bookmarks-data` volume (`/data/bookmarks.db` inside
the container), never in the image, so rebuilding or updating keeps it.

| Task                     | Command                                                                        |
| ------------------------ | ------------------------------------------------------------------------------ |
| Update (from source)     | `git pull; docker compose up -d --build`                                       |
| Update (published image) | `docker pull ghcr.io/liteblusky/bookmarks:latest`, then recreate the container |
| Logs                     | `docker compose logs -f`                                                       |
| Stop / start             | `docker compose stop` / `docker compose start`                                 |
| Copy the database out    | `docker compose cp bookmarks:/data/bookmarks.db ./bookmarks.db`                |

To change the app name, build with
`VITE_APP_NAME="My links" docker compose up -d --build`.

### Windows (native, starts at logon)

```powershell
git clone <repo-url> bookmarks
cd bookmarks
pnpm install
pnpm build
.\scripts\install-startup.ps1
```

`install-startup.ps1` registers a Scheduled Task called **Bookmarks** that
runs `scripts\start.ps1` each time you log on, and starts it straight away.
It runs under `conhost --headless`, so there is **no window** to close by
accident. No admin rights needed; if PowerShell refuses to run the script,
use `powershell -ExecutionPolicy Bypass -File .\scripts\install-startup.ps1`.

How it runs:

- `start.ps1` sets `PORT=8008`, kills any server a previous run left behind,
  and runs `.output\server\index.mjs` with `.env.local` loaded. If the server
  exits it restarts it after 5 seconds, so ending `node.exe` in Task Manager
  just restarts it; to really stop it, use `scripts\stop.ps1`.
- Output goes to `logs\server.log`, cleared each time the task starts.
- Don't use plain `powershell -WindowStyle Hidden` as the task action: when
  Windows Terminal is the default terminal it opens a visible window anyway,
  and closing that window kills the server.
- For other devices on the network, allow Node.js at the firewall prompt, or
  (admin PowerShell)
  `New-NetFirewallRule -DisplayName 'Bookmarks 8008' -Direction Inbound -Protocol TCP -LocalPort 8008 -Action Allow`.
  To keep it to this machine only, add `$env:HOST = '127.0.0.1'` next to
  `PORT` in `start.ps1`.

| Task                              | Command                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Deploy changes (after `git pull`) | `pnpm install; .\scripts\stop.ps1; pnpm build; .\scripts\install-startup.ps1` |
| Restart the server                | `.\scripts\install-startup.ps1`                                               |
| Check it's running                | `Get-ScheduledTask Bookmarks` / open `logs\server.log`                        |
| Stop until next logon             | `.\scripts\stop.ps1`                                                          |
| Start again after `stop.ps1`      | `Start-ScheduledTask Bookmarks`                                               |
| Stop and remove from startup      | `.\scripts\uninstall-startup.ps1`                                             |

Stop the server before `pnpm build`: while it runs, Windows keeps the SQLite
library in `.output` locked and the build fails with `EPERM`.
`Stop-ScheduledTask` alone doesn't stop the server (it only ends the
`conhost` wrapper); use `stop.ps1`.

If you use Claude Code here, link its copy of the shadcn skill (a junction
holds an absolute path, so it isn't committed):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
New-Item -ItemType Junction -Path .claude\skills\shadcn -Target (Resolve-Path .agents\skills\shadcn).Path
```

### Linux (native, systemd)

```bash
git clone <repo-url> ~/bookmarks
cd ~/bookmarks
pnpm install
pnpm build
```

Create `~/.config/systemd/user/bookmarks.service` (adjust the paths;
`which node` shows the node path):

```ini
[Unit]
Description=Bookmarks
After=network.target

[Service]
WorkingDirectory=%h/bookmarks
Environment=NODE_ENV=production PORT=8008
ExecStart=/usr/bin/node --env-file-if-exists=.env.local .output/server/index.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now bookmarks
loginctl enable-linger "$USER"   # keep it running when you're logged out
```

Update: `git pull && pnpm install && pnpm build && systemctl --user restart bookmarks`.
Logs: `journalctl --user -u bookmarks -f`.

### macOS (native, launchd)

```bash
git clone <repo-url> ~/bookmarks
cd ~/bookmarks
pnpm install
pnpm build
```

Create `~/Library/LaunchAgents/local.bookmarks.plist` (replace `YOU`, and
use the node path from `which node` — `/opt/homebrew/bin/node` on Apple
Silicon with Homebrew):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>local.bookmarks</string>
  <key>WorkingDirectory</key><string>/Users/YOU/bookmarks</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>--env-file-if-exists=.env.local</string>
    <string>.output/server/index.mjs</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key><string>production</string>
    <key>PORT</key><string>8008</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/Users/YOU/bookmarks/logs/server.log</string>
  <key>StandardErrorPath</key><string>/Users/YOU/bookmarks/logs/server.log</string>
</dict>
</plist>
```

```bash
mkdir -p ~/bookmarks/logs
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.bookmarks.plist
```

It starts at login and restarts if it exits. Update:
`git pull && pnpm install && pnpm build && launchctl kickstart -k gui/$(id -u)/local.bookmarks`.
Remove: `launchctl bootout gui/$(id -u)/local.bookmarks`.

### NixOS

Run the published image declaratively with `virtualisation.oci-containers`
(Podman by default). In `configuration.nix`:

```nix
{
  virtualisation.oci-containers.containers.bookmarks = {
    image = "ghcr.io/liteblusky/bookmarks:latest"; # or pin, e.g. ":1.1.0"
    ports = [ "8008:8008" ];
    volumes = [ "/var/lib/bookmarks:/data" ];
    # Only if the image on GHCR is private:
    # login = {
    #   registry = "ghcr.io";
    #   username = "<github-user>";
    #   passwordFile = "/run/secrets/ghcr-token"; # a PAT with read:packages
    # };
  };

  # The container runs as the image's `node` user (uid 1000).
  systemd.tmpfiles.rules = [ "d /var/lib/bookmarks 0750 1000 1000 -" ];

  # Reach it from other devices on the LAN.
  networking.firewall.allowedTCPPorts = [ 8008 ];
}
```

Then `sudo nixos-rebuild switch`. The data is `/var/lib/bookmarks/bookmarks.db`.

- **Update**: with a pinned tag, bump it and rebuild. With `:latest`,
  `sudo podman pull ghcr.io/liteblusky/bookmarks:latest && sudo systemctl restart podman-bookmarks`.
- **Logs**: `journalctl -u podman-bookmarks -f`.
- New GHCR packages start out **private**. Either make it public (GitHub →
  your profile → Packages → bookmarks → Package settings → Change
  visibility) or use the `login` block above.

## Data: backup and moving machines

- **Backup**: ⋮ menu → **Export JSON** (works everywhere, while running), or
  copy `bookmarks.db` while the server is stopped.
- **Restore / move**: ⋮ menu → **Import JSON** on the new instance (adds to
  what's there), or put `bookmarks.db` in place before its first start
  (Docker: the `/data` volume; NixOS: `/var/lib/bookmarks/`, owned by uid
  1000).

Schema changes are applied automatically when the server starts, so an
update never needs a separate database step.

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
tags it `vX.Y.Z`. Pushing the tag runs `.github/workflows/docker.yml`, which
publishes `ghcr.io/liteblusky/bookmarks:X.Y.Z` (plus `X.Y`, `X` and
`latest`).
