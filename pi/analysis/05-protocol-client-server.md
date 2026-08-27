# 05 · 远程会话三角：pi-protocol / pi-client / pi-server 深潜

> 目录：`packages/{protocol,client,server}` · 版本：v0.84.3
> 角色：把"会话"与"前端"解耦，实现跨进程/跨机器的远程会话续接。三者构成分层：
> **protocol（线格式）→ client（消费方）→ server（提供方）**。
> 规模：protocol ~1.2K 行、client ~1.2K 行、server ~2.3K 行。协议版本 `PROTOCOL_VERSION = 1`。

---

## A. pi-protocol（CBOR 远程会话协议 v1）

目录 `packages/protocol/src`：

```
schemas.ts (450)   # typebox schema：命令/结果/事件/快照/枚举，PROTOCOL_VERSION=1
codec.ts (172)     # 客户端/服务端消息编解码（encode/decode + 校验）
framing.ts (165)   # 帧协议：uint32 大端长度前缀
cbor/
├── encoder.ts (216) / decoder.ts (168) / options.ts (52) / index.ts   # 自带 CBOR 实现
index.ts (4)       # 统一导出
```

### A.1 schemas.ts —— 协议词汇表（450）
- 用 **typebox** 定义全部 schema（`StrictObject` 强制 `additionalProperties:false`），编译期类型 + 运行时校验双保险。
- 关键枚举与类型：
  - `PROTOCOL_VERSION = 1`（常量，握手协商用）。
  - `ThinkingLevelSchema`：off/minimal/low/medium/high/xhigh/max。
  - `SessionPhaseSchema`：idle/turn/compaction/branch_summary/retry——注释明确"**Matches AgentHarnessPhase 以免适配器维护第二套 phase 词汇**"（协议直接对齐 harness 阶段）。
  - `ModelRefSchema`（provider+id）、`ModelCostSchema`、`SessionMetadata`、`JsonValueSchema`（用 `Type.Cyclic` 定义递归 JSON）。
  - Command / CommandResult / ResultForCommand（命令-结果类型映射）、EventEnvelope / ResponseEnvelope / RequestEnvelope、ServerEvent / ServerSnapshot、ClientHello / ServerHello(+Error)。
- **核心区分**：`ServerSnapshot`（权威快照）vs `ServerEvent`（瞬态进度事件）——快照是可信的完整状态，事件是可丢弃的增量进度。

### A.2 framing.ts —— 帧协议（165）
- 每帧 = **4 字节无符号 32 位大端长度前缀 + CBOR 载荷**。
- `FRAME_HEADER_LENGTH=4`、`PAYLOAD_BLOCK_SIZE=64KB`、`DEFAULT_MAX_FRAME_LENGTH=16MB`（可配 `maxFrameLength`）。
- `encodeFrame` / `FrameDecoder` / `FrameError`，防御非法长度（超 uint32 抛错）。

### A.3 cbor/ —— 自带 CBOR 编解码（二级模块）
- 不依赖第三方 CBOR 库，自实现 `encoder.ts`（216）/`decoder.ts`（168）/`options.ts`（52）——控制体积与行为（确定性编码，利于跨语言/跨版本一致）。

### A.4 codec.ts —— 消息编解码（172）
- `encodeClientMessage` / `ClientMessageDecoder` / `encodeServerMessage` / `ServerMessageDecoder`，`ProtocolValidationError`，`isSupportedProtocolVersion`。把 schema 校验 + CBOR + framing 串起来。

---

## B. pi-client（传输中立客户端）

目录 `packages/client/src`：

```
client.ts (432)         # PiClient：连接、创建/获取会话、命令派发
connection.ts (236)     # 底层字节连接（帧解码、重连状态）
session-handle.ts (111) # SessionHandle：单会话租约句柄
state.ts (156)          # ClientState 状态机
transport.ts (18)       # Transport 抽象接口（传输中立点）
unix.ts (156)           # Unix socket 传输实现
errors.ts (56) / promise.ts (16) / types.ts (26) / index.ts (18)
```

### B.1 client.ts（432）—— 主客户端
- `PiClient`：管理连接生命周期、协议握手、命令-响应（`Command`/`CommandResult`/`ResultForCommand`）、事件订阅（`EventEnvelope`/`ServerEvent`/`ServerSnapshot`）。
- **会话租约（lease）模型**：`SessionLeaseState = active|releasing|released|invalidated`，`SessionLeaseMode`——多客户端对同一会话的所有权协商（配套错误 `PiSessionOwnershipError`/`PiSessionDetachedError`）。
- 错误族：`PiClientDisposedError`、`PiDisconnectedError`、`PiServerError`、`PiSessionOwnershipError`、`PiSessionDetachedError`。

### B.2 传输中立（核心设计）
- `transport.ts`（18 行）定义抽象 `Transport`；`unix.ts` 提供 Unix socket 具体实现。
- **neutral-core + edge-adapter**：client 逻辑不绑定传输，换传输只需换 adapter（未来可加 TCP/WebSocket）。

### B.3 session-handle.ts（111）+ state.ts（156）
- `SessionHandle` / `PiSessionHandle`：面向单会话的操作句柄（发命令、收事件、释放租约），`AcquireSessionOptions` / `SessionHandleCallbacks`。
- `ClientState`：连接/会话状态机，`ConnectionState(Change)`、`Unsubscribe`。

---

## C. pi-server（实验性服务端）

目录 `packages/server/src`：

```
server.ts (396)      # PiServer：握手、超时、连接管理、消息路由
sessions.ts (346)    # LiveSessionManager：活跃会话生命周期
snapshots.ts (62)    # ServerSnapshotPublisher：权威快照发布
protocol.ts (382)    # 协议桥接：命令 <-> AgentHarness 操作
connection.ts (36)   # ByteConnection 抽象（终态判断）
listener.ts (10) / errors.ts (58) / types.ts (63) / index.ts
transports/unix/     # Unix socket 监听器（listener.ts 434, preset.ts, types.ts）
testing/             # 测试脚手架：server.ts / client.ts / service.ts (287)
```

### C.1 server.ts（396）—— 服务端主体
- `PiServer`：随机 UUID 标识，握手（`ClientHello`/`ServerHello`，`DEFAULT_HANDSHAKE_TIMEOUT_MS=5000`），协议版本校验（`isSupportedProtocolVersion`），帧长限制（`DEFAULT_MAX_FRAME_LENGTH`）。
- 依赖注入：`PiServerService`（后端服务）、`PiServerListener`（传输监听）、`LiveSessionManager`、`ServerSnapshotPublisher`。
- 定时器上限保护（`MAX_TIMER_DELAY_MS`）。

### C.2 sessions.ts（346）—— 活跃会话管理
- `LiveSessionManager`：管理服务端侧活跃会话，与客户端租约对应，处理 attach/detach、所有权。

### C.3 snapshots.ts（62）+ protocol.ts（382）—— 权威快照 + 桥接
- `ServerSnapshotPublisher`：按需发布**权威快照**（区别于流式瞬态事件）。
- `protocol.ts`：**协议桥接层**——把协议命令翻译成 AgentHarness 操作，把 harness 事件/状态翻译成协议事件/快照。这是 server 与 agent-core 的接缝。

### C.4 transports/ + testing/
- `transports/unix/`：Unix socket 监听器（`listener.ts` 434 行）+ preset。传输可插拔（与 client 对称）。
- `testing/`：`server.ts`/`client.ts`/`service.ts` in-memory 脚手架，供集成测试（对称于 protocol 的确定性、client 的抽象）。

---

## D. 三角协作流程（端到端）

```
coding-agent/server/create-harness.ts  ──组装──>  PiServer + PiServerService(AgentHarness)
        │                                              │
        │  Unix socket (framing: u32 len + CBOR)       │
        ▼                                              ▼
coding-agent/client/remote-session.ts  <──PiClient──  protocol.ts 桥接 <──> AgentHarness operations
        │
        └─ SessionHandle：命令(Command) → 响应(CommandResult)
                          事件(ServerEvent，瞬态) + 快照(ServerSnapshot，权威)
```

- **握手**：ClientHello ↔ ServerHello，协商 `PROTOCOL_VERSION`。
- **命令通道**：请求/响应（envelope 带 id 关联）。
- **事件通道**：服务端推送瞬态进度事件；关键点用权威快照对齐，防止事件丢失导致状态漂移。
- **租约**：多客户端对同一会话的所有权由 lease 状态机仲裁。

---

## E. 设计亮点与权衡

**亮点**
- **权威快照 vs 瞬态事件分离**：容忍事件丢失，用快照兜底最终一致——远程 UI 的正确性关键。
- **协议 phase 直接对齐 AgentHarnessPhase**：避免维护第二套阶段词汇，减少适配层漂移。
- **typebox schema**：编译期类型 + 运行时校验一体，`StrictObject` 拒绝多余字段。
- **自带 CBOR + 简单 framing**：无第三方依赖，确定性编码，体积可控。
- **传输中立**（client/server 对称的 Transport/Listener 抽象）：Unix socket 只是首个实现。
- **会话租约模型**：显式处理多客户端所有权（active/releasing/released/invalidated）。

**权衡**
- server 仍标注**实验性**，远程能力未定型（`NOT_IMPLEMENTED` 占位、testing 脚手架多）。
- 协议版本 v1，跨版本演进策略尚浅（仅握手协商，无多版本共存证据）。
- 目前仅 Unix socket 传输，跨机器（TCP/TLS/WebSocket）仍需补齐。
- 三包 + coding-agent 的 client/server 封装形成较长调用链，调试成本高。
