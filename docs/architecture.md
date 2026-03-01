# WriteTeam 架构文档

**Date:** 2026-03-01
**Type:** web monolith

## Executive Summary

WriteTeam 是基于 Next.js 16 App Router 的 AI 创意写作应用，集成 Supabase 鉴权与数据存储，通过 API Routes + Server Actions 提供核心业务能力。

## Technology Stack

- Next.js 16 / React 19 / TypeScript
- Supabase（Auth + Postgres + RLS）
- TipTap（编辑器）
- Tailwind CSS v4 + shadcn/ui
- Vitest + Node contract tests

## Architecture Pattern

- 分层式单仓：
  - 展示层：`src/components/**`
  - 路由与编排层：`src/app/**`
  - 共享能力层：`src/lib/**`
  - 数据演进层：`supabase/migrations/**`

## Data Architecture

- 以 Supabase SQL 迁移为事实来源。
- 应用侧类型在 `src/types/database.ts`。

## API Design

- API 统一落在 `src/app/api/**/route.ts`。
- AI 能力按路由分工（write/rewrite/chat/quick-edit 等）。
- Auth callback 独立于 `src/app/api/auth/callback/route.ts`。

## Component Overview

- 基础组件：`src/components/ui`
- 编辑与画布：`src/components/editor`、`src/components/canvas`
- AI 交互：`src/components/ai`
- Provider：`src/components/providers`

## Source Tree

- 详见 `source-tree-analysis.md`。

## Development Workflow

- `npm run dev` 本地启动
- `npm run lint` + `npm run build` + `npm run test` 作为质量门禁

## Deployment Architecture

- 仓库内未固化 CI/CD 文件，部署需由平台侧配置。

## Testing Strategy

- 单测/组件测：Vitest（`src/**/*.test.ts(x)`）
- 合同测试：Node test（`tests/*.mjs`）
