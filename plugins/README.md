# PiP plugins

Local working set of pi extensions/services. See the note below on layout.

## Layout

- **pi-qwen-rotate/** — locally-developed pi extension: registers a
  DashScope/Bailian (Qwen) provider and rotates across multiple API keys.
- **pi-web-access/**, **pi-subagents/**, **pi-mcp-adapter/** — pi **extension
  packages** loaded into the pi CLI, originally cloned from their upstreams
  (nicobailon). Now vendored into this repo (their nested `.git` dirs were
  removed on flattening). Original upstream URLs + the commit each was at are
  recorded in `../NESTED_REPOS_ORIGINS.txt`.
- **pi-web/** — the [agegr/pi-web](https://github.com/agegr/pi-web) web UI: a
  Next.js 16 + React 19 + Tailwind 4 single-process app (in-process
  `AgentSession`) that serves a browser front-end for pi. Vendored here (nested
  `.git` removed); `node_modules` and `.next` are git-ignored.

## pi-web

Web UI for pi (agegr/pi-web). Install deps, then run the dev server:

```bash
cd pi-web
npm install
npm run dev        # http://127.0.0.1:30141
npm run dev:lan    # 0.0.0.0:30141 (LAN-reachable)
npm run build && npm start   # production
```

Node >= 22.19 is required. `next dev` may append a generated
`BEGIN:nextjs-agent-rules` block to `AGENTS.md` — that is tooling output; do
not commit it.

The 4 `@earendil-works/*` deps in `package.json` are `file:../../pi/packages/*`
links, so `npm install` symlinks the embedded engine to the local `pi/` source
(Node resolves the full 7-package closure via realpath into pi's npm
workspace). After editing `pi/` source: `cd ../../pi && npm run build`, then
restart pi-web.

## pi-qwen-rotate

Real API keys live only in `pi-qwen-rotate/qwen-rotate.config.json`
(git-ignored). Copy `qwen-rotate.config.example.json` to that path and fill in
keys, or set `QWEN_ROTATE_KEYS` / `QWEN_ROTATE_CONFIG` env vars.
