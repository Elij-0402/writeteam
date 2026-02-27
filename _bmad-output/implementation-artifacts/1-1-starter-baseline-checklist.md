# Story 1.1 实现基线指导与校验清单

## 基线目标

- 对齐 create-next-app 参考基线（TypeScript、Tailwind、App Router、`@/*` 别名）
- 与 brownfield 约束保持一致：`src/proxy.ts`、Server Action 鉴权门禁、BYOK 仅走 `X-AI-*` 头
- 不引入后续故事业务实体、页面或表结构

## 校验项

### 1) Starter Baseline

- [x] TypeScript `strict: true`（`writeteam/tsconfig.json`）
- [x] `@/*` 导入别名（`writeteam/tsconfig.json`）
- [x] Tailwind v4 + `@tailwindcss/postcss`（`writeteam/postcss.config.mjs`）
- [x] App Router 结构存在（`writeteam/src/app`）
- [x] Node/框架版本约束对齐（Next.js 16 / React 19 / Tailwind v4 / Supabase v2 + SSR）

### 2) 仓库结构与实现约束

- [x] 路由分组存在：`(auth)` / `(dashboard)` / `(editor)`
- [x] AI 路由目录规范：`writeteam/src/app/api/ai/*/route.ts`
- [x] Server Actions 目录规范：`writeteam/src/app/actions/*.ts`
- [x] Supabase 客户端运行时分离：`lib/supabase/server.ts` 与 `lib/supabase/client.ts`

### 3) 安全与鉴权底线

- [x] AI 路由均执行 `supabase.auth.getUser()`（`src/app/api/ai` 共 21 个 `route.ts`）
- [x] Server Actions（业务域）执行 `supabase.auth.getUser()`（`documents/projects/series/story-bible/canvas/plugins/images`）
- [x] BYOK key 仅通过 `X-AI-API-Key` 请求头传输（`src/lib/ai/resolve-config.ts`）
- [x] 未发现 API key 写日志行为（AI 路由日志检索）
- [x] 迁移中保持 `auth.uid()` RLS 约束

## 说明

- `src/app/actions/auth.ts` 与 `src/app/api/auth/callback/route.ts` 属于认证入口，不适用已登录用户门禁。
- 本故事仅完成基线对齐与校验，不引入新业务功能。
