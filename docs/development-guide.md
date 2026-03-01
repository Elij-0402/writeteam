# 开发指南

## 前置要求

- Node.js 20+
- npm 10+
- 可用 Supabase 项目

## 环境变量

在项目根目录创建 `.env.local`：

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## 本地开发

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。

## 常用命令

- 开发：`npm run dev`
- 构建：`npm run build`
- 启动：`npm run start`
- Lint：`npm run lint`
- 测试：`npm run test`

## 测试说明

- `npm run test` 会执行 `scripts/run-tests.mjs`。
- 默认执行：精选 Vitest + `tests/story-4-2-quick-edit.test.mjs`。
- 传额外参数时走 Vitest-only 分支。

## 数据库初始化

- 在 Supabase 执行：`supabase/migrations/001_initial_schema.sql`。
- 后续迁移按编号顺序应用。
