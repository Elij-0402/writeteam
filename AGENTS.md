# AGENTS.md — WriteTeam

## Project Overview

WriteTeam is a full-stack AI creative writing app (Chinese-language UI). Stack: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4, shadcn/ui (new-york style), Supabase (Auth + Postgres + RLS), TipTap editor, OpenAI API.

## Repository Structure

Monorepo: root `package.json` delegates all commands to the `writeteam/` subdirectory.

```
writeteam/              ← actual Next.js app
  src/
    app/                ← routes, layouts, API routes, server actions
      actions/          ← server actions (auth, projects, documents, story-bible)
      api/ai/           ← AI route handlers (write, rewrite, chat, brainstorm, etc.)
      (auth)/           ← login, signup pages
      (dashboard)/      ← dashboard layout + page
      (editor)/         ← editor page ([id] dynamic route)
    components/
      ui/               ← shadcn/ui primitives (DO NOT manually edit)
      editor/           ← TipTap editor shell + writing editor
      ai/               ← AI toolbar, chat panel
      dashboard/        ← dashboard content
      story-bible/      ← story bible panel
      providers/        ← auth + theme providers
      layout/           ← command palette
    hooks/              ← custom hooks (use-mobile)
    lib/
      supabase/         ← server.ts, client.ts, middleware.ts
      ai/               ← prose-mode.ts, telemetry.ts
      utils.ts          ← cn() helper
    types/
      database.ts       ← Supabase typed schema (Row/Insert/Update)
    proxy.ts            ← Next.js proxy (replaces middleware)
  supabase/migrations/  ← SQL migration files
```

## Build / Lint / Dev Commands

All commands run from the **repository root** (`D:\writeteam`):

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run start        # Run production server
npm run lint         # ESLint (flat config, core-web-vitals + typescript)
```

Or from `writeteam/` directly:

```bash
npm run dev          # next dev --hostname 0.0.0.0 --port 3000
npm run build        # next build
npm run lint         # eslint
```

### Tests

No test framework is configured. No test files exist. If adding tests, use Vitest (compatible with Next.js + React 19).

### Environment Variables

Required in `writeteam/.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (server-only — never prefix with `NEXT_PUBLIC_`)

Build will fail without Supabase env vars.

## Code Style

### TypeScript

- **Strict mode** enabled (`tsconfig.json`)
- Path alias: `@/*` maps to `./src/*`
- Target: ES2017, module: esnext, moduleResolution: bundler
- Never suppress errors with `as any`, `@ts-ignore`, or `@ts-expect-error`
- Use explicit types for function parameters; infer return types when obvious
- Use `type` imports where possible: `import type { Foo } from "..."`

### Formatting

- **Double quotes** for strings
- **No semicolons** (project convention — some shadcn/ui auto-generated files have them; don't fight those)
- 2-space indentation
- Trailing commas in multi-line structures
- No Prettier configured — follow existing patterns

### Imports

Order (observe existing files):
1. React / Next.js imports
2. External libraries (`@supabase/*`, `lucide-react`, `sonner`, `date-fns`, etc.)
3. Internal `@/` aliases (`@/components/...`, `@/lib/...`, `@/types/...`, `@/app/...`)
4. Relative imports (rare — prefer `@/` aliases)

Group multi-item imports from the same package:
```tsx
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
```

### Components

- **Functional components only** — no class components
- Named exports: `export function MyComponent() { ... }`
- Exception: page/layout files use `export default async function`
- Client components: add `"use client"` as first line
- Props defined via `interface FooProps { ... }` above the component
- Use `cn()` from `@/lib/utils` for conditional classNames
- Icons: import from `lucide-react`
- Toasts: use `toast` from `sonner` (`toast.success()`, `toast.error()`)

### Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Files (components) | kebab-case | `editor-shell.tsx` |
| Files (utils/hooks) | kebab-case | `use-mobile.ts`, `prose-mode.ts` |
| Components | PascalCase | `EditorShell`, `AIToolbar` |
| Functions | camelCase | `createClient`, `handleCreateDocument` |
| Constants | UPPER_SNAKE_CASE | `MOBILE_BREAKPOINT`, `AUTH_TIMEOUT_MS` |
| Types/Interfaces | PascalCase | `EditorShellProps`, `ProseMode` |
| Route handlers | `route.ts` exporting `POST`/`GET` etc. | `src/app/api/ai/write/route.ts` |
| Server actions | `"use server"` files in `src/app/actions/` | `projects.ts`, `auth.ts` |

### Server Actions Pattern

```ts
"use server"

import { createClient } from "@/lib/supabase/server"

export async function doSomething(args: Type) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: "未登录" }
  }

  // ... business logic ...

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/relevant-path")
  return { data: result }  // or { success: true }
}
```

### API Route Handlers Pattern

- Located in `src/app/api/ai/*/route.ts`
- Auth check → parse body → fetch story bible context → call OpenAI → stream response
- Use manual `fetch()` to OpenAI (not the AI SDK's streaming helpers)
- Log to `ai_history` table in the `finally` block
- Return `Response.json({ error: "..." }, { status: N })` for errors
- Chinese error messages for user-facing strings

### Error Handling

- Server actions return `{ error: string }` on failure
- API routes return `Response.json({ error }, { status })` 
- Client-side: `toast.error(result.error)` for user feedback
- Use empty `catch {}` only for intentionally swallowed errors (e.g., cookie setting in RSC)
- Auth timeout wrapper pattern in `src/app/actions/auth.ts`

### Supabase

- Server client: `await createClient()` from `@/lib/supabase/server` (async — needs cookies)
- Browser client: `createClient()` from `@/lib/supabase/client` (sync)
- Both are typed with `Database` generic from `@/types/database`
- Always filter by `user_id` for RLS compliance
- Database types: update `src/types/database.ts` when schema changes

### UI Framework

- **shadcn/ui** (new-york style) — DO NOT manually edit files in `src/components/ui/`
- Add new components via: `npx shadcn@latest add <component>` (run from `writeteam/`)
- Tailwind CSS v4 with `@tailwindcss/postcss`
- CSS variables for theming (zinc base color)
- `next-themes` for dark/light mode
- Resizable panels via `react-resizable-panels`

### Locale

- UI strings are in **Chinese (zh-CN)**: `"未登录"`, `"项目创建成功！"`, etc.
- date-fns locale: `zhCN` from `date-fns/locale`
- HTML lang: `zh-CN`

## Verification Checklist

Before submitting changes:

```bash
npm run lint         # must pass
npm run build        # must succeed (requires .env.local with Supabase vars)
```

## Key Gotchas

1. **Monorepo delegation**: Root scripts use `npm --prefix writeteam`. Install deps inside `writeteam/`.
2. **No middleware.ts**: Uses `proxy.ts` instead (Next.js 16 convention).
3. **OpenAI key**: Must be server-side only. Never expose via `NEXT_PUBLIC_` prefix.
4. **shadcn/ui files**: Auto-generated. Don't manually edit `src/components/ui/*`.
5. **No test suite**: No tests exist yet. Plan for Vitest if adding tests.
6. **Params are async**: Next.js 16 page params are `Promise<{ id: string }>` — must `await`.
