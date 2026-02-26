# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

All commands run from the **repository root** (monorepo delegates via `npm --prefix writeteam`):

```bash
npm run dev          # Next.js dev server (localhost:3000)
npm run build        # Production build (requires .env.local with Supabase vars)
npm run lint         # ESLint
```

Install dependencies inside `writeteam/` (not root):
```bash
cd writeteam && npm install
```

Add shadcn/ui components from `writeteam/`:
```bash
npx shadcn@latest add <component>
```

No test framework is configured. If adding tests, use Vitest.

### Environment Variables

Required in `writeteam/.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (server-only — never prefix with `NEXT_PUBLIC_`)

## Architecture

### Monorepo Layout

Root `package.json` delegates all scripts to `writeteam/` (the actual Next.js 16 app). Code lives under `writeteam/src/`.

### Tech Stack

Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4, shadcn/ui (new-york style), Supabase (Auth + Postgres + RLS), TipTap editor, OpenAI API.

### Routing

Route groups under `writeteam/src/app/`:
- `(auth)/` — Login/signup (unauthenticated)
- `(dashboard)/` — Project list, series management (authenticated)
- `(editor)/editor/[id]` — Writing workspace
- `(editor)/canvas/[id]` — Visual story planning canvas

No `middleware.ts` — uses `proxy.ts` instead (Next.js 16 convention). It refreshes Supabase auth tokens on each request.

**Next.js 16 async params**: Page params are `Promise<{ id: string }>` — must `await`.

### Data Model (Supabase)

Core entities: **projects** → **documents** (chapters), **characters**, **story_bibles** (per-project AI context). Projects optionally belong to a **series** with its own **series_bible**. Additional tables: **canvas_nodes/edges** (visual planning), **plugins** (custom AI prompts), **ai_history** (telemetry), **images**.

**Story Context Hierarchy**: Project bible + characters → merged with series bible (series as fallback) → feature-specific filtering → injected into AI system prompt. Story Bible has a `visibility` JSON field controlling which sections appear in AI prompts.

### AI Architecture

19 AI routes in `src/app/api/ai/` all follow the same pattern:
1. Auth check → parse request body
2. Fetch story context via `story-context.ts` (project bible + characters, series bible fallback)
3. Build feature-specific system prompt with story context injection
4. Stream response via `openai-stream.ts` (manual fetch, not AI SDK streaming)
5. Log telemetry to `ai_history` table (tokens, latency, fingerprint)

Key AI utilities in `src/lib/ai/`:
- `story-context.ts` — Orchestrates context fetching and feature-specific prompt building
- `openai-stream.ts` — Streaming + telemetry logging
- `prose-mode.ts` — 5 prose styles (balanced, cinematic, lyrical, minimal, match-style)
- `model-registry.ts` — Centralized model config (GPT-4o-mini, GPT-4o)
- `saliency.ts` — Client-side heuristic text analysis (no AI) for active characters/locations

### Editor Workspace

`editor-shell.tsx` is the central writing component:
- Left sidebar: document list (create/delete/import/export)
- Center: TipTap WritingEditor + AIToolbar (floating menu)
- Right panel: toggleable Story Bible | AI Chat | Muse | Visualize
- Saliency computed client-side with 5s debounce after document changes

### Server Actions

Located in `src/app/actions/`. Pattern: check auth → validate ownership → business logic → `revalidatePath()` → return `{ data }` or `{ error: string }`.

### Data Mutation Flow

Client component → server action (or API route for AI) → Supabase → revalidate. Error feedback via `toast.error()` from `sonner`.

## Code Conventions

### TypeScript

- Strict mode, path alias `@/*` → `./src/*`
- Never suppress errors with `as any`, `@ts-ignore`, `@ts-expect-error`
- Use `type` imports: `import type { Foo } from "..."`

### Formatting

- **Double quotes**, **no semicolons**, 2-space indent, trailing commas
- No Prettier — follow existing patterns

### Import Order

1. React/Next.js → 2. External libs → 3. `@/` internal aliases → 4. Relative (rare)

### Components

- Named exports: `export function MyComponent() { ... }`
- Exception: page/layout files use `export default async function`
- `"use client"` as first line for client components
- Props via `interface FooProps { ... }` above component
- `cn()` from `@/lib/utils` for conditional classNames
- Icons from `lucide-react`, toasts from `sonner`
- **DO NOT manually edit** files in `src/components/ui/` (shadcn auto-generated)

### Naming

| Entity | Convention | Example |
|---|---|---|
| Files | kebab-case | `editor-shell.tsx` |
| Components | PascalCase | `EditorShell` |
| Functions | camelCase | `createClient` |
| Constants | UPPER_SNAKE_CASE | `MOBILE_BREAKPOINT` |
| Types/Interfaces | PascalCase | `EditorShellProps` |
| Route handlers | `route.ts` exporting `POST`/`GET` | `api/ai/write/route.ts` |
| Server actions | `"use server"` files in `actions/` | `projects.ts` |

### API Route Pattern

```
Auth check → parse body → fetch story context → call OpenAI → stream response
```

Return `Response.json({ error: "..." }, { status: N })` for errors. Chinese error messages for user-facing strings. Log to `ai_history` in `finally` block.

### Server Action Pattern

```ts
"use server"
import { createClient } from "@/lib/supabase/server"

export async function doSomething(args: Type) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }
  // ... business logic ...
  revalidatePath("/relevant-path")
  return { data: result }
}
```

### Supabase

- Server: `await createClient()` from `@/lib/supabase/server` (async, needs cookies)
- Browser: `createClient()` from `@/lib/supabase/client` (sync)
- Both typed with `Database` generic from `@/types/database`
- Always filter by `user_id` for RLS compliance

### Locale

All UI strings in Chinese (zh-CN). date-fns uses `zhCN` locale. HTML lang: `zh-CN`.

## Agent Team 系统

WriteTeam 配置了 Claude Code 原生 Agent Team 系统，支持多角色协作开发。

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

### 选择性 Spawn 策略

| 任务类型 | 需要 spawn 的角色 |
|----------|-------------------|
| 简单 bug 修复 | backend-dev 或 frontend-dev（单个） |
| 新 AI 写作功能 | ai-writing-expert, architect, backend-dev, frontend-dev |
| UI 改版 | ux-designer, frontend-dev, zh-cn-specialist |
| 数据库功能 | architect, backend-dev |
| 完整端到端功能 | 按需 5-7 个角色 |

### 工作流阶段

1. **分析** (`.claude/workflows/phase-1-analysis.md`) — 收集上下文、调研
2. **规划** (`.claude/workflows/phase-2-planning.md`) — PRD、UX 设计、本地化审查
3. **架构** (`.claude/workflows/phase-3-solutioning.md`) — 数据模型、API、Story 分解
4. **实施** (`.claude/workflows/phase-4-implementation.md`) — Sprint 规划、开发、质量门
5. **专属** (`.claude/workflows/writeteam-specific.md`) — 新 AI 功能、Story Bible 扩展
