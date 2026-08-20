# Private single-instance deployment runbook

This package launches Admissions Oracle as a **private demo**, not a public launch. The container port is bound to `127.0.0.1` on the VM and is reachable only through authenticated VM access such as an SSH tunnel. Keep `SUBMISSIONS_ENABLED=false`.

It is designed for one Linux VM with durable local storage. It deliberately runs one Node process against one SQLite database; do not scale the service to multiple replicas or put `data/game.db` on a network filesystem.

## What is included

- a multi-stage Node 22 container build;
- a production browser bundle with React, Three.js, icons, and JSX handled locally, plus a system font stack;
- production secret validation, security headers, liveness/readiness probes, and graceful SQLite shutdown;
- a non-root, read-only runtime container with all Linux capabilities dropped;
- a named volume for `game.db`, WAL files, and `profiles.jsonl`;
- loopback-only port publishing for SSH-tunnel access.

## VM prerequisites

1. A supported Linux VM with Docker Engine and the Docker Compose plugin.
2. SSH key access restricted to the maintainer.
3. Enough persistent disk for the image, SQLite database, and off-host backups.
4. A clone of this repository at the release commit you intend to deploy.

The current Codex machine has no Docker runtime or cloud-provider credentials, so container and VM provisioning must be run on the selected VM.

## Configure

From the repository root:

```bash
cp deploy/private.env.example deploy/private.env
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Paste the generated value after `JWT_SECRET=` in `deploy/private.env`. Do not commit or paste that file into chat, logs, screenshots, or issue trackers.

## Build and start

```bash
docker compose --env-file deploy/private.env -f deploy/compose.private.yaml build
docker compose --env-file deploy/private.env -f deploy/compose.private.yaml up -d
docker compose --env-file deploy/private.env -f deploy/compose.private.yaml ps
curl --fail http://127.0.0.1:3005/readyz
```

The readiness response must be HTTP 200 with `{"status":"ready"}` before opening a tunnel.

## Open a private tunnel

Run this on the maintainer workstation, replacing the SSH destination:

```bash
ssh -L 3005:127.0.0.1:3005 ubuntu@YOUR_VM_IP
```

While that SSH session remains open, visit `http://127.0.0.1:3005`. Do not open VM firewall port 3005 and do not change the Compose binding to `0.0.0.0`.

## Operations

View health and logs:

```bash
curl --fail http://127.0.0.1:3005/healthz
curl --fail http://127.0.0.1:3005/readyz
docker compose --env-file deploy/private.env -f deploy/compose.private.yaml logs --tail=200 app
```

Deploy a reviewed update:

```bash
git fetch origin main
git switch main
git pull --ff-only origin main
docker compose --env-file deploy/private.env -f deploy/compose.private.yaml build
docker compose --env-file deploy/private.env -f deploy/compose.private.yaml up -d
curl --fail http://127.0.0.1:3005/readyz
```

The named volume is not replaced by an image update.

## Consistent backup and restore

SQLite and its WAL must be copied only after a clean stop in this initial private-demo package:

```bash
docker compose --env-file deploy/private.env -f deploy/compose.private.yaml stop app
mkdir -p backups
docker compose --env-file deploy/private.env -f deploy/compose.private.yaml cp app:/app/data ./backups/data-YYYYMMDD-HHMMSS
docker compose --env-file deploy/private.env -f deploy/compose.private.yaml start app
curl --fail http://127.0.0.1:3005/readyz
```

Replace the timestamp placeholder before running the copy. Encrypt and copy the resulting directory off the VM, then test restoration on a separate disposable VM. A backup that has never been restored is not a verified backup.

For restoration, stop the app, inspect the exact backup directory, preserve the failed/current volume separately, copy the verified `data/` contents back into `/app/data`, start the app, and exercise login plus one complete case. Do not overwrite the only copy of either the current volume or the backup.

## Public-launch blockers

Do not expose this package directly to the Internet yet. A public launch still requires persistent IP/account registration and login rate limits, an access/abuse monitoring plan, automated off-host backups, a domain/TLS boundary, privacy/deletion contacts, and confirmation that every published case is synthetic or consented. If optional OpenRouter structuring is enabled, obtain explicit owner consent for that external data transfer and review the provider contract, retention, and deletion terms before sending post text. See `DEPLOYMENT_OPTIONS.md` and `ADMIN_INTERFACE_PLAN.md`.
