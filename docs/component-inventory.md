# 组件清单

## 基础 UI 组件

- 目录：`src/components/ui`
- 典型组件：`button.tsx`、`input.tsx`、`dialog.tsx`、`tabs.tsx`、`sidebar.tsx`、`sonner.tsx`

## 功能组件（按域）

- `src/components/ai`：AI 工具栏、聊天、muse、恢复动作、可视化
- `src/components/editor`：编辑器壳、写作编辑器、选区 AI 菜单
- `src/components/canvas`：画布编辑器、节点、详情面板、工具栏
- `src/components/settings`：设置页、AI 提供商配置、支持与故障分析
- `src/components/dashboard`：仪表盘内容
- `src/components/story-bible`：故事圣经面板
- `src/components/series`：系列管理与详情
- `src/components/layout`：命令面板等布局能力
- `src/components/plugins`：插件管理
- `src/components/providers`：Auth/Theme/AIConfig Provider

## 复用建议

- 新功能优先复用 `ui` 基础组件与现有 provider。
- AI 相关交互优先复用 `src/components/ai` 现有模式。
