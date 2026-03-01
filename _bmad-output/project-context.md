---
project_name: writeteam
user_name: fafa
date: 2026-03-01
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: complete
rule_count: 35
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js | 16.1.6 |
| UI 库 | React | 19.2.3 |
| 语言 | TypeScript | 5.x (strict 模式已启用) |
| 样式 | Tailwind CSS | v4 |
| 数据库/Auth | Supabase | @supabase/ssr 0.8.0, @supabase/supabase-js 2.97.0 |
| 富文本编辑器 | TipTap | 3.20.0 |
| 测试框架 | Vitest | 3.2.4 |
| 代码规范 | ESLint | 9 (eslint-config-next) |
| AI SDK | AI SDK | 6.0.100 |

**关键依赖：** `@xyflow/react`, `shadcn/ui`, `sonner`, `zod`, `date-fns`

---

## Critical Implementation Rules

### Language-Specific Rules

- **TypeScript：** strict 模式启用，禁止 `as any`/`@ts-ignore`/`@ts-expect-error`；使用 `import type`；路径别名 `@/*`
- **Import/Export：** 外部模块 → 内部模块 → 类型导入分组
- **错误处理：** 必须返回可操作的中文错误；禁止空 catch 块

### Framework-Specific Rules

- **Client 组件：** `"use client"` 放在首行
- **Server Actions：** `"use server"` 顶部；使用 `createClient()`；`supabase.auth.getUser()` 认证；`eq("user_id", user.id)` 所有权过滤；`revalidatePath(...)`
- **API 路由：** `NextRequest`；防御性 `request.json()`；状态适当 JSON 错误
- **性能：** 优先 Server Components；避免不必要客户端渲染

### Testing Rules

- 测试文件同目录：`.test.ts` / `.test.tsx`；Node 测试：`tests/*.mjs`
- 使用 `vi.mock`、`vi.stubGlobal`
- 先跑受影响测试，再跑广泛检查

### Code Quality & Style Rules

- **代码组织：** `src/app/**`、`src/components/**`、`src/lib/**`、`src/types/**`
- **命名：** 描述性英文标识符；动词函数 `getX`/`createX`/`updateX`...
- **UX 文本：** 保持中文

### Development Workflow Rules

- 分支：`feature/xxx`、`fix/xxx`
- 提交前必跑：`npm run lint` && `npm run build`
- 环境变量：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Critical Don't-Miss Rules

- **Anti-Patterns：** 禁止类型 suppression、删除失败测试、shotgun debugging
- **安全：** 不绕过认证、不移除所有权约束、不暴露密钥
- **AI Pipeline：** BYOK 验证、上下文加载、流式传输、不记录 API 密钥

---

## Usage Guidelines

**For AI Agents:**
- 实现前阅读此文件
- 严格遵循所有规则
- 有疑问时倾向更严格选项
- 新模式出现时更新此文件

**For Humans:**
- 保持文件精简聚焦
- 技术栈变更时更新
- 季度性审查去除过时规则

---

_Last Updated: 2026-03-01_
