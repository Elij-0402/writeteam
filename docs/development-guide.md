# WriteTeam — 开发指南

> 生成日期: 2026-02-27

## 前置要求

| 工具 | 版本 | 用途 |
|------|------|------|
| Node.js | 20+ | 运行时 |
| npm | 10+ | 包管理器 (或 pnpm) |
| Supabase 项目 | — | 数据库 + 认证 |
| AI API Key | — | BYOK — 用户自带 (DeepSeek/OpenAI/Ollama 等) |

## 快速开始

### 1. 克隆并安装依赖

```bash
git clone <repo-url>
cd writeteam
npm install
```

> 注意: 根目录的 `package.json` 是代理，会将命令转发到 `writeteam/` 子目录。

### 2. 配置环境变量

在 `writeteam/` 目录下创建 `.env.local`:

```bash
cd writeteam
cp .env.local.example .env.local
```

必需变量:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> 无需 `OPENAI_API_KEY` — 应用使用 BYOK 模式，用户在设置页面配置自己的 API Key。

### 3. 设置数据库

在 Supabase SQL Editor 中按顺序执行迁移:

```
writeteam/supabase/migrations/001_initial_schema.sql
writeteam/supabase/migrations/002_ai_quality_observability.sql
...
writeteam/supabase/migrations/010_images.sql
```

或使用 Supabase CLI:

```bash
cd writeteam
npx supabase db push
```

### 4. 启动开发服务器

```bash
npm run dev
```

打开 `http://localhost:3000`。

## 开发命令

| 命令 | 说明 | 执行位置 |
|------|------|----------|
| `npm run dev` | 启动开发服务器 (0.0.0.0:3000) | 根目录或 writeteam/ |
| `npm run build` | 生产构建 | 根目录或 writeteam/ |
| `npm run start` | 运行生产服务器 | 根目录或 writeteam/ |
| `npm run lint` | ESLint 检查 | 根目录或 writeteam/ |

## 项目结构导航

### 路径别名

`@/*` 映射到 `writeteam/src/*` (配置在 tsconfig.json)。

```typescript
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import type { Project } from "@/types/database"
```

### 路由组约定

| 路由组 | 路径 | 认证 | 用途 |
|--------|------|------|------|
| `(auth)/` | /login, /signup | 公开 | 认证页面 |
| `(dashboard)/` | /dashboard, /series, /settings | 需认证 (layout 守卫) | 项目管理 |
| `(editor)/` | /editor/[id], /canvas/[id] | 需认证 (page 守卫) | 编辑器 |

### 文件命名约定

| 文件 | 约定 | 示例 |
|------|------|------|
| 页面 | `page.tsx` | `app/(dashboard)/dashboard/page.tsx` |
| 布局 | `layout.tsx` | `app/(dashboard)/layout.tsx` |
| API 路由 | `route.ts` | `app/api/ai/write/route.ts` |
| Server Action | kebab-case `.ts` | `app/actions/story-bible.ts` |
| 组件 | kebab-case `.tsx` | `components/editor/editor-shell.tsx` |
| 库 | kebab-case `.ts` | `lib/ai/story-context.ts` |

## 常见开发任务

### 添加新的 AI 功能

1. **创建 API Route**: `src/app/api/ai/[feature-name]/route.ts`

```typescript
import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import { createOpenAIStreamResponse } from "@/lib/ai/openai-stream"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) return new Response(JSON.stringify({ error: "AI 未配置" }), { status: 400 })

  const { projectId, documentId, /* ...params */ } = await request.json()

  const storyCtx = await fetchStoryContext(supabase, projectId)
  const { fullContext } = buildStoryPromptContext(storyCtx, { feature: "your-feature" })

  return createOpenAIStreamResponse(
    {
      messages: [
        { role: "system", content: `${fullContext}\n\nYour system prompt here.` },
        { role: "user", content: "User prompt" }
      ],
      maxTokens: 1000,
      temperature: 0.7,
      ...aiConfig,
    },
    { supabase, userId: user.id, projectId, documentId, feature: "your-feature", promptLog: "..." }
  )
}
```

2. **在 `story-context.ts` 的 `AIFeature` 类型中添加新功能名**
3. **在 `AIToolbar` 或其他 UI 组件中添加按钮调用**

### 添加新的 shadcn/ui 组件

```bash
cd writeteam
npx shadcn@latest add <component-name>
```

组件会安装到 `src/components/ui/`。

### 添加新的数据库表

1. 在 `supabase/migrations/` 创建新迁移文件 (编号递增)
2. 在 `src/types/database.ts` 添加 TypeScript 类型
3. 创建对应的 Server Action 文件
4. 确保启用 RLS 并添加 `user_id = auth.uid()` 策略

### 添加新的 Server Action

在 `src/app/actions/` 创建或修改文件:

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function yourAction(params: YourParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  // DB 操作...

  revalidatePath("/relevant-path")
  return { data: result }
}
```

## 代码约定

### 通用规则

- 所有用户可见字符串使用**中文 (zh-CN)**
- Server Actions 必须在 DB 操作前调用 `supabase.auth.getUser()` 验证身份
- AI 路由遵循统一管道: auth → resolveAIConfig → fetchStoryContext → buildStoryPromptContext → stream
- 文档内容存储为 TipTap JSON (`content` 列) + 纯文本镜像 (`content_text` 列)

### TypeScript

- 严格模式 (`strict: true`)
- 路径别名: `@/*` → `src/*`
- 数据库类型从 `@/types/database` 导入

### 样式

- Tailwind CSS v4 (PostCSS 插件)
- shadcn/ui (new-york 风格, zinc 基色, oklch 色彩空间)
- CSS 变量定义在 `globals.css` 的 `:root` 和 `.dark`

## 构建验证

推送前建议执行:

```bash
npm run lint    # ESLint 检查
npm run build   # 生产构建验证
```

如果 build 因缺少 Supabase 环境变量失败，确保 `.env.local` 存在且包含所有必需的 key。

## 测试

当前项目未配置自动化测试框架。建议添加:
- **单元测试**: Vitest (与 Next.js 16 兼容)
- **组件测试**: @testing-library/react
- **E2E 测试**: Playwright

## 部署

### 环境变量

生产环境需要:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Vercel 部署

项目结构兼容 Vercel 部署。需将根目录设置为 `writeteam/` 或配置 build 命令:
```
Build Command: cd writeteam && npm run build
Output Directory: writeteam/.next
```

### 数据库迁移

生产环境需按顺序执行 `supabase/migrations/` 中的 10 个迁移文件。
