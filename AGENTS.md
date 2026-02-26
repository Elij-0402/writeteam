# AGENTS.md — WriteTeam

## Project Overview

WriteTeam is a full-stack AI creative writing app (Chinese-language UI). Stack: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4, shadcn/ui, Supabase (Auth + Postgres + RLS), TipTap editor, OpenAI API.

## Repository Structure

Monorepo: root `package.json` delegates all commands to `writeteam/`.

```
writeteam/src/
  app/
    actions/        ← server actions (auth, projects, documents, story-bible)
    api/ai/         ← AI route handlers (write, rewrite, chat, etc.)
    (auth)/         ← login, signup pages
    (dashboard)/    ← dashboard layout + page
    (editor)/       ← editor page ([id] dynamic route)
  components/
    ui/             ← shadcn/ui primitives (DO NOT manually edit)
    editor/         ← TipTap editor shell
    ai/             ← AI toolbar, chat panel
    story-bible/    ← story bible panel
    providers/      ← auth + theme providers
  lib/
    supabase/       ← server.ts, client.ts
    ai/             ← prose-mode.ts, openai-stream.ts
    utils.ts        ← cn() helper
  types/
    database.ts     ← Supabase typed schema
```

## Build / Lint / Dev Commands

Run from **repository root** (`D:\writeteam`):

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint (flat config, core-web-vitals + typescript)
```

Or from `writeteam/` directly: `npm run dev|build|lint`.

### Tests

No test framework configured. If adding tests, use Vitest.

### Environment Variables

Required in `writeteam/.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (server-only — never `NEXT_PUBLIC_`)

## Code Style

### TypeScript
- **Strict mode** enabled; path alias `@/*` → `./src/*`
- Target: ES2017, module: esnext, moduleResolution: bundler
- Never suppress errors with `as any`, `@ts-ignore`, `@ts-expect-error`
- Use explicit types for parameters; infer return types when obvious
- Use `type` imports: `import type { Foo } from "..."`

### Formatting
- **Double quotes** for strings
- **No semicolons** (some shadcn/ui files have them; don't fight)
- 2-space indentation
- Trailing commas in multi-line structures

### Imports
Order: React/Next.js → External libs → `@/` aliases → Relative (rare)

```tsx
import {
  Card,
  CardContent,
} from "@/components/ui/card"
```

### Components
- Functional components only; named exports: `export function MyComponent() { ... }`
- Page/layout files: `export default async function`
- Client components: `"use client"` as first line
- Props: `interface FooProps { ... }` above component
- Use `cn()` from `@/lib/utils` for classNames
- Icons from `lucide-react`; toasts from `sonner`

### Naming

| Entity | Convention | Example |
|---|---|---|
| Files | kebab-case | `editor-shell.tsx` |
| Components | PascalCase | `EditorShell` |
| Functions | camelCase | `createClient` |
| Constants | UPPER_SNAKE_CASE | `AUTH_TIMEOUT_MS` |
| Types | PascalCase | `EditorShellProps` |
| Server actions | `"use server"` files in `actions/` | `auth.ts` |
| API routes | `route.ts` exporting POST/GET | `api/ai/write/route.ts` |

### Server Actions Pattern

```ts
"use server"
import { createClient } from "@/lib/supabase/server"

export async function doSomething(args: Type) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }
  // ... business logic ...
  if (error) return { error: error.message }
  revalidatePath("/relevant-path")
  return { data: result }
}
```

### API Routes Pattern

- Located in `src/app/api/ai/*/route.ts`
- Auth check → parse body → fetch story context → call OpenAI → stream response
- Use manual `fetch()` to OpenAI (not AI SDK streaming)
- Log to `ai_history` table in `finally` block
- Return `Response.json({ error: "..." }, { status: N })`
- Chinese error messages for user-facing strings

### Error Handling

- Server actions: return `{ error: string }` on failure
- API routes: return `Response.json({ error }, { status })`
- Client: `toast.error(result.error)` for feedback
- Empty `catch {}` only for intentionally swallowed errors
- Auth timeout wrapper: see `src/app/actions/auth.ts`

### Supabase
- Server: `await createClient()` from `@/lib/supabase/server` (async)
- Browser: `createClient()` from `@/lib/supabase/client` (sync)
- Both typed with `Database` from `@/types/database`
- Always filter by `user_id` for RLS compliance

### UI Framework
- **shadcn/ui** (new-york style) — don't manually edit `src/components/ui/`
- Add components: `npx shadcn@latest add <component>` (from `writeteam/`)
- Tailwind CSS v4; `next-themes` for dark/light mode

### Locale
- UI strings in **Chinese (zh-CN)**: `"未登录"`, `"保存成功"`
- date-fns: `zhCN` locale; HTML lang: `zh-CN`

## Verification

```bash
npm run lint   # must pass
npm run build  # must succeed (requires .env.local)
```

## Key Gotchas

1. Monorepo: root scripts use `npm --prefix writeteam`
2. No `middleware.ts` — uses `proxy.ts` instead
3. OpenAI key: server-side only, never `NEXT_PUBLIC_`
4. shadcn/ui files auto-generated — don't edit manually
5. No test suite — plan for Vitest if adding
6. Next.js 16 params are `Promise<{ id: string }>` — must `await`
