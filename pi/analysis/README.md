# Pi 项目全景分析 · 索引

> 对象：`/root/PiP/pi`（Pi Agent Harness，`@earendil-works/*`，v0.84.3，MIT）
> 本目录是对 Pi 项目的系统性分析：一册总览 + 六册二级模块深潜，全部基于源码而非 README。

---

## 阅读顺序

1. 先读 **[总览](00-overview.md)**：定位、核心思想、架构分层（真实依赖 DAG）、完整 Roadmap（源自 `harness.md`）、一级板块清单、优缺点。
2. 再按兴趣进入六册深潜（每册聚焦一个/一组一级板块的二级模块）。

## 分册地图

| 分册 | 覆盖包 | 主题 |
|---|---|---|
| [00 · 总览](00-overview.md) | 全部 11 包 | 定位 / 核心思想 / 架构 / Roadmap / 优缺点 |
| [01 · coding-agent](01-coding-agent.md) | `coding-agent` | CLI 与产品层：agent-session、session-manager、sdk、resource-loader、model-*、trust、tools、compaction、extensions、export-html、modes（print/json/rpc/interactive） |
| [02 · agent-core](02-agent-core.md) | `agent` | AgentHarness 运行时 + `harness.md` 规范：entries/records/facts、事务、operations（run/compaction/navigation）、reducer 腐坏枚举、StreamFn 契约 |
| [03 · ai](03-ai.md) | `ai` | 多 provider LLM API：core/compat 双入口、46 provider 工厂、39 模型目录、21 API 实现、OAuth、图像 |
| [04 · tui](04-tui.md) | `tui` | 差分渲染 TUI：内核 + main/alt 双屏、组件库、编辑器、键盘、LaTeX/图像、原生预编译插件 |
| [05 · protocol/client/server](05-protocol-client-server.md) | `protocol`+`client`+`server` | 远程会话三角：CBOR/framing/schemas、传输中立客户端、会话租约、权威快照 vs 瞬态事件、协议桥接 |
| [06 · telemetry/sqlite/evals](06-telemetry-sqlite-evals.md) | `telemetry`+`sqlite-node`+`evals` | 支撑设施：类型化可观测性、可选 SQLite 后端（storage 表对齐 harness 概念）、端到端评测框架 |

## 贯穿全项目的设计母题

- **Minimal core, extensible everywhere**：内核只保 read/bash/edit/write 最小闭环，其余全外推为资源。
- **Durable-by-construction**：entries（真相源）+ records（恢复日志）+ 事务 + 副作用三明治（intent→effect→settlement）+ 持久程序计数器。
- **Neutral core + edge adapter**：TUI 渲染器多态、client/server 传输可插拔、telemetry 后端适配、sqlite `SqliteDatabase` seam。
- **Conformance 驱动质量**：agent-core / sqlite / telemetry 用同一套一致性套件保证多实现等价。

---

> 文档基于对源码目录、接口定义、导出清单与行数的实测归纳；如源码演进，请以最新源码为准。
