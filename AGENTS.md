# AGENTS.md
Guidance for coding agents working in `D:\writeteam`.
WriteTeam is a zh-CN AI creative-writing app (Next.js 16, React 19, TypeScript, Supabase, TipTap, Tailwind v4, Vitest).

## Scope And Priority
- Applies repository-wide unless a deeper `AGENTS.md` overrides it.
- User/system/developer instructions override this file.

## Core Principles
- Make minimal, surgical changes aligned with existing architecture.
- Keep user-facing copy in Simplified Chinese.
- Fix root causes instead of patching symptoms.
- Avoid unrelated refactors while solving focused tasks.
- Preserve strict typing, auth checks, and user-data ownership constraints.

## Repository Map
- `src/app/**`: routes, layouts, API handlers, route groups.
- `src/app/actions/*.ts`: Server Actions (auth, documents, projects, series, canvas, images, plugins, story-bible).
- `src/app/api/ai/**/route.ts`: 21 AI POST endpoint route handlers.
- `src/app/api/auth/callback/`: Supabase OAuth callback.
- `src/components/**`: UI and feature components.
- `src/lib/ai/`: AI logic (streaming, config, prompts, error classification, prose modes).
- `src/lib/supabase/`: Supabase client helpers (`server.ts` for server, `client.ts` for browser).
- `src/types/database.ts`: TypeScript interfaces for all DB tables.
- `src/proxy.ts`: Next.js 16 proxy (replaces middleware.ts) for Supabase session refresh and auth redirects.
- `scripts/run-tests.mjs`: test entry used by `npm run test`.

## Build/Lint/Test Commands
Run all commands from repository root.

### App Commands
- `npm install` -- install dependencies
- `npm run dev` -- Next dev server on `0.0.0.0:3000`
- `npm run build` -- production build
- `npm run start` -- start production server
- `npm run lint` -- ESLint (core-web-vitals + typescript)

### Main Test Command
- `npm run test` -- runs `node scripts/run-tests.mjs`
- Executes a curated list of Vitest files, then Node contract tests.
- With no extra args, script also runs contract tests in `tests/`.

### Vitest-Only Mode
- `npm run test -- --reporter=default`
- Passing any extra arg triggers Vitest-only behavior (skips contract tests).

### Single-Test Commands (important)
- Single file: `npx vitest run src/path/to/file.test.ts`
- Single test by name: `npx vitest run src/path/to/file.test.ts -t "test name"`
- Watch one file: `npx vitest src/path/to/file.test.ts`
- Contract test: `npx vitest run src/app/api/ai/collab-routes.contract.test.ts`
- Node contract test: `node --test tests/story-4-2-quick-edit.test.mjs`

## Code Style Guidelines

### TypeScript And Types
- `tsconfig.json` is strict (`strict: true`); keep code strictly typed.
- Prefer explicit interfaces/types for non-trivial object shapes.
- Use `import type` for type-only imports.
- Narrow `unknown` using type guards before access.
- Use unions/string literals for constrained states or modes.

### Forbidden Type Patterns
- `as any`, `@ts-ignore`, `@ts-expect-error` -- never use these.

### Imports
- Use path alias `@/*` (maps to `./src/*`).
- Group: 1) external packages, 2) internal modules (`@/...` or relative), 3) type-only imports.
- Keep import style consistent with nearby files.

### Formatting
- Double quotes, no semicolons (match existing code).
- Trailing commas in multiline objects/arrays where existing style does.
- Do not reformat unrelated code. Favor readability over cleverness.

### Naming
- English identifiers for code symbols; Chinese for UI strings and error messages.
- Verb-first function names: `getX`, `createX`, `updateX`, `deleteX`, `handleX`.
- Use helper functions for repeated validation/sanitization logic.

## Client/Server/API Conventions

### Client Components
- `"use client"` on first line when required.
- Standard React hooks for state/effects.
- Actionable Chinese error feedback (toast and/or inline state).

### Server Actions (`src/app/actions/`)
- `"use server"` at top of file.
- Create Supabase client with `createClient()` from `@/lib/supabase/server`.
- Authenticate early: `supabase.auth.getUser()`.
- Enforce ownership: `.eq("user_id", user.id)`.
- Return structured payloads: `{ error: "..." }`, `{ success: true }`, `{ data }`.
- Call `revalidatePath(...)` after mutations that affect rendered pages.

### API Route Handlers
- Use `NextRequest` and explicit method exports (`POST`, etc.).
- Parse `request.json()` defensively with try/catch.
- Early returns for missing/invalid fields with status-appropriate JSON (400, 401, 403, 500).
- Return safe Chinese error messages; keep diagnostics private.

## AI Route Requirements
All 21 AI route handlers follow this pipeline:
1. Authenticate user via `supabase.auth.getUser()`.
2. Resolve BYOK config with `resolveAIConfig(request)` (reads `X-AI-Base-URL`, `X-AI-API-Key`, `X-AI-Model-ID` headers).
3. Load story context with `fetchStoryContext(...)`.
4. Build prompt context with `buildStoryPromptContext(...)`.
5. Stream response with `createOpenAIStreamResponse(...)`.

Key AI files:
- `src/lib/ai/story-context.ts` -- context orchestration, prompt engineering (17 features).
- `src/lib/ai/openai-stream.ts` -- OpenAI-compatible streaming + `ai_history` telemetry.
- `src/lib/ai/resolve-config.ts` -- BYOK config extraction from request headers.
- `src/lib/ai/error-classification.ts` -- structured error classification with recovery actions.
- `src/lib/ai/prose-mode.ts` -- 5 prose styles (balanced, cinematic, lyrical, minimal, match-style).

Additional AI rules:
- Preserve telemetry (`ai_history` table, retry/recovery metadata).
- Use `extractRetryMeta(...)` where recovery/retry applies.
- Never log, persist, or expose provider API keys.

## Error Handling
- Return actionable Chinese errors (retry/refresh/config hints when useful).
- Avoid empty `catch {}` unless intentionally falling back safely.
- Keep error payload shape consistent inside each feature.
- In UI, pair transient toasts with stable inline error state when needed.

## Testing Conventions
- Vitest for unit/component/API tests under `src/**`.
- Co-locate tests with source (`.test.ts` / `.test.tsx`).
- Use `.contract.test.ts` for contract-style route tests.
- Component tests use `@vitest-environment jsdom` pragma at top of file.
- Reuse existing mocking patterns (`vi.mock`, `vi.stubGlobal`, Supabase mocks).
- Run nearest affected tests first, then broader suite.
- Add new shadcn/ui components via `npx shadcn@latest add <component>`.

## Security And Data Safety
- Never bypass auth checks in actions/routes.
- Never remove ownership constraints on user data queries.
- Never hardcode credentials or leak secrets in logs/errors.
- Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Completion Checklist
Before declaring work complete:
1. Confirm changed files remain type-safe.
2. Run focused tests for modified areas.
3. Run `npm run lint` for non-trivial edits.
4. Run `npm run build` for cross-cutting or release-critical edits.
5. Confirm no secrets, no forbidden type suppression, and no unrelated changes.
