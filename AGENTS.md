# AGENTS.md
Guidance for coding agents working in `D:\writeteam`.
WriteTeam is a zh-CN AI creative-writing app (Next.js 16, React 19, TypeScript, Supabase, TipTap, Tailwind v4, Vitest).

## Scope And Priority
- Applies repository-wide unless a deeper `AGENTS.md` overrides it.
- User/system/developer instructions override this file.
- Use this as default operating guidance, not as permission to ignore explicit task requirements.

## Core Principles
- Make minimal, surgical changes aligned with existing architecture.
- Keep user-facing copy in Simplified Chinese.
- Fix root causes instead of patching symptoms.
- Avoid unrelated refactors while solving focused tasks.
- Preserve strict typing, auth checks, and user-data ownership constraints.

## Repository Map
- `src/app/**`: routes, layouts, API handlers, route groups.
- `src/app/actions/*.ts`: Server Actions.
- `src/app/api/**/route.ts`: API route handlers.
- `src/components/**`: UI and feature components.
- `src/lib/**`: shared logic (AI, Supabase, utilities).
- `src/types/**`: domain/database types.
- `scripts/run-tests.mjs`: test entry used by `npm run test`.

## Build/Lint/Test Commands
Run commands from repository root.

### App Commands
- `npm install`
- `npm run dev` (Next dev server on `0.0.0.0:3000`)
- `npm run build`
- `npm run start`
- `npm run lint`

### Main Test Command
- `npm run test`
- Runs `node scripts/run-tests.mjs`.
- Executes a curated set of Vitest files.
- With no extra args, script also attempts Node contract tests listed in `scripts/run-tests.mjs`.

### Vitest-Only Mode
- `npm run test -- --reporter=default`
- Passing any extra arg triggers Vitest-only behavior in `scripts/run-tests.mjs`.
- Useful when Node contract files are absent or out of scope.

### Single-Test Commands (important)
- Single Vitest file: `npx vitest run src/path/to/file.test.ts`
- Example: `npx vitest run src/app/api/ai/quick-edit/route.test.ts`
- Single test case by name: `npx vitest run src/path/to/file.test.ts -t "test name"`
- Watch one file: `npx vitest src/path/to/file.test.ts`
- Contract-style Vitest file: `npx vitest run src/app/api/ai/collab-routes.contract.test.ts`

## Code Style Guidelines

### TypeScript And Types
- `tsconfig.json` is strict (`strict: true`); keep code strictly typed.
- Prefer explicit interfaces/types for non-trivial object shapes.
- Use `import type` for type-only imports.
- Narrow `unknown` using guards before access.
- Use unions/string literals for constrained states or modes.
- Avoid type escapes unless unavoidable.

### Forbidden Type Patterns
- `as any`
- `@ts-ignore`
- `@ts-expect-error`

### Imports
- Use internal alias imports via `@/*` (`@` maps to `src`).
- Group imports in this order:
- 1) external/framework packages
- 2) internal modules (`@/...` or relative)
- 3) type-only imports
- Keep import style consistent with nearby files.

### Formatting
- Follow existing formatting in touched files; do not reformat unrelated code.
- Current app code style is typically double quotes and no semicolons.
- Keep multiline object/array trailing commas where existing style does.
- Favor readability over compact clever syntax.

### Naming
- Use descriptive English identifiers for code symbols.
- Keep UI strings and error messages in Chinese.
- Prefer verb-first function names: `getX`, `createX`, `updateX`, `deleteX`, `handleX`.
- Use helper functions for repeated validation/sanitization logic.

## Client/Server/API Conventions

### Client Components
- Put `"use client"` on first line when required.
- Use standard React hooks for state/effects.
- Show actionable Chinese error feedback (toast and/or inline state).

### Server Actions
- Put `"use server"` at top of action files.
- Use `createClient()` from `@/lib/supabase/server`.
- Authenticate early with `supabase.auth.getUser()`.
- Enforce ownership filters with `eq("user_id", user.id)` where relevant.
- Return structured payloads (`{ error: "..." }`, `{ success: true }`, `{ data }`).
- Call `revalidatePath(...)` after successful mutations that affect rendered pages.

### API Route Handlers
- Use `NextRequest` and explicit method exports (`POST`, etc.).
- Parse and validate `request.json()` defensively.
- Use early returns for missing/invalid required fields.
- Return status-appropriate JSON (`400`, `401`, `403`, `500`).
- Keep internal diagnostics private; return safe Chinese error messages.

## AI Route Requirements
When adding/changing AI endpoints, preserve this sequence:
1. Authenticate user.
2. Resolve BYOK config with `resolveAIConfig(request)`.
3. Load story context with `fetchStoryContext(...)`.
4. Build prompt context with `buildStoryPromptContext(...)`.
5. Stream response with `createOpenAIStreamResponse(...)`.

Additional AI requirements:
- Preserve telemetry behavior (`ai_history` and retry/recovery metadata).
- Use `extractRetryMeta(...)` where recovery/retry applies.
- Never log, persist, or expose provider API keys.

## Error Handling
- Return actionable Chinese errors (retry/refresh/config hints when useful).
- Avoid empty `catch {}` unless intentionally falling back safely.
- Keep error payload shape consistent inside each feature.
- In UI, pair transient toasts with stable inline error state when needed.

## Testing Conventions
- Vitest is primary for unit/component/API tests under `src/**`.
- Co-locate tests with source (`.test.ts` / `.test.tsx`).
- Use `.contract.test.ts` for contract-style route tests where appropriate.
- Reuse existing mocking patterns (`vi.mock`, `vi.stubGlobal`, Supabase mocks).
- Run nearest affected tests first, then broader suite.

## Security And Data Safety
- Never bypass auth checks in actions/routes.
- Never remove ownership constraints on user data queries.
- Never hardcode credentials or leak secrets in logs/errors.
- Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Cursor And Copilot Rule Files
Checked locations:
- `.cursorrules`
- `.cursor/rules/**`
- `.github/copilot-instructions.md`

Current state: none of these files exist in this repository.
If any are added, fold their guidance into agent behavior with proper precedence.

## Completion Checklist
Before declaring work complete:
1. Confirm changed files remain type-safe.
2. Run focused tests for modified areas.
3. Run `npm run lint` for non-trivial edits.
4. Run `npm run build` for cross-cutting or release-critical edits.
5. Confirm no secrets, no forbidden type suppression, and no unrelated changes.
