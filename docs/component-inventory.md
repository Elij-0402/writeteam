# WriteTeam — 组件清单

> 生成日期: 2026-02-27 | 总组件文件: 55 | 客户端组件: 50 | 服务端兼容: 5

## 1. UI 原语 (`components/ui/`) — 27 个

shadcn/ui 组件 (new-york 风格)，基于 Radix UI + Tailwind CSS。

| 组件 | 文件 | 类型 | Variants/特性 |
|------|------|------|---------------|
| `Button` | button.tsx | 服务端兼容 | 6 variants (default/destructive/outline/secondary/ghost/link), 8 sizes |
| `Input` | input.tsx | 服务端兼容 | aria-invalid 状态 |
| `Textarea` | textarea.tsx | 服务端兼容 | field-sizing-content 自动增长 |
| `Card` | card.tsx | 服务端兼容 | 7 子组件 (Header/Title/Description/Action/Content/Footer) |
| `Badge` | badge.tsx | 服务端兼容 | 6 variants, asChild 支持 |
| `Skeleton` | skeleton.tsx | 服务端兼容 | 脉冲动画占位符 |
| `Label` | label.tsx | 客户端 | Radix Label |
| `Checkbox` | checkbox.tsx | 客户端 | Radix Checkbox |
| `Switch` | switch.tsx | 客户端 | 2 sizes (sm/default) |
| `Toggle` | toggle.tsx | 客户端 | 2 variants, 3 sizes |
| `ToggleGroup` | toggle-group.tsx | 客户端 | 共享 variant context, spacing 控制 |
| `Select` | select.tsx | 客户端 | 完整 Radix Select + 滚动按钮 |
| `Dialog` | dialog.tsx | 客户端 | Portal + Overlay + 关闭按钮 |
| `AlertDialog` | alert-dialog.tsx | 客户端 | 确认对话框, 2 sizes |
| `Sheet` | sheet.tsx | 客户端 | 4 方向滑入 (top/right/bottom/left) |
| `Popover` | popover.tsx | 客户端 | Portal + 动画过渡 |
| `Tooltip` | tooltip.tsx | 客户端 | delayDuration=0 |
| `Tabs` | tabs.tsx | 客户端 | 2 variants (default/line), 方向支持 |
| `Accordion` | accordion.tsx | 客户端 | 动画展开/折叠 |
| `DropdownMenu` | dropdown-menu.tsx | 客户端 | 15+ 子组件, checkbox/radio/sub |
| `ScrollArea` | scroll-area.tsx | 客户端 | 自定义滚动条 |
| `Command` | command.tsx | 客户端 | cmdk 命令面板 + Dialog 封装 |
| `Form` | form.tsx | 客户端 | react-hook-form 集成 |
| `Separator` | separator.tsx | 客户端 | 水平/垂直分隔线 |
| `Progress` | progress.tsx | 客户端 | 进度条 |
| `Sidebar` | sidebar.tsx | 客户端 | 23 子组件, cookie 持久化, Ctrl+B, 移动端 Sheet |
| `Sonner/Toaster` | sonner.tsx | 客户端 | 主题感知 Toast, 自定义图标 |
| `Resizable` | resizable.tsx | 客户端 | 可调整面板 |
| `Avatar` | avatar.tsx | 客户端 | Image/Fallback + Badge + Group |

---

## 2. Context Providers (`components/providers/`) — 3 个

| 组件 | 职责 | 数据源 | Hook |
|------|------|--------|------|
| `ThemeProvider` | 暗色/亮色主题 | next-themes | `useTheme()` |
| `AuthProvider` | 用户认证状态 | Supabase onAuthStateChange | `useAuth()` |
| `AIConfigProvider` | BYOK AI 配置 | localStorage | `useAIConfigContext()` |

**嵌套顺序**: Theme → Auth → AIConfig → Tooltip

---

## 3. 编辑器组件 (`components/editor/`) — 4 个

| 组件 | 状态数 | AI 相关 | 职责 |
|------|--------|---------|------|
| `EditorShell` | 14 useState + refs | ✓ | 主编辑器容器: 左侧文档列表 + 中间编辑器 + 右侧面板 |
| `WritingEditor` | TipTap + refs | ✓ | TipTap 编辑器: StarterKit + 5 扩展, 1s 自动保存, 格式工具栏 |
| `SelectionAIMenu` | 11 useState | ✓ | 浮动 AI 菜单: createPortal, 6 种 AI 操作, 流式结果 |
| `SaliencyIndicator` | 无 (纯展示) | ✓ | 活跃角色/地点显示条 |

---

## 4. AI 组件 (`components/ai/`) — 4 个

| 组件 | 状态数 | API 端点 | 职责 |
|------|--------|----------|------|
| `AIToolbar` | 19 useState | 12+ endpoints | 主 AI 工具栏: Write/Rewrite/Expand/Shrink/Describe/Brainstorm/Twist/ScenePlan/FirstDraft/ToneShift/QuickEdit/Plugin + 反馈系统 |
| `AIChatPanel` | 3 useState + refs | /api/ai/chat | 多轮 AI 对话面板 |
| `MusePanel` | 5 useState | /api/ai/muse | 灵感伙伴: what-if/random-prompt/suggest 三种模式 |
| `VisualizePanel` | 6 useState | /api/ai/visualize | 文生图面板: 5 种风格, 图像历史 |

---

## 5. 画布组件 (`components/canvas/`) — 4 个

| 组件 | 职责 |
|------|------|
| `CanvasEditor` | React Flow 画布: 节点/边 CRUD, debounced 位置保存, AI 节拍生成 |
| `CanvasNode` | 自定义节点: 5 种类型 (beat/scene/character/location/note), 颜色编码 |
| `CanvasToolbar` | 浮动工具栏: 5 种节点创建按钮 + AI 生成对话框 |
| `NodeDetailPanel` | 右侧节点详情编辑: 类型/标签/内容/颜色 |

---

## 6. 仪表板组件 (`components/dashboard/`) — 1 个

| 组件 | 职责 |
|------|------|
| `DashboardContent` | 项目网格: 创建/删除对话框, 12 种中文体裁选择, 用户头像菜单, 主题切换, CommandPalette |

---

## 7. 系列组件 (`components/series/`) — 4 个

| 组件 | 职责 |
|------|------|
| `SeriesManager` | 系列创建/编辑对话框 |
| `SeriesBiblePanel` | 系列级 Story Bible 编辑 (6 字段) |
| `SeriesListContent` | 系列列表页: 网格 + 创建/删除 |
| `SeriesDetailContent` | 系列详情: 3 标签页 (概览/项目/Bible) |

---

## 8. 设置组件 (`components/settings/`) — 2 个

| 组件 | 职责 |
|------|------|
| `SettingsContent` | 设置页面外壳 |
| `AIProviderForm` | BYOK 配置表单: Provider 预设, URL 规范化, 模型 Combobox, 连接测试 |

---

## 9. Story Bible 组件 (`components/story-bible/`) — 1 个

| 组件 | 状态数 | 职责 |
|------|--------|------|
| `StoryBiblePanel` | 18 useState | 4 标签页 (Overview/Characters/World/AI Visibility), 角色 CRUD, 11 个可见性开关 |

---

## 10. 插件组件 (`components/plugins/`) — 1 个

| 组件 | 职责 |
|------|------|
| `PluginManager` | 双层对话框: 插件列表 + 创建/编辑表单, 模板变量 ({{selection}}/{{context}}/{{input}}) |

---

## 11. 布局组件 (`components/layout/`) — 1 个

| 组件 | 职责 |
|------|------|
| `CommandPalette` | Ctrl+K 命令面板: 导航/操作/设置 三组命令 |

---

## 架构模式总结

1. **所有功能组件使用 `"use client"`** + 本地 `useState` 状态管理
2. **Server Actions** 用于数据库操作 (不从组件直接调用 Supabase)
3. **BYOK 头注入**: `useAIConfigContext().getHeaders()` → 每次 AI fetch
4. **流式响应**: `ReadableStream` reader 模式 + 增量状态更新
5. **Toast 通知**: sonner 用于所有用户反馈
6. **全中文 UI**: 所有用户可见字符串为中文 (zh-CN)
