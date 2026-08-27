# Pi 项目全景分析 · 总览

> 版本：v0.84.3（lockstep 统一版本）· 许可：MIT · 发布命名空间：`@earendil-works/*`
> 运行时：Node ≥ 22.19，全 ESM，`tsgo` 构建 · 结构：npm workspaces monorepo
> 本文档为总览，各一级板块的二级模块深潜见 `01`–`06` 分册。

---

## 1. 一句话定位

Pi 是一个**极简、可自我扩展的终端编码 Agent（coding harness）**。它的设计哲学是"**内核极小，一切外推**"：
默认只内置 4 类工具（read / bash / edit / write，外加 grep/find/ls 与 Windows 的 powershell），
把 MCP、子 agent、权限弹窗、plan 模式、待办清单、后台 bash 等**全部排除在内核之外**，
改由扩展（extensions）、技能（skills）、提示模板（prompt templates）、主题（themes）和 pi 包（packages）来承载。

底层则由一个**可持久化、可恢复、事务化的 Agent 运行时（AgentHarness）**支撑，
使得会话可中断、可回放、可分支、可跨进程/跨机器远程续接。

---

## 2. 核心思想（Core Philosophy）

1. **Minimal core, extensible everywhere（极小内核，处处可扩展）**
   - 内核只保证"读文件、跑命令、改文件、写文件"这套最小闭环。
   - 高阶工作流不是内核特性，而是可安装/可卸载的资源。理由：内核越小越稳定、越可审计、越不会把某一种工作流固化成"唯一正确姿势"。

2. **Durable-by-construction（持久化即构造）**
   - 运行时以三类持久存储为地基：
     - **entries**：append-only 的树形事件日志（会话的唯一真相源）；
     - **registers**：可变的、带类型的 KV 寄存器（运行时状态）；
     - **usage ledger**：用量/成本账本。
   - 所有变更走**原子事务**，`seq` 严格递增；崩溃后可从"持久程序计数器"恢复。

3. **Effect sandwich（副作用三明治）**
   - 每个有副作用的步骤拆成 `intent → effect → settlement`（意图落盘 → 执行副作用 → 结算落盘）。
   - 这让"执行到一半崩溃"变得可安全恢复：重放时能判断某个副作用是否已发生、是否需重试或补偿。

4. **Neutral core + edge adapter（中立内核 + 边缘适配器）**
   - 一个反复出现的架构母题：把与环境强耦合的部分（终端渲染、传输层、存储后端、遥测后端）收敛到"边缘适配器"，
     内核对这些只依赖抽象接口（seam）。
   - 体现：TUI 渲染器多态 + 原生预编译；client/server 传输可插拔；telemetry 后端适配器；sqlite-node 的 `SqliteDatabase` seam。

5. **Transparency & control（透明与可控）**
   - 会话是本地可见的 JSONL；可 `/tree` 跳到任意历史点分支续写；可 export/share；可 fork/clone；可手动 compact。
   - 用户对上下文、工具、模型、信任边界拥有显式控制权。

---

## 3. 架构设计（Architecture）

### 3.1 依赖分层（由 root `package.json` 的 build order 反推的真实 DAG）

```
tui  ─┐
telemetry ─┐
          ├─> ai ─> agent ─┬─> sqlite-node ─┐
          │                │                ├─> protocol ─> client ─> server ─┐
          │                │                │                                 │
          └────────────────┴────────────────┴─────────────────────────────────┴─> coding-agent
```

构建顺序（`npm run build`）：
`tui → telemetry → ai → agent → session-backends/sqlite-node → protocol → client → server → coding-agent`

- **底座层**：`tui`（终端 UI）、`telemetry`（可观测性）—— 无对内依赖。
- **模型层**：`ai`（多 provider LLM API）—— 统一约 35 家 provider。
- **运行时层**：`agent`（pi-agent-core，AgentHarness 规范 + 运行时）。
- **存储后端层**：`session-backends/sqlite-node`（可选 SQLite 后端 + 搜索）。
- **远程三角**：`protocol`（CBOR 协议/编解码/schema）→ `client`（传输中立客户端）→ `server`（实验性服务端）。
- **产品层**：`coding-agent`（CLI，二进制 `pi`），把以上一切组装成可用工具。

### 3.2 远程会话三角（Remote-session triangle）

`protocol + client + server` 三件套实现"会话与前端解耦"：
- **权威快照（authoritative snapshots）** vs **瞬态进度事件（transient progress events）**分离；
- CBOR 编码 + 帧协议（framing）；
- 客户端只依赖抽象 transport（Unix socket / 自定义），可在不同宿主间搬运会话。

### 3.3 会话与持久化模型

- entries 是**树**而非线性：因此 `/tree`、`/fork`、`/clone`、分支摘要（branch summarization）都是天然操作。
- registers 承载运行时可变状态，其中 `op.state/{operationId}` 是"持久程序计数器"。
- operations 分三类：**run**（一次生成/工具循环）、**compaction**（压缩）、**navigation**（历史导航）。
- 三种存储后端：**Memory**（测试/临时）、**JSONL**（默认本地文件）、**SQLite**（可选，带搜索）。
- 标识符使用 **UUIDv7**（时间可排序）。
- **lanes**（泳道）与 **facts**（事实）用于组织并发与派生信息。

---

## 4. 完整 Roadmap（源自 `packages/agent/docs/harness.md` Part 6–8）

`harness.md`（约 2942 行）是全项目最重要的设计与路线图文档。其 Part 8 "Build order" 给出实现顺序：

### 4.1 共享切片（Shared slices 1–2）
先落地跨 track 的公共基础设施（存储抽象、事务、seq、UUIDv7 等）。

### 4.2 Track S（存储/工具轨，可并行）
- **S1**：JSONL 后端
- **S2**：SQLite 后端
- **S3**：Search（搜索）
- **S4**：Dev TUI / Client（开发期工具）

### 4.3 Track R（运行时轨，顺序推进 R1–R12）
1. **R1** 运行时外壳（runtime shell）
2. **R2** 最小 run（minimal run）
3. **R3** 生成恢复 / 重试（generation recovery / retry）
4. **R4** 工具（tools）
5. **R5** inbox / config / writes
6. **R6** abort / close / failure-drain
7. **R7** 延迟 provider 兑现（deferred provider redemption）
8. **R8** 手动 compaction
9. **R9** 阈值 / 溢出 compaction（threshold / overflow）
10. **R10** navigation（历史导航）
11. **R11** schema version / migrations
12. **R12** surface completion（对外表面收尾）

### 4.4 未来方向
- **Part 6**：面向未来的**分区 Postgres 保留策略**（partitioned Postgres retention）—— 面向大规模/长留存。
- **Part 7**：**schema 演进**通过 `storageVersion` + open 时迁移（migrate-on-open）。

---

## 5. 一级板块清单（11 包）

| 包 | 目录 | 角色 | 分册 |
|---|---|---|---|
| pi-coding-agent | `coding-agent` | CLI（二进制 `pi`），产品层组装 | `01` |
| pi-agent-core | `agent` | AgentHarness 运行时 + 规范 | `02` |
| pi-ai | `ai` | 多 provider LLM API（~35 家） | `03` |
| pi-tui | `tui` | 差分渲染终端 UI + 原生插件 | `04` |
| pi-protocol | `protocol` | CBOR 远程会话协议 v1 | `05` |
| pi-client | `client` | 传输中立客户端 | `05` |
| pi-server | `server` | 实验性服务端 | `05` |
| pi-telemetry | `telemetry` | 可观测性（后端适配器） | `06` |
| pi-session-backends/sqlite-node | `session-backends/sqlite-node` | SQLite 会话后端 + 搜索 | `06` |
| pi-evals | `evals` | 评测框架 | `06` |

> 注：`pi-client`/`pi-server`/`pi-protocol` 合并为"远程会话三角"一册（`05`）；
> `telemetry`/`sqlite-node`/`evals` 合并为"支撑设施"一册（`06`）。

---

## 6. 优点（Strengths）

1. **可审计的极小内核**：默认工具面小，安全边界清晰（project trust、sandbox），第三方包需显式信任。
2. **强持久化/可恢复**：事务化 + 副作用三明治 + 持久程序计数器，崩溃可恢复、会话可回放。
3. **树形会话**：分支/fork/clone/tree 导航/分支摘要都是一等能力，非事后补丁。
4. **传输中立的远程会话**：权威快照 vs 瞬态事件分离，前后端解耦，利于多宿主部署。
5. **多 provider 统一**：~35 家 provider 一套 API，模型/思考级别可灵活切换。
6. **扩展生态友好**：extensions/skills/prompts/themes/packages 五类资源 + 包管理 + gallery。
7. **一致的架构母题**：neutral-core + edge-adapter 贯穿多包，降低认知负担。
8. **工程化到位**：lockstep 版本、shrinkwrap/install-lock 校验、biome、tsgo、browser-smoke、evals。

## 7. 缺点 / 权衡（Tradeoffs）

1. **内核极简 = 上手需自装**：MCP、子 agent、plan、todo、后台 bash 都要自己装扩展或用外部工具。
2. **server 仍为实验性**：远程能力尚未定型。
3. **持久化模型复杂度高**：事务/寄存器/程序计数器/lanes/facts 概念多，二次开发学习曲线陡。
4. **原生插件带来构建/分发成本**：TUI native 需预编译多平台产物。
5. **安全责任转移到用户**：包"全系统访问"，需自行审阅源码，信任模型要求用户理解 project trust。
6. **文档权重集中**：`harness.md` 单文件承载过多设计与路线，阅读门槛高。

---

## 8. 阅读指引（分册地图）

- [`01-coding-agent.md`](01-coding-agent.md) —— CLI 与产品层：core（agent-session、session-manager、sdk、resource-loader、system-prompt、model-*、trust-manager、tools、compaction、extensions、export-html）、modes（print/json/rpc/interactive）、cli、client、server、bun、extensions/llama、utils。
- [`02-agent-core.md`](02-agent-core.md) —— AgentHarness 运行时与 `harness.md` 规范：存储三件套、事务、operations、compaction、navigation、schema/migrations。
- [`03-ai.md`](03-ai.md) —— 多 provider LLM API：provider 适配、模型目录生成、流式、图片模型、工具调用。
- [`04-tui.md`](04-tui.md) —— 差分渲染 TUI：tui.ts / main-screen / alt-screen、layout、components、native C 插件。
- [`05-protocol-client-server.md`](05-protocol-client-server.md) —— 远程会话三角：cbor/framing/codec/schemas、client/connection/session-handle/transport、server/sessions/snapshots/listener/protocol-bridge/transports。
- [`06-telemetry-sqlite-evals.md`](06-telemetry-sqlite-evals.md) —— 支撑设施：telemetry（index/noop/memory/conformance）、sqlite-node（repo/search-backend/migrations/storage/branch-cache/sql）、evals（pi-harness/*.eval/vitest-evals/run-evals）。
