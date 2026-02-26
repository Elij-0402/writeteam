# CLAUDE.md — WriteTeam 项目指令

## 项目规范

参见 `AGENTS.md` 获取完整的代码规范、技术栈说明和构建命令。

## Agent Team 系统

WriteTeam 配置了一套 Claude Code 原生 Agent Team 系统，支持多角色协作开发。

### 角色表

| 角色 | 文件 | 类型 | 核心职责 |
|------|------|------|----------|
| Team Lead | `.claude/agents/team-lead.md` | 协调 | 团队创建、任务分配、sprint 管理 |
| 产品经理 | `.claude/agents/product-manager.md` | 只读 | PRD、用户故事、验收标准 |
| 架构师 | `.claude/agents/architect.md` | 全能 | API 设计、DB schema、RLS、组件架构 |
| 前端开发 | `.claude/agents/frontend-dev.md` | 全能 | React/Next.js、TipTap、Tailwind、shadcn/ui |
| 后端开发 | `.claude/agents/backend-dev.md` | 全能 | API routes、server actions、Supabase、OpenAI |
| UX 设计师 | `.claude/agents/ux-designer.md` | 只读 | 用户流程、交互设计、中文排版 |
| QA 工程师 | `.claude/agents/qa-engineer.md` | 全能 | lint、build 验证、测试策略、代码审查 |
| AI 写作专家 | `.claude/agents/ai-writing-expert.md` | 全能 | Prompt 设计、prose mode、story context |
| 中文语言专家 | `.claude/agents/zh-cn-specialist.md` | 只读 | 中文 UI 文案、标点规范、本地化 |

### 快速启动

说 **"创建团队"** 即可启动完整的 Agent Team。Team Lead 会根据任务自动选择需要 spawn 的角色。

### 工作流阶段

1. **分析** (`.claude/workflows/phase-1-analysis.md`) — 收集上下文、调研、头脑风暴
2. **规划** (`.claude/workflows/phase-2-planning.md`) — PRD、UX 设计、本地化审查
3. **架构** (`.claude/workflows/phase-3-solutioning.md`) — 数据模型、API 设计、Story 分解
4. **实施** (`.claude/workflows/phase-4-implementation.md`) — Sprint 规划、开发、质量门
5. **专属** (`.claude/workflows/writeteam-specific.md`) — 新 AI 功能、Story Bible 扩展等

### 选择性 Spawn 策略

不必每次都 spawn 全部角色。按任务类型选择：

| 任务类型 | 需要 spawn 的角色 |
|----------|-------------------|
| 简单 bug 修复 | backend-dev 或 frontend-dev（单个） |
| 新 AI 写作功能 | ai-writing-expert, architect, backend-dev, frontend-dev |
| UI 改版 | ux-designer, frontend-dev, zh-cn-specialist |
| 数据库功能 | architect, backend-dev |
| 完整端到端功能 | 按需 5-7 个角色 |
| 本地化审查 | zh-cn-specialist |

### 关键文件索引

| 用途 | 路径 |
|------|------|
| AI 上下文管线 | `writeteam/src/lib/ai/story-context.ts` |
| 流式输出 | `writeteam/src/lib/ai/openai-stream.ts` |
| Prose mode | `writeteam/src/lib/ai/prose-mode.ts` |
| 标准 AI 路由 | `writeteam/src/app/api/ai/write/route.ts` |
| 数据库类型 | `writeteam/src/types/database.ts` |
| 编辑器组件 | `writeteam/src/components/editor/editor-shell.tsx` |
| AI 工具栏 | `writeteam/src/components/ai/ai-toolbar.tsx` |
| Story Bible | `writeteam/src/components/story-bible/story-bible-panel.tsx` |
| Server actions | `writeteam/src/app/actions/` |
