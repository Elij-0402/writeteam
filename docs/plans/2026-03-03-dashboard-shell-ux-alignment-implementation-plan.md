# Dashboard 壳层 UX 对齐 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `/dashboard` 从静态欢迎态升级为任务驱动控制台，并统一壳层反馈与状态表达，显著降低用户迷失感。

**Architecture:** 在不改后端 schema 的前提下，新增轻量“壳层派生状态”模块，供 dashboard、sidebar、header 共享。`/dashboard` 改为任务控制台（继续写作/最近文档/下一步建议），`AppSidebar` 与 `SiteHeader` 补齐上下文反馈与错误处理。优先复用现有 Supabase 数据读取路径和现有 Server Actions。

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict), Supabase, shadcn/ui, Tailwind v4, Vitest + Testing Library.

---

### Task 1: 壳层派生状态工具（单一真相）

**Files:**
- Create: `src/lib/dashboard/shell-ux-state.ts`
- Create: `src/lib/dashboard/shell-ux-state.test.ts`

**Step 1: 写失败测试（规则优先）**

```ts
import { describe, expect, it } from "vitest"
import { deriveShellUXState } from "./shell-ux-state"

describe("deriveShellUXState", () => {
  it("returns create_project when no projects", () => {
    const state = deriveShellUXState([])
    expect(state.recommendedNextAction).toBe("create_project")
  })

  it("returns create_first_document when project exists but has no docs", () => {
    const state = deriveShellUXState([
      { projectId: "p1", documents: [] },
    ])
    expect(state.recommendedNextAction).toBe("create_first_document")
  })

  it("returns resume_last_document when docs exist but no active doc", () => {
    const state = deriveShellUXState([
      {
        projectId: "p1",
        documents: [{ id: "d1", updatedAt: "2026-03-03T10:00:00Z", title: "第一章" }],
      },
    ])
    expect(state.lastEditedDocument?.id).toBe("d1")
    expect(state.recommendedNextAction).toBe("resume_last_document")
  })
})
```

**Step 2: 运行测试确认失败**

Run: `npx vitest run src/lib/dashboard/shell-ux-state.test.ts`
Expected: FAIL（模块不存在）

**Step 3: 最小实现工具函数**

在 `src/lib/dashboard/shell-ux-state.ts` 实现：
- `deriveShellUXState(...)`
- `recommendedNextAction` 4 条规则（create_project/create_first_document/resume_last_document/continue_current_document）
- `lastEditedDocument` 按 `updatedAt` 取最新

**Step 4: 运行测试确认通过**

Run: `npx vitest run src/lib/dashboard/shell-ux-state.test.ts`
Expected: PASS

**Step 5: 提交**

```bash
git add src/lib/dashboard/shell-ux-state.ts src/lib/dashboard/shell-ux-state.test.ts
git commit -m "feat: add shell UX state derivation utility"
```

---

### Task 2: Dashboard 任务控制台组件

**Files:**
- Create: `src/components/dashboard/dashboard-task-console.tsx`
- Create: `src/components/dashboard/dashboard-task-console.test.tsx`

**Step 1: 写失败测试（主任务可达）**

测试覆盖：
- 渲染“继续写作”主按钮
- 渲染最近文档列表（最多 5 条）
- 根据 `recommendedNextAction` 渲染下一步建议文案

**Step 2: 运行测试确认失败**

Run: `npx vitest run src/components/dashboard/dashboard-task-console.test.tsx`
Expected: FAIL（模块不存在）

**Step 3: 最小实现组件**

在 `src/components/dashboard/dashboard-task-console.tsx`：
- 接收派生状态与 3 个回调：`onResumeLastDoc`、`onCreateProject`、`onCreateFirstDoc`
- 输出三块 UI：继续写作卡、最近文档、下一步建议
- 文案全部简体中文

**Step 4: 运行测试确认通过**

Run: `npx vitest run src/components/dashboard/dashboard-task-console.test.tsx`
Expected: PASS

**Step 5: 提交**

```bash
git add src/components/dashboard/dashboard-task-console.tsx src/components/dashboard/dashboard-task-console.test.tsx
git commit -m "feat: add task-driven dashboard console component"
```

---

### Task 3: `/dashboard` 接入任务控制台

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Create: `src/app/(app)/dashboard/page.test.tsx`

**Step 1: 写失败测试（从欢迎页切换）**

测试覆盖：
- 页面不再只渲染欢迎文案
- 有最近文档时出现“继续写作”按钮
- 无项目时出现“创建项目”建议

**Step 2: 运行测试确认失败**

Run: `npx vitest run src/app/(app)/dashboard/page.test.tsx`
Expected: FAIL

**Step 3: 最小实现页面数据流**

在 `src/app/(app)/dashboard/page.tsx`：
- 服务端读取当前用户、projects、documents（与壳层一致，保证 ownership）
- 调用 `deriveShellUXState(...)`
- 渲染 `DashboardTaskConsole`

**Step 4: 运行测试确认通过**

Run: `npx vitest run src/app/(app)/dashboard/page.test.tsx`
Expected: PASS

**Step 5: 提交**

```bash
git add src/app/(app)/dashboard/page.tsx src/app/(app)/dashboard/page.test.tsx
git commit -m "feat: replace dashboard welcome with task console"
```

---

### Task 4: AppSidebar 动作语义与错误反馈对齐

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx`
- Modify: `src/components/layout/project-tree.tsx`
- Create: `src/components/layout/app-sidebar.test.tsx`

**Step 1: 写失败测试（动作语义 + 错误反馈）**

测试覆盖：
- 全局区仅保留“新建项目”
- 项目节点菜单包含“新建文档”
- Action 返回 `error` 时展示错误提示并不误跳转

**Step 2: 运行测试确认失败**

Run: `npx vitest run src/components/layout/app-sidebar.test.tsx`
Expected: FAIL

**Step 3: 最小实现改动**

在 `app-sidebar.tsx`：
- 所有 create/update/delete 分支处理 `{ error }`
- 失败时 toast，成功时触发 `onDocumentsChange` 和必要路由更新

在 `project-tree.tsx`：
- 确认项目级与文档级动作分层清晰（不混放）

**Step 4: 运行测试确认通过**

Run: `npx vitest run src/components/layout/app-sidebar.test.tsx`
Expected: PASS

**Step 5: 提交**

```bash
git add src/components/layout/app-sidebar.tsx src/components/layout/project-tree.tsx src/components/layout/app-sidebar.test.tsx
git commit -m "fix: align sidebar action hierarchy and error feedback"
```

---

### Task 5: SiteHeader 增加上下文状态胶囊

**Files:**
- Modify: `src/components/layout/site-header.tsx`
- Create: `src/components/layout/site-header.test.tsx`

**Step 1: 写失败测试（状态可见性）**

测试覆盖：
- 未选中文档时显示“未选择文档”
- 有最近可继续文档时显示“可继续”类状态

**Step 2: 运行测试确认失败**

Run: `npx vitest run src/components/layout/site-header.test.tsx`
Expected: FAIL

**Step 3: 最小实现状态胶囊**

在 `site-header.tsx`：
- 新增可选 prop（例如 `statusPill`）
- 在 breadcrumb 右侧展示轻量状态标签

**Step 4: 运行测试确认通过**

Run: `npx vitest run src/components/layout/site-header.test.tsx`
Expected: PASS

**Step 5: 提交**

```bash
git add src/components/layout/site-header.tsx src/components/layout/site-header.test.tsx
git commit -m "feat: add shell context status pill in site header"
```

---

### Task 6: 壳层联动与回归验证

**Files:**
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/components/layout/welcome-page.tsx`（若保留为兜底空态）

**Step 1: 写失败测试（壳层联动）**

测试覆盖：
- Dashboard 推荐动作与 Header 状态一致
- 从 dashboard 点击“继续写作”后路由跳转正确

**Step 2: 运行测试确认失败**

Run: `npx vitest run src/components/layout/app-shell.test.tsx`
Expected: FAIL（若文件不存在先创建）

**Step 3: 最小实现联动逻辑**

在 `app-shell.tsx`：
- 传递/消费 dashboard 派生状态
- 与 `SiteHeader` 的状态胶囊同步

**Step 4: 运行针对性测试**

Run:
- `npx vitest run src/components/layout/app-shell.test.tsx`
- `npx vitest run src/components/layout/app-sidebar.test.tsx`
- `npx vitest run src/components/layout/site-header.test.tsx`

Expected: PASS

**Step 5: 运行质量闸门**

Run:
- `npm run lint`
- `npm run test -- --reporter=default`

Expected: PASS

**Step 6: 提交**

```bash
git add src/components/layout/app-shell.tsx src/components/layout/welcome-page.tsx
git commit -m "feat: wire task-driven shell UX across dashboard sidebar and header"
```

---

### Task 7: 文档更新

**Files:**
- Modify: `README.md`（如有必要）
- Modify: `docs/plans/2026-03-03-dashboard-shell-ux-alignment-design.md`（状态更新）

**Step 1: 更新设计文档状态**

将设计文档状态从“已批准”补充为“已落地（进行中）”或记录实施进度。

**Step 2: 提交**

```bash
git add README.md docs/plans/2026-03-03-dashboard-shell-ux-alignment-design.md
git commit -m "docs: update dashboard shell UX rollout notes"
```
