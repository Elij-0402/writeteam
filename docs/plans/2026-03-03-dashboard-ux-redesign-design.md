# Dashboard UX Redesign Design

## Problem

1. **视觉设计平淡** — 卡片无视觉层次，缺乏现代极简风格的吸引力
2. **同样功能的 UI 组件重复** — "重命名"和"编辑信息"是两个独立对话框，但编辑信息已包含标题修改

## Design Direction

**现代极简风**（参考 Linear / Notion）：干净的卡片、封面渐变色、简约信息密度、微妙动效。

## Component Decomposition

当前 `dashboard-content.tsx` 是 600 行的单体组件。拆分为：

```
src/components/dashboard/
├── dashboard-content.tsx    # 瘦身后的容器（~80行）：管理 projects 状态 + CRUD 回调
├── dashboard-header.tsx     # 标题"我的项目" + 项目计数 + 新建按钮
├── project-card.tsx         # 单个项目卡片（带封面渐变区域）
├── project-grid.tsx         # 卡片网格容器 + 空状态
└── project-edit-dialog.tsx  # 合并后的唯一编辑对话框（取代重命名+编辑信息两个对话框）
```

### State Management

`dashboard-content.tsx` 只保留：
- `projects` 列表状态
- `handleCreateProject`, `handleDeleteProject`, `handleEditProject` 回调
- `newProjectOpen`, `deleteDialogOpen` 控制

**删除的状态（6个）：** `renameDialogOpen`, `projectToRename`, `renameTitle`, `editDialogOpen`, `projectToEdit`, `editTitle/editDescription/editGenre`

对话框组件自行管理自己的表单状态。

## ProjectCard Visual Design

### Card Structure

```
┌─────────────────────────┐
│  ██████████████████████  │  ← 封面区域 (100px)
│  ██ 基于题材的渐变色 ██  │     如有 cover_image_url 则用图片
│  ██████████████████████  │
├─────────────────────────┤
│  我的奇幻小说           ⋮ │  ← 标题 + hover 显示更多菜单
│  奇幻 · 5 章              │  ← 题材标签 + 章节数量
│                           │
│  一个关于魔法世界的...    │  ← 简介 (line-clamp-2)
│                           │
│  3 天前更新               │  ← 底部时间戳
└─────────────────────────┘
```

### Genre → Color Map

| 题材 | 渐变色方向 |
|------|-----------|
| 奇幻 | purple → indigo |
| 科幻 | cyan → blue |
| 言情 | pink → rose |
| 悬疑 | amber → orange |
| 惊悚 | red → dark red |
| 恐怖 | gray → dark gray |
| 文学 | green → emerald |
| 历史 | brown → amber |
| 青少年 | sky → blue |
| 儿童 | yellow → orange |
| 非虚构 | slate → gray |
| 其他/无 | neutral gray gradient |

### Interaction

- Hover: `translateY(-2px)` + `shadow-lg` transition
- 更多菜单: `opacity-0 → opacity-100` on group-hover
- 点击卡片跳转 `/editor/{id}`（保持现有行为）

## ProjectEditDialog (Merged)

合并"重命名"和"编辑信息"为单个对话框。

### Menu Simplification

- Before: 重命名 / 编辑信息 / 删除 (3 items)
- After: 编辑信息 / 删除 (2 items)

### Interface

```typescript
interface ProjectEditDialogProps {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (projectId: string, data: FormData) => Promise<void>
}
```

对话框内部管理 `title`, `description`, `genre` 的表单状态。打开时从 `project` prop 初始化。

## Data Layer Changes

### Document Count Query

`page.tsx` 新增查询获取每个项目的文档数量：

```typescript
// 获取项目文档数量
const projectIds = (projects || []).map(p => p.id)
const { data: documents } = await supabase
  .from("documents")
  .select("project_id")
  .in("project_id", projectIds)

// 聚合为 Map
const documentCounts = new Map<string, number>()
documents?.forEach(d => {
  documentCounts.set(d.project_id, (documentCounts.get(d.project_id) || 0) + 1)
})
```

传递给 `DashboardContent` 作为 `documentCounts: Record<string, number>`。

## What Does NOT Change

- 顶部导航栏（已符合极简风格）
- 命令面板 (Ctrl+K)
- 新建项目对话框
- 删除确认对话框
- 项目排序逻辑（按 updated_at 倒序）
- 无搜索/筛选/排序功能
