# 06 · 支撑设施：pi-telemetry / sqlite-node / pi-evals 深潜

> 目录：`packages/{telemetry, session-backends/sqlite-node, evals}` · 版本：v0.84.3
> 三个支撑包：**可观测性、可选 SQLite 会话后端、评测框架**。
> 规模：telemetry ~0.9K 行、sqlite-node ~2.4K 行、evals（源码）若干模块。

---

## A. pi-telemetry（类型化可观测性）

目录 `packages/telemetry/src`：

```
index.ts (357)           # 核心接口 + 类型化 schema 系统
noop.ts (20)             # NOOP_TELEMETRY_CONTEXT（零开销默认）
memory.ts (219)          # InMemoryTelemetryContext（测试/内省）
testing/
├── conformance.ts (315) # 后端一致性测试套件
├── types.ts (18) / index.ts (6)
```

### A.1 index.ts —— 极简核心 + 类型化 schema（357）
- **最小接口**（无第三方依赖，OpenTelemetry 风格但自定义）：
  - `TelemetryContext.startSpan(options, callback)`——span 是回调作用域。
  - `TelemetrySpan`（继承 Context，可嵌套子 span）：`addEvent` / `setAttributes` / `setStatus`。
  - `AttributeValue` 限定为标量或标量只读数组；`SpanStatus` = ok | error。
- **类型化 schema 层**（本包精华）：`TelemetryAttributeDefinition`（带 `type` / `description` / `sensitive` / `cardinality` low|high / `values` / `examples`）、`TelemetryEventDefinition`、`TelemetrySchemaDefinition`、`defineTelemetrySchema` / `createTypedSpanStarter` / `TypedSpanStarter`。
  - 好处：span/event/attribute 在**编译期**受 schema 约束（必填/类型/取值），并携带敏感标记与基数提示——利于导出到真实后端时脱敏与降基数。
  - agent-core 正是用它定义 `HARNESS_TELEMETRY_SCHEMA` / `AI_TELEMETRY_SCHEMA`（见 `02` §2.7，schema 文档 `agent/docs/telemetry-schema.md`）。

### A.2 三种 Context 实现（neutral-core + edge-adapter）
- `noop.ts`：`NOOP_TELEMETRY_CONTEXT`——默认零开销，不采集时无成本。
- `memory.ts`：`InMemoryTelemetryContext`——采集到内存，供测试断言与本地内省（`RecordedTelemetrySpan/Event`）。
- 真实后端（OTel/自建）由使用方作为 edge adapter 注入——本包不绑定任何导出目标。

### A.3 testing/conformance.ts（315）
- **后端一致性套件**：任何 TelemetryContext 实现都要通过同一套行为测试（span 嵌套、属性、事件、状态、错误）。与 agent-core session 的 conformance、protocol 的确定性同理——**用 conformance 保证多实现等价**是全项目反复出现的质量手法。

---

## B. session-backends/sqlite-node（可选 SQLite 会话后端 + 搜索）

目录 `packages/session-backends/sqlite-node/src`：

```
index.ts (114)            # NodeSqlite* 适配：把 node:sqlite 适配到 SqliteDatabase seam
sqlite/
├── types.ts (52)         # SqliteDatabase / SqliteStatement seam（核心抽象）
├── repo.ts (953)         # SqliteSessionRepo：会话仓储主实现
├── search-backend.ts (194)  # 全文/内容搜索后端
├── branch-cache.ts (101) # 分支缓存
├── migrations.ts (49) + migrations/001_initial.sql
├── sql.ts (66)           # sql 模板标签
├── storage/              # 按 harness 概念分表的存储层（见 §B.2）
```

### B.1 SqliteDatabase seam（`sqlite/types.ts`，核心设计）
- 定义**最小数据库能力接口**，把后端与具体 SQLite 驱动解耦：
  - `SqliteDatabase`：`exec` / `prepare` / `transaction<T>(fn: () => T)`（**同步写事务，回调不得返回 promise**）/ `close`。
  - `SqliteStatement`：`run` / `get` / `all` / `iterate`。
  - `SqliteDatabaseFactory.open(path)`。
- `index.ts` 提供 `NodeSqliteStatement` / `NodeSqlite*`：把 Node 22 内置 `node:sqlite`（`DatabaseSync`）适配到该 seam——**edge adapter**。换驱动（如 better-sqlite3、WASM SQLite）只需另写一个 factory。
- 元数据类型 `SqliteSessionMetadata`（cwd/path/parentSessionId/name/metadata）对齐 agent-core 的 `SessionMetadata`。

### B.2 storage/ —— 按 harness 概念分表（二级模块，关键印证）
存储层把 `02` 的 harness 抽象**逐一映射到 SQLite 表**，证明 SQLite 后端与 JSONL 后端语义等价：

| 文件 | 对应 harness 概念 |
|---|---|
| `entries.ts`（78） | entries（append-only 树，真相源） |
| `records.ts`（95） | 记录日志（reducer 恢复用，operation/step/tool/deferred 记录） |
| `lanes.ts`（124） | lanes（泳道，并发/operation 归属） |
| `facts.ts`（64） | facts（派生/全局事实，如 session name） |
| `sessions.ts`（131） | 会话元数据 |
| `session-sequences.ts`（29） | seq 严格递增序列分配 |
| `session-stats.ts`（54） | 会话统计（token/成本等） |
| `branch-entries.ts`（174） / `branch-tips.ts`（35） | 树形分支：entry 归属与各分支叶子 |
| `writer-leases.ts`（58） | 单写者租约（与 client 会话租约呼应，保证单写者协议） |

- `repo.ts`（953）：`SqliteSessionRepo` 编排上述表，实现与 agent-core `session/testing/conformance.ts`（1016 行）等价的行为——**必须通过同一 conformance 才算合格后端**。
- `search-backend.ts`（194）：对应 Roadmap Track S 的 S2（SQLite）+ S3（Search）。

---

## C. pi-evals（评测框架）

目录 `packages/evals`：

```
src/
├── pi-harness.ts        # 把 coding-agent 包成 vitest-evals 的 Harness
├── smoke.eval.ts        # 冒烟评测
├── extensions.eval.ts   # 扩展相关评测
├── vitest-evals/        # 评测运行时（见 §C.2）
│   ├── reporter.ts / setup.ts / summary.ts / harness-table.ts / artifacts.ts
scripts/run-evals.mjs    # 评测入口脚本（root: npm run eval）
test/                    # 上述模块的单测
```

### C.1 pi-harness.ts —— 把真实 agent 接入评测
- 用 `@earendil-works/pi-coding-agent` 的 `createAgentSessionFromServices` / `createAgentSessionServices` / `ModelRuntime` / `SessionManager` / `SettingsManager` **构造真实 AgentSession**，在临时目录（`mkdtemp`）里跑。
- 实现 `vitest-evals/harness` 的 `Harness` 接口：输入是 prompt 序列（含 `reload`），产出 `SimpleHarnessResult` + `TranscriptEvent`。
- 产物 `PI_SESSION_SNAPSHOT_ARTIFACT`：把会话快照作为评测 artifact 落盘，可复查。
- `PiCodingAgentInput` 支持多轮 prompt 与 reload，贴近真实交互。

### C.2 vitest-evals/ —— 评测运行时（二级模块）
- `reporter.ts`：自定义 vitest reporter；`summary.ts`：汇总；`harness-table.ts`：结果表格；`artifacts.ts`：产物管理；`setup.ts`：环境装配。
- 基于 vitest（`vitest.config.ts` + `vitest.test.config.ts` 双配置：跑评测 vs 跑评测框架自身单测）。

### C.3 运行
- root `package.json`：`npm run eval`（→ `scripts/run-evals.mjs`）。评测直接驱动真实 CLI 内核，属于**端到端行为回归**。

---

## D. 三包的共同设计母题

1. **neutral-core + edge-adapter 的三连击**：
   - telemetry：核心接口 + noop/memory/真实后端 adapter。
   - sqlite-node：`SqliteDatabase` seam + `node:sqlite` adapter。
   - evals：`vitest-evals/harness` 抽象 + pi-harness adapter。
2. **conformance 驱动质量**：telemetry 与 sqlite/agent-core 都用一致性套件保证多实现等价。
3. **schema/概念对齐**：sqlite storage 表逐一对齐 harness 概念，telemetry schema 对齐 agent-core span 定义——不新造词汇。

## E. 优点与权衡

**优点**
- telemetry 零开销默认（noop）+ 类型化 schema（含敏感/基数标注），可观测性"可选且安全"。
- sqlite 后端与 JSONL 语义等价（同一 conformance），用户可按规模选择；storage 分表清晰映射 harness 概念。
- evals 用真实内核做端到端回归，可信度高，产物可复查。

**权衡**
- sqlite `transaction` 要求**同步写**（回调不得 async），限制了后端实现方式（利于正确性，但异步驱动不适配）。
- sqlite-node 依赖 Node 22 内置 `node:sqlite`（较新），旧运行时需另写 factory。
- evals 依赖外部 `vitest-evals` 框架 + 真实模型调用，CI 成本与外部依赖较高。
- telemetry 核心刻意极简，复杂导出/采样/批处理需使用方自行在 adapter 实现。
