# WriteTeam - Source Tree Analysis

**Date:** 2026-03-01

## Overview

本项目是单仓 Next.js 16 全栈应用，核心目录集中在 `src`、`supabase`、`tests`。

## Complete Directory Structure

```text
writeteam/
├── src/
│   ├── app/                  # App Router 页面、布局、API、Server Actions
│   │   ├── (auth)/           # 登录/注册
│   │   ├── (dashboard)/      # 仪表盘、项目、系列、设置
│   │   ├── (editor)/         # 文本编辑器与画布编辑器
│   │   ├── actions/          # Server Actions
│   │   └── api/              # API route handlers
│   ├── components/           # UI 和 feature 组件
│   ├── lib/                  # AI/Supabase/工具库
│   ├── hooks/                # 复用 hooks
│   ├── types/                # 类型定义
│   └── proxy.ts              # Next.js 16 会话代理
├── supabase/
│   └── migrations/           # SQL 迁移
├── tests/                    # Node 合同测试
├── scripts/                  # 测试编排脚本
└── docs/                     # 本工作流输出文档
```

## Critical Directories

### `src/app`

- 作用：路由与服务端交互主入口。
- 包含：页面、route groups、API、actions。

### `src/app/api`

- 作用：HTTP 接口层。
- 包含：`/api/ai/*` 与 `/api/auth/callback`。

### `src/app/actions`

- 作用：Server Actions 业务逻辑层。

### `src/components`

- 作用：展示层与交互层。

### `src/lib`

- 作用：共享能力（AI、Supabase、工具）。

### `supabase/migrations`

- 作用：数据库 schema 演进与策略变更。

## Entry Points

- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/proxy.ts`
- `src/app/api/**/route.ts`
