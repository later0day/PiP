# 01 · pi-coding-agent（CLI / 产品层）深潜

> 目录：`packages/coding-agent` · 二进制：`pi` · 版本：v0.84.3
> 角色：把 agent-core / ai / tui / 远程三角 / 存储后端组装成一个可用的终端编码 Agent。
> 源码规模：`src/core` 约 18.7K 行（不含子目录），单文件之最 `agent-session.ts` 3495 行、`package-manager.ts` 2699 行、`session-manager.ts` 1715 行、`settings-manager.ts` 1347 行。

---

## 0. 顶层结构（`src/`）

```
src/
├── main.ts / index.ts / cli.ts        # 入口
├── config.ts                          # ~/.pi/agent 目录、路径解析
├── migrations.ts                      # 配置/设置迁移
├── package-manager-cli.ts             # pi install/remove/update/list/config
├── rpc-entry.ts                       # rpc 模式入口
├── core/                              # 运行时核心（见 §1）
├── modes/                             # 运行模式：print/json/rpc/interactive（见 §2）
├── cli/                               # 命令行参数、启动 UI、鉴权检查（见 §3）
├── client/                            # 远程会话客户端封装（见 §4）
├── server/                            # create-harness（服务端组装，见 §4）
├── bun/                               # bun 运行时适配（cli/bedrock/sandbox-env）
├── extensions/                        # 内置扩展：llama（见 §5）
└── utils/                             # 工具库（图像/clipboard/git/shell/…，见 §6）
```

---

## 1. core/ —— 运行时核心（二级模块）

### 1.1 会话核心：`agent-session.ts`（3495 行）
- **AgentSession** 是所有运行模式（interactive/print/rpc）共享的核心抽象。文件头注释明确其职责：
  Agent 状态访问、带自动持久化的事件订阅、模型与思考级别管理、compaction（手动+自动）、bash 执行、会话切换与分支。
- 模式在其上叠加各自的 I/O 层。它桥接 `pi-agent-core`（Agent/AgentEvent/AgentState/AgentTool）与 `pi-ai/compat`（流式、重试、上下文溢出判断、思考级别裁剪）。
- 关键协作：`isContextOverflow` / `isRecoverableLength` / `isRetryableAssistantError` / `RetryCallbacks` / `streamSimple` / `resetApiProviders` —— 说明"生成恢复与重试"策略在这里落地。
- 拆分辅助：`agent-session-runtime.ts`（441 行）、`agent-session-services.ts`（221 行）承载运行时装配与服务注入。

### 1.2 会话持久化：`session-manager.ts`（1715 行）
- JSONL 会话文件的读写、树形结构、fork/clone、tree 导航、分支摘要收集。
- 配套：`session-cwd.ts`（按工作目录组织会话）、`session-export.ts`、`messages.ts`（`convertToLlm` 消息转换）。

### 1.3 SDK：`sdk.ts`（410 行）
- 面向嵌入式使用（Node 应用中内嵌 pi）。`createAgentSession` 装配：ModelRuntime、ResourceLoader、SessionManager、SettingsManager、工具集。
- 保留 pre-0.81 回退：`setDefaultStreamFn(streamSimple)`，让不传 `streamFn` 的旧扩展仍可用；核心 agent 保持 provider 无关（不 import pi-ai/compat）。

### 1.4 资源加载：`resource-loader.ts`（1097 行）
- 发现并加载 extensions / skills / prompt templates / themes / context files，遵守 project trust 分阶段加载（信任前只加载 context files + 用户/全局扩展 + CLI `-e`）。

### 1.5 模型子系统（model-*）
- `model-runtime.ts`（787）：模型/鉴权运行时（auth.json + models.json）。
- `model-resolver.ts`（782）：`findInitialModel`，模型模式匹配（`provider/id:thinking`）。
- `model-config.ts`（300）、`model-registry.ts`（157）、`models-store.ts`（147）、`remote-catalog-provider.ts`（137）：模型目录、注册、远程目录刷新。
- provider 组装：`provider-composer.ts`（572）、`provider-attribution.ts`（97，合并归因头）、`runtime-credentials.ts`。

### 1.6 系统提示：`system-prompt.ts`（169 行）
- 默认系统提示构建，支持 `.pi/SYSTEM.md`（项目）/`~/.pi/agent/SYSTEM.md`（全局）替换，`APPEND_SYSTEM.md` 追加，CLI `--system-prompt`/`--append-system-prompt`。

### 1.7 信任与安全
- `trust-manager.ts`（245）+ `project-trust.ts`（96）：project trust 决策，`~/.pi/agent/trust.json`。信任后才加载项目本地设置、`.pi` 资源、执行项目扩展。
- `output-guard.ts`（108）：输出防护。

### 1.8 设置：`settings-manager.ts`（1347 行）
- 全局/项目分层设置合并，`settings-diagnostics.ts`、`resolve-config-value.ts`（287）。

### 1.9 包管理：`package-manager.ts`（2699 行）+ `pi-manifest.ts`
- npm / git / 本地三类包源，安装到 `~/.pi/agent/{npm,git}` 或 `.pi/`，pinned refs 协调，包过滤，去重（global vs project）。

### 1.10 core/tools —— 内置工具（二级模块）
默认工具目录，每个工具用"`createXTool` + `createXToolDefinition`"工厂模式，input/details/options 类型齐全：
- `read.ts` / `bash.ts` / `edit.ts`（+ `edit-diff.ts`）/ `write.ts` —— 4 类核心工具；
- `grep.ts` / `find.ts` / `ls.ts` —— 检索导航；`powershell.ts` —— Windows；
- `file-mutation-queue.ts`（`withFileMutationQueue`，写操作串行化）、`output-accumulator.ts`、`truncate.ts`、`path-utils.ts`、`render-utils.ts`、`tool-definition-wrapper.ts`。
- `createCodingTools` / `createReadOnlyTools` 组合导出，支持 `--tools` 白名单与 `--no-builtin-tools`。

### 1.11 core/compaction —— 上下文压缩（二级模块）
- `compaction.ts`：`compact`、`calculateContextTokens`、`CompactionPreparation/Result` —— 手动 `/compact` 与自动阈值/溢出压缩。
- `branch-summarization.ts`：`collectEntriesForBranchSummary` —— `/tree` 中废弃分支的摘要。
- `utils.ts` / `index.ts`。

### 1.12 core/extensions —— 扩展宿主（二级模块）
- `types.ts`（约 1769 行）：扩展 API 类型（工具、命令、事件、自定义 UI）。
- `loader.ts` / `runner.ts`（ExtensionRunner）/ `wrapper.ts` / `index.ts`。

### 1.13 core/export-html —— 会话导出（二级模块）
- `index.ts` + `ansi-to-html.ts` + `tool-renderer.ts` + `template.{html,css,js}` + `vendor/` —— `/export`、`/share`（GitHub gist）。

### 1.14 其他 core 支撑
- `event-bus.ts`、`http-dispatcher.ts`、`bash-executor.ts`（`executeBashWithOperations`）、`exec.ts`、`keybindings.ts`（396）、`prompt-templates.ts`（285）、`skills.ts`（507）、`slash-commands.ts`、`footer-data-provider.ts`（388）、`cache-stats.ts`、`usage-totals.ts`、`telemetry.ts`、`timings.ts`、`auth-storage.ts`（506）、`auth-guidance.ts`、`diagnostics.ts`、`defaults.ts`、`experimental.ts`。

---

## 2. modes/ —— 运行模式（二级模块）

| 模式 | 文件 | 说明 |
|---|---|---|
| print | `print-mode.ts` | `-p`，打印后退出，可合并 stdin |
| json | `json-event.ts` | `--mode json`，事件以 JSON lines 输出 |
| rpc | `rpc/`（`rpc-mode.ts`、`rpc-client.ts`、`rpc-types.ts`、`jsonl.ts`） | stdin/stdout JSONL RPC |
| interactive | `interactive/` | 默认交互式 TUI |

### interactive/ 二级细分
- `interactive-mode.ts`：主循环。
- `components/`：**43 个 TUI 组件**，如 `assistant-message`、`user-message`、`tool-execution`、`bash-execution`、`diff`、`footer`、`model-selector`、`theme-selector`、`thinking-selector`、`settings-selector`/`settings-submenu`、`session-selector`(+search)、`tree-selector`、`trust-selector`、`login-dialog`、`oauth-selector`、`first-time-setup`、`compaction-summary-message`、`branch-summary-message`、`skill-invocation-message`、`markdown-transform`、`mermaid`、`status-indicator` 等。
- `theme/`：主题系统；`assets/`；`external-editor.ts`（Ctrl+G）；`model-catalog-refresh.ts`；`model-search.ts`；`session-share.ts`。

---

## 3. cli/ —— 命令行装配（二级模块）
- `args.ts`（参数解析，对应 usage.md 的全部 flag）、`startup-ui.ts`、`auth-check.ts` / `auth-command.ts` / `credential-print.ts`、`config-selector.ts`、`project-trust.ts`、`session-picker.ts`、`file-processor.ts`（`@file` 参数、图片）、`initial-message.ts`、`list-models.ts`、`experimental/`。

## 4. client/ + server/ —— 内嵌远程能力
- `client/`：`remote-session.ts`、`transcript.ts` —— 消费 pi-client 连接远程会话。
- `server/create-harness.ts` —— 组装服务端 harness（消费 pi-server）。

## 5. extensions/llama —— 内置 llama.cpp 扩展
- `/llama` 命令：下载、加载、卸载本地 llama.cpp 路由模型。

## 6. utils/ —— 工具库（二级模块）
图像处理链（`image-convert`/`image-process`/`image-resize*`/`exif-orientation`/`photon`）、clipboard（`clipboard`/`clipboard-image`/`clipboard-native`）、`git.ts`、`shell.ts`、`child-process.ts`、`fs-watch.ts`、`frontmatter.ts`、`syntax-highlight.ts`/`highlight-js.d.ts`、`open-browser.ts`、`version-check.ts`、`windows-self-update.ts`、`management-http.ts`、`pi-user-agent.ts`、`tools-manager.ts`、`tool-result-images.ts`、`mime.ts`、`text.ts`、`ansi.ts`、`html.ts`、`json.ts`、`paths.ts`、`abort.ts`、`sleep.ts`、`deprecation.ts`、`changelog.ts`。

---

## 7. 设计亮点与权衡（本包）

**亮点**
- `AgentSession` 单一核心抽象，三模式共享，避免逻辑分叉。
- 工具全部"工厂 + 类型三件套（Input/Details/Options）"，可组合、可白名单、可注入自定义 operations（利于 sandbox/远程执行）。
- 分阶段 project trust 加载，安全边界前置。
- SDK 保留向后兼容回退（`setDefaultStreamFn`），核心保持 provider 无关。

**权衡**
- `agent-session.ts`（3495）/`package-manager.ts`（2699）为超大文件，维护与阅读成本高。
- 交互层 43 个组件 + 图像处理链使产品层体量远超"极小内核"叙事——极简体现在**内核工具面**，而非 CLI 代码量。
