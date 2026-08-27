# PiP plugins

Local working set of pi extensions/services. See the note below on layout.

## Layout

- **pi-qwen-rotate/** — locally-developed pi extension: registers a
  DashScope/Bailian (Qwen) provider and rotates across multiple API keys.
  Version-controlled in *this* repo.
- **pi-web-access/**, **pi-subagents/**, **pi-mcp-adapter/**, **pi-web/** —
  independent clones of their respective upstreams (nicobailon / jmfederico).
  Each keeps its own `.git` and is updated separately via `git pull`; they are
  git-ignored here so this repo does not vendor or fork them.

## pi-qwen-rotate

Real API keys live only in `pi-qwen-rotate/qwen-rotate.config.json`
(git-ignored). Copy `qwen-rotate.config.example.json` to that path and fill in
keys, or set `QWEN_ROTATE_KEYS` / `QWEN_ROTATE_CONFIG` env vars.
