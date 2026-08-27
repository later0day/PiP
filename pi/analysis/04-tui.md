# 04 · pi-tui（差分渲染终端 UI）深潜

> 目录：`packages/tui` · 包名：`@earendil-works/pi-tui` · 版本：v0.84.3
> 角色：项目底座之一（无对内依赖），提供**差分渲染的终端 UI 框架** + 组件库 + 编辑器 + 原生插件。
> 源码约 16.8K 行。最大文件：`components/editor.ts`（2363）、`keys.ts`（1401）、`latex.ts`（1380）、`utils.ts`（1326）、`tui-alt-screen.ts`（1320）、`tui.ts`（1263）、`components/markdown.ts`（1015）。

---

## 0. 顶层结构（`src/`）

```
src/
├── tui.ts (1263)             # 差分渲染内核 + Component 接口
├── tui-main-screen.ts (586)  # 常规屏（terminal-owned scrollback）
├── tui-alt-screen.ts (1320)  # 备用屏（fullscreen，固定底部区域）
├── alt-screen-search.ts      # 备用屏内搜索
├── terminal.ts (553)         # 终端抽象（写入/查询/能力）
├── terminal-colors.ts        # OSC11 背景色/配色方案探测
├── terminal-image.ts (657)   # Kitty 图形协议 / 内联图片
├── layout.ts (410) / layout-node.ts  # 布局引擎
├── keys.ts (1401) / keybindings.ts (320) / native-modifiers.ts  # 键盘
├── autocomplete.ts (786) / fuzzy.ts   # 补全与模糊匹配
├── editor-component.ts        # 自定义编辑器接口
├── stdin-buffer.ts (444) / kill-ring.ts / undo-stack.ts / word-navigation.ts
├── latex.ts (1380)            # LaTeX 渲染
├── terminal-image.ts / native-module-path.ts / native-modifiers.ts
├── utils.ts (1326)           # 宽度/切片/分段/规范化（East-Asian 宽字符处理）
├── components/               # 组件库（见 §2）
└── (native/ 见 §3，位于包根)
```

---

## 1. 渲染内核：`tui.ts`（1263）

- 文件头自述："Minimal TUI implementation with **differential rendering**"。
- **Component 接口**（所有组件实现）：
  - `render(width): string[]`——按视口宽度渲染成行数组；
  - 可选 `handleInput(data)`——聚焦时处理键盘输入；
  - 可选 `wantsKeyRelease`——是否接收 Kitty 协议的按键释放事件（默认过滤）。
- **差分渲染**：只重绘变化的行，最小化终端写入（性能关键，配套 `scripts/profile:tui`）。
- 依赖 `utils.ts` 的 `visibleWidth`/`sliceByColumn`/`extractSegments`/`normalizeTerminalOutput` 处理 ANSI + 宽字符 + 分段。

## 2. 两种屏幕模式（对应 CLI `--tui-mode`）

| 模式 | 文件 | 特征 |
|---|---|---|
| `regular`（默认） | `tui-main-screen.ts`（586） | 主屏 + 终端自有 scrollback；iTerm2 内联图正常 |
| `fullscreen`（实验） | `tui-alt-screen.ts`（1320） | 备用屏；transcript 在视口内滚动，队列/状态/widget/editor/footer 固定底部；支持 Kitty 图形协议（Kitty/Ghostty）；`alt-screen-search.ts` 提供屏内搜索 |

## 3. components/ —— 组件库（二级模块）

| 组件 | 文件 | 说明 |
|---|---|---|
| Editor | `editor.ts`（2363） | 多行编辑器：kill-ring、undo、词导航、路径补全、`@` 文件引用、Shift+Enter 多行 |
| Markdown | `markdown.ts`（1015） | 基于 `marked` 的终端 Markdown 渲染（导出 `Marked`/`Token`） |
| SelectList | `select-list.ts`（229） | 可选列表（模型/主题/会话选择器基座） |
| SettingsList | `settings-list.ts`（276） | 设置项列表 |
| ScrollView | `scroll-view.ts`（216） | 可滚动视图 + 滚动条 |
| Input | `input.ts`（447） | 单行输入 |
| Image | `image.ts`（127） | 内联图片组件 |
| 布局容器 | `stack.ts`(154)/`v-stack.ts`/`h-stack.ts`/`box.ts`(137)/`spacer.ts` | 垂直/水平/盒/间隔 |
| 文本 | `text.ts`/`truncated-text.ts` | 文本与截断文本 |
| 加载 | `loader.ts`/`cancellable-loader.ts` | 加载指示器 |
| 其他 | `alt-screen-flash.ts` | 备用屏闪烁提示 |

## 4. 输入与键盘（二级模块）
- `keys.ts`（1401）：按键解析（含 Kitty 协议、release 事件、组合键）。
- `keybindings.ts`（320）：`KeybindingsManager`、`TUI_KEYBINDINGS`、冲突检测（`KeybindingConflict`）、`get/setKeybindings`——用户可自定义（对应 coding-agent `/hotkeys`、keybindings.md）。
- `native-modifiers.ts` + `native-modifiers`（native）：读取真实修饰键状态（终端无法报告的场景）。
- `stdin-buffer.ts`（444）：stdin 缓冲/解析；`word-navigation.ts` / `kill-ring.ts` / `undo-stack.ts`：编辑器辅助。

## 5. 补全与匹配
- `autocomplete.ts`（786）：`AutocompleteProvider` / `CombinedAutocompleteProvider` / `SlashCommand`——斜杠命令、`@` 文件、路径补全。
- `fuzzy.ts`（137）：`fuzzyFilter` / `fuzzyMatch`——模糊匹配（会话/文件搜索）。

## 6. 终端能力与图像
- `terminal.ts`（553）：终端抽象。
- `terminal-colors.ts`：OSC11 背景色探测 + 配色方案报告解析（主题自适应明暗）。
- `terminal-image.ts`（657）：Kitty 图形协议、图片行检测、单元尺寸——内联图片核心。
- `latex.ts`（1380）：终端内 LaTeX 渲染。

## 7. native/ —— 原生插件（二级模块，包根）

**neutral-core + edge-adapter 的典型体现**：跨平台原生能力用预编译 `.node`：

```
native/
├── darwin/  src/darwin-modifiers.c  + build.sh  + prebuilds/{darwin-arm64,darwin-x64}/darwin-modifiers.node
└── win32/   src/win32-console-mode... + build.mjs + prebuilds/{win32-arm64,win32-x64}/win32-console-mode.node
```

- **darwin**：读取 macOS 修饰键状态（终端不上报时）。
- **win32**：设置 Windows 控制台模式（VT 序列/输入模式）。
- `native-module-path.ts`：按平台/架构解析预编译产物路径——**预编译分发**避免用户安装期编译。

---

## 8. 设计亮点与权衡

**亮点**
- **差分渲染** + 宽字符/ANSI 精细处理，性能与正确性兼顾（有专门 profile 脚本）。
- **regular / fullscreen 双模式**，兼容不同终端的图像协议差异（Kitty/Ghostty vs iTerm2）。
- **组件化 + 可主题化**，被 coding-agent 43 个交互组件复用。
- **原生能力预编译分发**，无安装期编译，跨平台。
- 无对内依赖，可独立用于其他 TUI 项目（文档 tui.md 面向扩展作者）。

**权衡**
- `editor.ts`（2363）等超大组件文件，复杂度高。
- 原生插件需为每个 平台/架构 维护预编译产物（darwin-arm64/x64、win32-arm64/x64），发布链路更重。
- LaTeX（1380）/图像/Kitty 协议等富功能使"minimal TUI"名不副实——极简在渲染内核，富功能在外围组件。
