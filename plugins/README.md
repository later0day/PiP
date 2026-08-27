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
- **pi-web/** — a standalone **web UI service** (fastify + vite + node-pty),
  originally cloned from jmfederico/pi-web and carrying a local React 18
  rewrite (`src/client-react/`) with a full-Chinese UI. Also vendored here.

## Running pi-web

After `npm install --allow-scripts=node-pty`, `npm run build` and
`npm run build:react`, use `pi-web/pi-web.sh` to manage the two required
processes (session daemon + gateway) as one unit:

```bash
cd pi-web
./pi-web.sh start     # start sessiond + gateway, wait until socket + HTTP are ready
./pi-web.sh status    # show PIDs, socket, and HTTP code (http://127.0.0.1:8504)
./pi-web.sh stop      # stop both
./pi-web.sh restart   # stop then start
./pi-web.sh logs      # tail both log files
```

## pi-qwen-rotate

Real API keys live only in `pi-qwen-rotate/qwen-rotate.config.json`
(git-ignored). Copy `qwen-rotate.config.example.json` to that path and fill in
keys, or set `QWEN_ROTATE_KEYS` / `QWEN_ROTATE_CONFIG` env vars.
