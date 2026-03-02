# Dashboard 全站布局统一重设计

**日期**: 2026-03-03
**状态**: 已批准
**方案**: A — shadcn/ui 双侧栏统一布局

## 背景

WriteTeam 当前存在的布局问题：
- Dashboard 首页（项目卡片网格）与编辑器页面是两套独立布局
- `editor-shell.tsx` 承载 1237 行，职责过重
- 右侧面板有 4 种模式（AI Chat、Story Bible、Muse、Visualize），切换逻辑散乱
- AIToolbar 和 SelectionAIMenu 共享 6 个相同功能（重复）
- Prose Mode 选择器在 4+ 个地方重复定义
- 功能入口多，用户迷失

## 设计决策

基于 2026 年行业调研（Cursor IDE、VS Code Copilot、ChatGPT、Notion AI、Novelcrafter、shadcn/ui sidebar-15 模板），采用三栏双侧栏统一布局。

### 核心理念

1. **全站统一 Shell** — 所有页面共用一个 `AppShell`
2. **左侧栏 = 导航** — ChatGPT 风格的项目文档树，取代 Dashboard 卡片页
3. **中间 = 内容** — 编辑器/设置/系列/Canvas 按路由切换
4. **右侧栏 = AI** — 统一为 AI Chat，其他功能通过 @-mention 和 /slash 命令触发
5. **三入口 AI** — 侧栏 Chat + 顶部 AIToolbar + 选中浮出菜单，互补不重复

## 全站布局骨架

```
SidebarProvider
  ├── AppSidebar (side="left", collapsible="icon")
  │     ├── SidebarHeader: Logo + 新建项目按钮
  │     ├── SidebarContent: 搜索框 + 项目文档树
  │     └── SidebarFooter: 用户头像 + 设置/系列入口
  │
  ├── SidebarInset
  │     ├── SiteHeader: 面包屑 + 字数统计 + 快捷操作
  │     └── <main>: 路由内容
  │
  └── AISidebar (side="right", collapsible="offcanvas")
        └── AI Chat 面板
```

## 左侧栏 — 项目文档树

### 结构

```
┌─────────────────────┐
│ WriteTeam       [+]  │  Logo + 新建项目
├─────────────────────┤
│ 搜索文档...          │  搜索框
├─────────────────────┤
│ ▼ 我的第一部小说      │  项目 (可折叠)
│   ├ 第一章            │  文档
│   ├ 第二章            │
│   └ 角色设定          │
│ ▶ 科幻短篇集         │  项目 (已折叠)
├─────────────────────┤
│ 系列管理              │  底部固定入口
│ 设置                 │
│ 张三         [退出]  │  用户菜单
└─────────────────────┘
```

### 交互

- 项目：点击展开/折叠，右键菜单（重命名、编辑信息、删除、Canvas）
- 文档：点击在中间区域打开，右键菜单（重命名、上移/下移、删除、导出）
- 折叠模式：`collapsible="icon"`，只显示项目首字图标
- 拖拽排序：项目间和文档间，复用 `reorder_documents` RPC
- 搜索：过滤项目和文档名称

### 组件映射

| UI 元素 | shadcn/ui 组件 |
|---------|---------------|
| 项目列表 | `SidebarGroup` + `Collapsible` |
| 项目项 | `SidebarMenuItem` + `SidebarMenuButton` |
| 文档列表 | `SidebarMenuSub` |
| 文档项 | `SidebarMenuSubButton` |
| 搜索框 | `SidebarGroup` + `Input` |
| 底部菜单 | `SidebarFooter` + `NavUser` |
| 右键菜单 | `ContextMenu` / `DropdownMenu` |

## 右侧 AI Chat 面板

### 统一入口

右侧只有一个 AI Chat 面板，原 4 个面板功能收口：

| 原面板 | 收口方式 | 触发 |
|--------|---------|------|
| AI Chat | 直接对话 | 直接输入 |
| Story Bible | @-mention 查看/编辑 | `@story-bible`、`@character:李明` |
| Muse 灵感 | slash 命令 | `/muse what-if`、`/muse random`、`/muse suggest` |
| Visualize | slash 命令 | `/visualize 描述场景` |

### 交互

- **@-mention**：输入 `@` 弹出下拉菜单（story-bible、角色名、style 等），AI 回复带相关上下文
- **slash 命令**：输入 `/` 弹出命令列表
- **插入到编辑器**：AI 生成内容旁 `[插入]` 按钮
- **Prose Mode**：模型选择旁切换
- **独立折叠**：快捷键 `Ctrl+L`
- **Story Bible 完整编辑**：通过 `/bible edit` 或 `[查看完整 Bible]` 在中间区域打开

## SiteHeader

```
[≡] │ 项目名 / 文档名  │  字数:2,340  [专注] [Canvas] [AI栏]
```

- `[≡]` → `SidebarTrigger` 切换左侧栏
- 面包屑 → 当前项目 / 当前文档
- 专注模式 → 隐藏双侧栏
- Canvas → `/canvas/[id]`
- AI 栏 → 切换右侧 AI Chat

## 中间内容区（按路由）

| 路由 | 内容 |
|------|------|
| 无文档选中 | 欢迎页 / 空状态引导 |
| `/editor/[id]` | AIToolbar + WritingEditor + SaliencyIndicator |
| `/settings` | 设置表单 |
| `/series` | 系列管理 |
| `/canvas/[id]` | Canvas 画布 |

## 组件重构

### 删除/合并

| 组件 | 处置 |
|------|------|
| `dashboard-content.tsx` | 删除 — 项目卡片被左侧栏取代 |
| `project-grid.tsx` | 删除 |
| `project-card.tsx` | 删除 |
| `dashboard-header.tsx` | 删除 — 被 SiteHeader 取代 |
| `editor-shell.tsx` | 拆分为 `AppShell` + `EditorContent` |
| `muse-panel.tsx` | 重构为 Chat slash 命令 |
| `visualize-panel.tsx` | 重构为 Chat slash 命令 |

### 新增

| 组件 | 职责 |
|------|------|
| `AppShell` | 全站布局壳 |
| `AppSidebar` | 左侧栏项目文档树 |
| `AISidebar` | 右侧栏 AI Chat |
| `SiteHeader` | 统一顶部栏 |
| `ProjectTree` | 项目文档树 |
| `ChatSlashCommands` | slash 命令系统 |
| `ChatMentions` | @-mention 系统 |
| `WelcomePage` | 空状态引导页 |
| `ProseModeSelector` | 共享 Prose Mode 选择器（去重）|

### 不变

- `writing-editor.tsx`
- `ai-toolbar.tsx`
- `selection-ai-menu.tsx`
- `save-status-banner.tsx`
- `saliency-indicator.tsx`
- 所有 Server Actions
- 所有 AI Route Handlers
- 数据库结构

## 行业参考

| 产品 | 借鉴点 |
|------|--------|
| Cursor IDE | 三栏布局（文件树 / 编辑器 / AI Chat）|
| VS Code Copilot | 右侧辅助侧栏 + @-mention 路由 |
| ChatGPT | 左侧对话列表风格 |
| shadcn/ui sidebar-15 | 双侧栏原生组件支持 |
| Novelcrafter | Codex 自动检测 + BYOK + Chat tab |
