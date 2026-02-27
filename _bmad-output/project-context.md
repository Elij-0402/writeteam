---
project_name: 'writeteam'
user_name: 'Elij'
date: '2026-02-27'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 85
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Core Framework
- **Next.js** 16.1.6 (App Router, `src/proxy.ts` replaces deprecated middleware)
- **React** 19.2.3
- **TypeScript** ^5 (strict mode enabled)

### UI Layer
- **Tailwind CSS** v4 (with `@tailwindcss/postcss`, `tw-animate-css`)
- **shadcn/ui** ^3.8.5 (new-york style, components in `src/components/ui/`)
- **Radix UI** ^1.4.3 (via `radix-ui` unified package)
- **Lucide React** ^0.575.0 (icons)
- **next-themes** ^0.4.6 (dark/light mode)

### Editor
- **TipTap** ^3.20.0 (StarterKit, CharacterCount, Highlight, Typography, Placeholder, BubbleMenu)

### Database & Auth
- **@supabase/supabase-js** ^2.97.0
- **@supabase/ssr** ^0.8.0 (server/client cookie-based auth)

### AI
- **Vercel AI SDK** (`ai` ^6.0.100, `@ai-sdk/openai` ^3.0.33)
- BYOK architecture — no server-side API keys required

### Canvas
- **@xyflow/react** ^12.10.1 (visual story planning)

### Forms & Validation
- **React Hook Form** ^7.71.2 + **@hookform/resolvers** ^5.2.2
- **Zod** ^4.3.6

### Import/Export
- **mammoth** ^1.11.0 (docx import)
- **docx** ^9.6.0 (docx export)
- **file-saver** ^2.0.5

### Other
- **date-fns** ^4.1.0, **sonner** ^2.0.7, **cmdk** ^1.1.1
- **react-resizable-panels** ^4.6.5, **class-variance-authority** ^0.7.1, **clsx** ^2.1.1, **tailwind-merge** ^3.5.0

### Dev Dependencies
- **ESLint** ^9 (flat config: `eslint-config-next` core-web-vitals + typescript)
- **pnpm** (package manager, lockfile: `pnpm-lock.yaml`)

### Version Constraints
- Next.js 16 uses `proxy.ts` convention (NOT deprecated `middleware.ts`)
- React 19 — use new React 19 APIs where applicable
- Tailwind CSS v4 — uses `@tailwindcss/postcss`, NOT legacy `tailwindcss/postcss7-compat`
- Zod v4 — API differences from v3 (e.g., `z.object()` inference changes)

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

#### Configuration Requirements
- TypeScript strict mode 已启用 — 所有代码必须通过 strict 检查
- Target: `ES2017`, Module: `esnext`, Module Resolution: `bundler`
- Path alias: `@/*` → `src/*` — 始终使用 `@/` 前缀而非相对路径（跨目录引用时）
- `isolatedModules: true` — 不要使用 `const enum` 或仅类型的 re-export

#### Import/Export Patterns
- 使用 `import type { ... }` 区分类型导入和值导入
- 外部库导入在前，`@/` 路径导入在后，相对路径导入最后
- Server Actions 文件必须以 `"use server"` 开头
- Client Components 必须以 `"use client"` 开头
- 不要在 Server Components 中导入 Client-only 的库（如 TipTap、@xyflow/react）

#### Type Patterns
- 数据库类型统一定义在 `src/types/database.ts`，使用 `Row`/`Insert`/`Update` 泛型变体
- JSON 列使用 `Json` 类型（`string | number | boolean | null | Json[] | { [key: string]: Json | undefined }`）
- 组件 Props 使用 `interface`（如 `interface EditorShellProps`）
- 联合类型和工具类型使用 `type`（如 `type AIFeature = "write" | "rewrite" | ...`）
- 用 `?.` 和 `??` 处理可空值，避免非空断言 `!`

#### Error Handling Patterns
- API Route Handlers: `return Response.json({ error: "message" }, { status: CODE })`
- Server Actions: `return { error: "未登录" }` 或 `return { data: result }`
- 客户端: 用 `sonner` 的 `toast.error()` 显示错误
- Supabase 查询后始终检查 `error` 属性
- AI 流式调用用 `try...catch` 包裹

#### Async Patterns
- 所有 DB 操作和 AI 调用使用 `async/await`
- Supabase 查询链式调用: `.from().select().eq().single()` 等
- 不使用回调式 Promise（`.then().catch()`），统一用 `async/await`

### Framework-Specific Rules (Next.js 16 / React 19)

#### Next.js App Router Conventions
- 路由分组: `(auth)/` 公开页面, `(dashboard)/` 需认证, `(editor)/` 编辑器
- API Routes 在 `src/app/api/` 下，每个功能一个目录含 `route.ts`，仅导出 `POST`
- Server Actions 在 `src/app/actions/` 下，按实体分文件（documents.ts, projects.ts 等）
- 使用 `proxy.ts`（Next.js 16 convention）而非 `middleware.ts` — 绝对不要创建 `middleware.ts`
- 数据变更后调用 `revalidatePath()` 刷新缓存

#### AI API Route 固定模式（所有 AI 端点必须遵循）
```typescript
// 1. Auth check
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return Response.json({ error: "未登录" }, { status: 401 })

// 2. BYOK config from headers
const aiConfig = resolveAIConfig(request)
if (!aiConfig) return Response.json({ error: "未配置AI" }, { status: 400 })

// 3. Story context from DB
const storyContext = await fetchStoryContext(supabase, projectId)
const systemPrompt = buildStoryPromptContext(storyContext, { feature, proseMode, saliencyMap })

// 4. Stream response
return createOpenAIStreamResponse({ messages, systemPrompt, ...aiConfig }, { supabase, userId, projectId, ... })
```

#### Server Action 固定模式
```typescript
"use server"
export async function actionName(...) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }
  // DB operation...
  revalidatePath("/relevant-path")
  return { data: result }
}
```

#### React Hooks 使用规则
- 用 `useState` 管理本地组件状态
- 用 `useCallback` 包裹传递给子组件的函数（防止不必要重渲染）
- 用 `useRef` 存储 TipTap editor 实例等不触发重渲染的值
- 用 `useEffect` 处理副作用（如 debounced saliency 计算，autosave）
- 全局状态通过 Context Provider: `useAuth()`, `useAIConfig()`

#### Provider 嵌套顺序（不可更改）
```
ThemeProvider > AuthProvider > AIConfigProvider > TooltipProvider
```

#### Supabase 客户端使用规则
- Server Components / Actions / Route Handlers → `import { createClient } from "@/lib/supabase/server"`
- Client Components → `import { createClient } from "@/lib/supabase/client"`
- 绝对不要在客户端导入 server 版本，或在服务端导入 client 版本

#### BYOK 数据流
- 客户端: localStorage (`AI_CONFIG_STORAGE_KEY`) → HTTP Headers (`X-AI-Base-URL`, `X-AI-API-Key`, `X-AI-Model-ID`)
- 服务端: `resolveAIConfig(request)` 从 headers 提取配置
- 服务端不存储任何 API Key — 全部由用户在客户端提供

#### shadcn/ui 组件规则
- 组件放在 `src/components/ui/`，通过 `npx shadcn@latest add <component>` 添加
- 使用 new-york style — 不要混用 default style
- 使用 `cva` (class-variance-authority) 定义组件变体
- 使用 `cn()` (from `@/lib/utils`) 合并 Tailwind 类名

### Testing Rules

#### Current State
- 项目尚未配置测试框架 — 无 Jest/Vitest/Playwright 配置文件
- 无现有测试文件 (`*.test.ts`, `*.spec.ts`, `__tests__/`)
- 验证当前依赖 `npm run build` + `npm run lint` 通过

#### When Tests Are Added (Future Guidelines)
- 优先推荐 **Vitest**（与 Next.js 16 + TypeScript 兼容性好）
- 测试文件与源文件同目录，命名: `{source-name}.test.ts(x)`
- Server Actions 和 AI routes 测试需 mock Supabase client
- 组件测试需 mock Context Providers（AuthProvider, AIConfigProvider）
- AI 流式响应测试需 mock `createOpenAIStreamResponse`
- 不要测试 shadcn/ui 基础组件（已由上游维护）

#### Build Verification
- 每次代码变更后运行 `npm run build` 确保无编译错误
- 每次代码变更后运行 `npm run lint` 确保无 lint 错误
- 根 `package.json` 代理命令到 `writeteam/` 子目录

### Code Quality & Style Rules

#### ESLint Configuration
- ESLint 9 flat config (`eslint.config.mjs`)
- 启用 `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- 忽略: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`
- 无 Prettier — 代码格式依赖 ESLint 规则

#### File & Folder Naming
- 所有文件和目录使用 `kebab-case`（如 `ai-chat-panel.tsx`, `story-context.ts`）
- Next.js 特殊文件例外: `page.tsx`, `layout.tsx`, `route.ts`, `proxy.ts`
- 路由分组使用括号: `(auth)/`, `(dashboard)/`, `(editor)/`
- 动态路由使用方括号: `[id]/`

#### Component Organization
- 按功能域分目录: `components/ai/`, `components/editor/`, `components/canvas/`, `components/series/`, `components/settings/`
- 共享 UI 组件: `components/ui/`（shadcn/ui 生成）
- Context Providers: `components/providers/`
- 布局组件: `components/layout/`
- 每个组件文件一个主要导出组件

#### Code Organization within Files
- `"use client"` / `"use server"` 指令在文件首行
- 导入分组: 外部库 → `@/` 路径 → 相对路径
- 接口/类型定义在导入之后、组件之前
- 辅助函数定义在主导出组件之前或之后

#### Styling Conventions
- 使用 Tailwind CSS 工具类，不写自定义 CSS（除 `globals.css`）
- 使用 `cn()` 合并条件类名: `cn("base-class", condition && "conditional-class")`
- 暗色模式通过 `dark:` 前缀，由 `next-themes` 的 `ThemeProvider` 管理
- 响应式使用 Tailwind 断点前缀 (`sm:`, `md:`, `lg:`)

#### User-Facing Strings
- 所有用户可见的文本必须使用中文 (zh-CN)
- 错误消息中文化: `"未登录"`, `"未找到项目"`, `"操作失败"` 等
- 代码注释可使用英文或中文，保持全文件一致即可
- 变量名、函数名、类型名使用英文

### Development Workflow Rules

#### Monorepo Structure
- 根目录 `package.json` 将所有命令代理到 `writeteam/` 子目录
- 所有源代码在 `writeteam/src/` 下 — 不在根目录写应用代码
- `_bmad/` 目录为 BMAD 方法论模板 — 不是应用代码，不要修改
- `_bmad-output/` 目录为 BMAD 工作流输出产物
- `docs/` 目录为项目文档

#### Commands (从项目根目录运行)
```bash
npm run dev      # Next.js dev server on 0.0.0.0:3000
npm run build    # Production build (验证编译)
npm run lint     # ESLint 检查
```

#### Database Migrations
- Supabase migrations 在 `writeteam/supabase/migrations/`
- 当前: 001-010（BYOK 版本为止）
- 新 migration 编号递增: `011_description.sql`
- 所有表必须启用 RLS，策略强制 `user_id = auth.uid()`
- 新表必须在 `src/types/database.ts` 中添加对应 TypeScript 类型

#### Environment Variables
- 仅需 2 个环境变量（在 `writeteam/.env.local`）:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 不要添加服务端 AI API Key 环境变量 — BYOK 架构不需要

#### Git Conventions
- Commit messages 使用中文描述
- 示例: `"新增功能：实现 BYOK AI 配置系统"`, `"重构代码结构，以提高可读性和可维护性"`
- 不要在一次 commit 中塞入过多变更（避免 7000+ 行的巨型提交）

#### Adding New Features Checklist
1. 如需新 DB 表 → 创建 migration + 更新 `database.ts` 类型
2. 如需新 API 端点 → 在 `src/app/api/ai/` 下创建目录 + `route.ts`
3. 如需新 Server Action → 在 `src/app/actions/` 对应文件中添加
4. 如需新 UI 组件 → 在 `src/components/{domain}/` 下创建
5. 如需新 shadcn 组件 → `npx shadcn@latest add <name>`（在 `writeteam/` 目录下）
6. 运行 `npm run build` + `npm run lint` 验证

### Critical Don't-Miss Rules

#### Anti-Patterns to Avoid
- 不要创建 `middleware.ts` — Next.js 16 使用 `proxy.ts`，项目已有此文件
- 不要在服务端存储或硬编码 AI API Key — 这是 BYOK 架构，Key 全在客户端
- 不要直接调用 OpenAI/Anthropic SDK — 统一通过 `createOpenAIStreamResponse()` 调用 OpenAI-compatible 端点
- 不要跳过 auth check — 每个 API route 和 Server Action 都必须验证 `supabase.auth.getUser()`
- 不要创建没有 RLS 策略的 Supabase 表 — 所有表必须强制 `user_id = auth.uid()`
- 不要在 Server Components 中使用 `useState`/`useEffect` — 这些是 Client Component hooks
- 不要混用 Supabase server/client — 导入错误的版本会导致 cookie 处理失败
- 不要用英文写用户可见的 UI 文本 — 所有面向用户的字符串必须是中文

#### Edge Cases Agents Must Handle
- TipTap 编辑器内容同时存储为 JSON (`content`) 和纯文本 (`content_text`) + 字数统计 — 更新时两者都要同步
- Story Bible 有 `visibility` 字段控制哪些上下文段落传给 AI — 构建 prompt 时必须尊重此设置
- 项目可能属于一个 Series — `fetchStoryContext()` 会自动合并 series_bible 数据作为 fallback
- AI config 的 `apiKey` 可以是空字符串（Ollama 本地部署场景）— 不要将空字符串视为无效
- `prose_mode` 的 "match-style" 模式需要额外的 `style_sample` 字段 — 如果缺失则降级到 "balanced"
- Saliency 检测支持中文和英文地名模式 — 不要假设只有英文

#### Security Rules
- 永远不要将 `X-AI-API-Key` header 的值记录到日志或遥测中
- `ai_history` 表记录 prompt 和 result 但不记录 API Key
- 所有 Supabase 查询通过 RLS 自动过滤用户数据 — 不要手动构建 `WHERE user_id = ?`（RLS 已处理）
- `.env.local` 不要提交到 git

#### Performance Gotchas
- Saliency 计算使用 5 秒 debounce — 不要在每次按键时触发
- Autosave 使用 1 秒 debounce — 不要用更短的间隔
- `computeSaliency()` 只分析最近 ~2000 字符 — 不要传整篇文档
- `fetchStoryContext()` 在每次 AI 调用时从 DB 获取最新数据 — 不要缓存 story context

#### Key File Reference
| 功能 | 关键文件 |
|------|---------|
| AI Prompt 编排 | `src/lib/ai/story-context.ts` |
| AI 流式响应 | `src/lib/ai/openai-stream.ts` |
| BYOK 配置提取 | `src/lib/ai/resolve-config.ts` |
| 散文风格 | `src/lib/ai/prose-mode.ts` |
| Saliency 分析 | `src/lib/ai/saliency.ts` |
| AI 配置类型 | `src/lib/ai/ai-config.ts` |
| 主编辑器 | `src/components/editor/editor-shell.tsx` |
| 数据库类型 | `src/types/database.ts` |
| Auth 中间件 | `src/lib/supabase/middleware.ts` |
| 请求代理 | `src/proxy.ts` |

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-02-27
