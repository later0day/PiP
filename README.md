# PiP

A working set of the [Pi agent harness](https://pi.dev) plus the pi
extensions/services developed and run against it locally.

## Layout

- **pi/** — the Pi agent harness monorepo (clone of
  [earendil-works/pi](https://github.com/earendil-works/pi)). Provides the
  `pi` coding-agent CLI and its packages. The locally-built runtime lives at
  `pi/packages/coding-agent/dist/bundle/cli.js`.
- **plugins/** — pi extensions and the pi-web UI. See
  [plugins/README.md](plugins/README.md) for per-package detail.
  - `pi-qwen-rotate/` — locally-developed provider extension (Qwen multi-key
    rotation).
  - `pi-web-access/`, `pi-subagents/`, `pi-mcp-adapter/` — pi extension
    packages loaded into the CLI.
  - `pi-web/` — the [agegr/pi-web](https://github.com/agegr/pi-web) web UI
    (Next.js 16 + React 19 + Tailwind 4), a browser front-end for pi on port
    30141. Its embedded pi engine is linked to the local `pi/` source via
    `file:` deps (see plugins/README.md).

Upstream origins and the commit each vendored clone was flattened from are
recorded in [`NESTED_REPOS_ORIGINS.txt`](NESTED_REPOS_ORIGINS.txt).

To check whether any upstream has moved past the recorded baseline:

```bash
scripts/check-upstreams.sh            # report status (git ls-remote + npm)
scripts/check-upstreams.sh --update   # rewrite recorded baselines to upstream
                                       # tips (records the move; does NOT
                                       # re-vendor the code)
```

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

### pi-web (browser UI)

A Next.js 16 app (agegr/pi-web) with an in-process pi `AgentSession`:

```bash
cd plugins/pi-web
npm install
npm run dev        # http://127.0.0.1:30141  (npm run dev:lan for 0.0.0.0)
npm run build && npm start   # production
```

Node >= 22.19 is required. `npm run dev` may append a generated
`BEGIN:nextjs-agent-rules` block to `AGENTS.md` — that is tooling output; do
not commit it.

The 4 `@earendil-works/*` deps in `plugins/pi-web/package.json` are `file:`
links to `pi/packages/*`, so the embedded engine runs the local `pi/` source.
After editing `pi/` source, rebuild it (`cd pi && npm run build`) and restart
pi-web to pick up the change.

## Secrets

Real API keys live **only** in `plugins/pi-qwen-rotate/qwen-rotate.config.json`,
which is git-ignored and never committed. Copy
`qwen-rotate.config.example.json` to that path and fill in keys, or set the
`QWEN_ROTATE_KEYS` / `QWEN_ROTATE_CONFIG` env vars.
