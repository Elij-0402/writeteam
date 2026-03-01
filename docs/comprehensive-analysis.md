# 综合分析

## 关键目录

- `src/app`：页面、布局、API、Server Actions
- `src/lib`：AI 与 Supabase 共享库
- `src/components`：UI 与功能组件
- `supabase/migrations`：数据库迁移
- `tests`：Node 合同测试

## 鉴权与安全

- 会话入口：`src/proxy.ts`
- Supabase 中间层：`src/lib/supabase/middleware.ts`
- 服务端鉴权调用：`src/lib/supabase/server.ts`

## 测试策略

- 组件与路由：Vitest（`src/**/*.test.ts(x)`）
- 合同测试：Node 原生 test（`tests/*.mjs`）
- 编排入口：`scripts/run-tests.mjs`

## 配置文件

- `next.config.ts`、`tsconfig.json`、`vitest.config.ts`
- `eslint.config.mjs`、`postcss.config.mjs`
- 环境变量：`.env`（含 Supabase 公钥配置）
