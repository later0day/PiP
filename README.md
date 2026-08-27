# PiP

A working set of the [Pi agent harness](https://pi.dev) plus the pi
extensions/services developed and run against it locally.

## Layout

- **pi/** — the Pi agent harness monorepo (clone of
  [earendil-works/pi](https://github.com/earendil-works/pi)). Provides the
  `pi` coding-agent CLI and its packages. The locally-built runtime lives at
  `pi/packages/coding-agent/dist/bundle/cli.js`.
- **plugins/** — pi extensions and the pi-web UI service. See
  [plugins/README.md](plugins/README.md) for per-package detail.
  - `pi-qwen-rotate/` — locally-developed provider extension (Qwen multi-key
    rotation).
  - `pi-web-access/`, `pi-subagents/`, `pi-mcp-adapter/` — pi extension
    packages loaded into the CLI.
  - `pi-web/` — standalone web UI service (fastify + vite + node-pty) carrying
    a local React 18 rewrite (`src/client-react/`) with a full-Chinese UI.

Upstream origins and the commit each vendored clone was flattened from are
recorded in [`NESTED_REPOS_ORIGINS.txt`](NESTED_REPOS_ORIGINS.txt).

## Build & run

### Pi runtime

The global `pi` may be too old (plugins need >= 0.84). Build the repo copy:

```bash
cd pi
npm install && npm run build
# runtime CLI: pi/packages/coding-agent/dist/bundle/cli.js
```

### pi extensions (pi-web-access / pi-subagents / pi-mcp-adapter / pi-qwen-rotate)

Each needs its own `npm install` first, then is mounted into project settings
via a local path:

```bash
cd plugins/<name> && npm install     # pi-mcp-adapter also runs a prepare build
node <pi-cli.js> install -l --approve /root/PiP/plugins/<name>
```

`-l` = project scope, `--approve` = trust the project (local extensions run
arbitrary code).

### pi-web UI service

Needs **two processes** — the gateway and a session daemon:

```bash
cd plugins/pi-web
npm install --allow-scripts=node-pty
npm run build

node dist/server/sessiond.js      # session daemon (unix socket)
node dist/server/index.js         # gateway → http://127.0.0.1:8504
```

Without the daemon the gateway reports
`Session daemon unavailable: connect ENOENT /root/.pi-web/sessiond.sock`.
Verify both are up:

```bash
curl "http://127.0.0.1:8504/api/sessions?cwd=/root/PiP/pi"   # → 200 []
```

The React rewrite builds via `npm run build:react` (config
`vite.react.config.ts`) and serves from the same `dist/client` seam.

Once built, `plugins/pi-web/pi-web.sh` manages both processes as one unit:

```bash
cd plugins/pi-web
./pi-web.sh start     # start sessiond + gateway, wait until socket + HTTP are ready
./pi-web.sh status    # show PIDs, socket, and HTTP code
./pi-web.sh stop      # stop both
./pi-web.sh restart   # stop then start
./pi-web.sh logs      # tail both log files
```

## Secrets

Real API keys live **only** in `plugins/pi-qwen-rotate/qwen-rotate.config.json`,
which is git-ignored and never committed. Copy
`qwen-rotate.config.example.json` to that path and fill in keys, or set the
`QWEN_ROTATE_KEYS` / `QWEN_ROTATE_CONFIG` env vars.
