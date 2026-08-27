# 02 · pi-agent-core（AgentHarness 运行时）深潜

> 目录：`packages/agent` · 包名：`@earendil-works/pi-agent-core` · 版本：v0.84.3
> 角色：项目的**运行时地基**——定义 Agent loop、可持久化/可恢复的会话 harness、工具契约、compaction/搜索/telemetry。
> 源码约 12.6K 行（不含文档）。设计规范集中在 `docs/harness.md`（约 2942 行，全项目最重要设计文档）。
> 关键特征：**provider 无关**——本包不 import `pi-ai/compat`，只依赖 `pi-ai` 的类型与 `StreamFn` 抽象。

---

## 0. 顶层结构（`src/`）

```
src/
├── agent.ts (592)          # Agent 类（对外主入口，含 QueueMode 等）
├── agent-loop.ts (796)     # 核心 agent 循环（agentLoop / runAgentLoop / continue）
├── types.ts (443)          # StreamFn、AgentContext/Event/State/Tool、执行模式等契约
├── stream-fn.ts            # 默认 streamFn 注入（get/setDefaultStreamFn）
├── node.ts / proxy.ts (370)# Node 适配 / 代理工具
├── index.ts (145)          # 统一导出面
├── harness/                # 可持久化运行时（见 §2）
└── search/                 # 会话/内容搜索（见 §5）
```

---

## 1. Agent loop 层（provider 无关的对话循环）

### 1.1 `types.ts`（443）——契约中枢
- **StreamFn** 契约（关键约定，源码注释明确）：
  - 对请求/模型/运行时错误 **不得 throw / 不得 reject**；
  - 必须返回 `AssistantMessageEventStream`；
  - 失败必须编码进流内的协议事件 + 一个 `stopReason` 为 `"error"`/`"aborted"` 且带 `errorMessage` 的终态 `AssistantMessage`。
  - `Models.streamSimple`（pi-ai）满足此形状——这是"provider 无关"的解耦点。
- **ToolExecutionMode**：`"sequential"`（逐个准备/执行/收尾）vs `"parallel"`（顺序准备、并发执行、按完成序 emit `tool_execution_end`，但结果消息按 assistant 源序 emit）。
- 定义 AgentContext / AgentEvent / AgentState / AgentTool / AgentMessage / AgentToolCall / AgentToolResult / QueueMode 以及 before/after ToolCall、PrepareNextTurn、ShouldStopAfterTurn 等生命周期钩子上下文。

### 1.2 `agent-loop.ts`（796）
- 全程以 **AgentMessage** 为工作单元，**只在 LLM 调用边界**转换为 `Message[]`（pi-ai）。
- `agentLoop(prompts, context, config, signal, streamFn)` 返回 `EventStream<AgentEvent, AgentMessage[]>`；`runAgentLoop` / `runAgentLoopContinue` 为底层驱动。
- 工具参数校验用 pi-ai 的 `validateToolArguments`。

### 1.3 `agent.ts`（592）
- `Agent` 类：对外主入口，封装模型、transport、思考预算（ThinkingBudgets）、队列模式。
- 提供默认 `convertToLlm`（仅保留 user/assistant/toolResult 三类角色进入 LLM 上下文）。

---

## 2. harness/ —— 可持久化、可恢复的运行时（核心二级模块）

这是 `harness.md` 规范的代码实现，也是全项目最精密的部分。

### 2.1 会话存储模型：`harness/session/`
- **`types.ts`（393）——Entry 树**（append-only 真相源）。核心类型：
  - `EntryBase`：`{ type, id, seq(共享递增序，读侧/存储分配), parentId(存储分配为追加泳道的叶子), timestamp }`。
  - 具体 entry：`MessageEntry`、`ModelChangeEntry`、`ThinkingLevelEntry`、`ActiveToolsEntry`、`CompactionEntry`（summary + retainedTail + tokensBefore）、`BranchSummaryEntry`、`CustomEntry`。
  - `SessionStopReason = Exclude<StopReason,"pending"> | "deferred"`——体现"延迟 provider 兑现（R7）"。
  - `IdGenerator`（UUIDv7 序列）、`ProvisionedEntry`（预留 entry）。
- **`session.ts`（299）/ `state.ts`（344）/ `context.ts`（100）**：Session 对象、状态投影、上下文装配。
- **`memory.ts`（192）**：内存后端（测试/临时）。
- **`jsonl/`**：默认本地文件后端——`repo.ts`（247，`JsonlSessionRepo`）、`storage.ts`（277）、`codec.ts`（240）、`types.ts`（`JsonlV4Header` 等，说明存储已到 v4）。
- **`testing/conformance.ts`（1016）**：**后端一致性测试套件**——任何新后端（如 SQLite）都要通过同一套 conformance，保证行为等价。这是 neutral-core + edge-adapter 的落地证据。

### 2.2 恢复协议：`harness/reducer.ts`（667）
- 从记录日志**重建/恢复**会话状态的 reducer。
- 定义 `RecordLogCorruption` 与机器可读的腐败原因枚举（`multiple_open_operations` / `unknown_operation` / `record_after_finish` / `non_consecutive_attempt` / `queue_after_abort` / `tool_call_mismatch` / `duplicate_tool_invocation` / `provisioned_entry_mismatch` / `invalid_deferred_handle` 等）。
- 关键设计：这些状态是"**单写者记录协议不可能产生**"的矛盾——restore 遇到必须**拒绝**（而非修复或续跑），区别于普通的可恢复中断（intent/result 前缀）。这正是"事务化 + 副作用三明治"的守护栏。
- 涉及记录类型：`OperationStartedRecord`、`StepAttemptRecord`、`ToolStartedRecord`、`WriteDeferredRecord`、`QueueEnqueuedRecord`、`LaneRecord`——对应 lanes / operations / deferred writes / queue。

### 2.3 harness 门面：`harness/agent-harness.ts`（508）
- `AgentHarness` 及其资源（`AgentHarnessResources`）、流选项（`AgentHarnessStreamOptions(+Patch)`）、工具（`AgentHarnessTool`）。
- **强类型错误族**（`TaggedError`）：`LaneBusy`（泳道被某 operation 占用，operationKind ∈ run/compaction/navigation）、`MissingIdentities`、`NoActiveRun`、`NoActiveOperation`、`NothingToResume`、`InvalidMessage`、`UnknownSkill`、`UnknownTemplate`——把"泳道/操作/身份"的非法状态显式化。

### 2.4 工具层：`harness/tools/`
- 与 coding-agent 平行但更底层的工具实现：`read.ts`（144）、`bash.ts`（161）、`edit.ts`（140）+`edit-diff.ts`（500）、`write.ts`（39）、`image.ts`（104）、`file-mutation-queue.ts`（56，写串行化）、`tool-context.ts`、`path-utils.ts`、`index.ts`。
- 这些是"harness 自带"的最小工具，coding-agent 的 `core/tools` 在其上做产品化封装。

### 2.5 compaction：`harness/compaction/`
- `compaction.ts`（848）：`compact` / `prepareCompaction` / `shouldCompact` / `findCutPoint` / `findTurnStartIndex` / `calculateContextTokens` / `estimateContextTokens` / `estimateTokens` / `serializeConversation` / `generateSummary(+WithUsage)` / `DEFAULT_COMPACTION_SETTINGS`——手动 + 阈值/溢出压缩（R8/R9）。
- `branch-summarization.ts`（280）：`collectEntriesForBranchSummary` / `prepareBranchEntries` / `generateBranchSummary`——`/tree` 废弃分支摘要。
- `utils.ts`（132）。

### 2.6 环境适配：`harness/env/nodejs.ts`（695）
- **ExecutionEnv 的 Node 实现**：`FileSystem` / `Shell` / `ShellExecOptions` 等抽象的具体落地。`types.ts` 定义抽象（`FileSystem`/`Shell`/`ExecutionEnv`/`FileError`/`ExecutionError`/`FileInfo`/`FileKind`），env/ 提供边缘适配——又一处 neutral-core + edge-adapter。

### 2.7 telemetry：`harness/telemetry.ts`（615）
- 定义 `HARNESS_TELEMETRY_SCHEMA` / `AI_TELEMETRY_SCHEMA` / `AGENT_TELEMETRY_SCHEMAS`，`startHarnessSpan` / `startAiSpan`。schema 定义见 `docs/telemetry-schema.md`。基于 pi-telemetry 的类型化 span/attribute 系统。

### 2.8 其他 harness 支撑
- `messages.ts`（168）、`skills.ts`（386）、`prompt-templates.ts`（262）、`system-prompt.ts`（34）、`result.ts`（63，`Result`/`ok`/`err`/`TaggedError`/`getOrThrow`）、`events.ts`（102）、`utils/shell-output.ts`（195）、`utils/truncate.ts`（350）。

---

## 3. Result / 错误处理范式
- 采用 `Result<T,E>` + `TaggedError` 的显式错误建模（`ok`/`err`/`getOrThrow`/`getOrUndefined`/`toError`），错误码全部枚举化（`FileErrorCode`/`ExecutionErrorCode`/`CompactionErrorCode`/`BranchSummaryErrorCode`）。与 reducer 的腐败枚举一致——**用类型系统把"不可能状态"编码出来**。

## 4. proxy.ts（370）
- 代理工具集，配合远程/隔离执行场景。

## 5. search/ —— 搜索（二级模块）
- `scanning.ts`（176）+ `index.ts`：会话/内容扫描搜索。对应 Roadmap Track S 的 S3（Search）。设计文档 `docs/search.md`。

---

## 6. Roadmap 对应（本包是 Roadmap 的主战场）
`docs/harness.md` Part 8 的 Track R（R1–R12）几乎全部落在本包：运行时外壳、最小 run、生成恢复/重试、工具、inbox/config/writes、abort/close/failure-drain、延迟 provider 兑现、手动/阈值/溢出 compaction、navigation、schema version/migrations、surface completion。存储 `JsonlV4Header` 印证 R11（schema version/migrations）已推进到 v4。Part 6（分区 Postgres 保留）、Part 7（migrate-on-open）为未来方向。

## 7. 设计亮点与权衡

**亮点**
- **provider 无关**：靠 `StreamFn` 契约把 LLM 供应商彻底解耦，本包不依赖 pi-ai/compat。
- **不可能状态显式拒绝**：reducer 腐败枚举 + TaggedError，恢复安全性极高。
- **后端 conformance 套件**（1016 行）保证多后端行为等价。
- **entry 树 + lanes + operations** 让分支/并发/恢复成为一等公民。

**权衡**
- 概念密度极高（entry/register/lane/operation/deferred/provisioned/程序计数器），学习曲线陡。
- `harness.md` 单文件 2942 行承载全部规范 + 路线，阅读门槛高。
- `edit-diff.ts`（500）、`compaction.ts`（848）、`env/nodejs.ts`（695）、`conformance.ts`（1016）等大文件维护成本高。
