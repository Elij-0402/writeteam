# 部署指南

## 部署前提

- Node.js 20+
- npm 10+
- 已配置生产环境变量：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 当前仓库部署现状

根据仓库扫描结果：

- 未检测到 CI/CD 工作流文件（如 `.github/workflows/**`）
- 未检测到 `Dockerfile` / `docker-compose.yml`
- 未检测到平台专属部署配置（如 `vercel.json`、`fly.toml`）

因此当前项目适合先采用平台内置构建流程（或手工流水线）进行部署。

## 推荐最小流水线

```bash
npm ci
npm run lint
npm run build
npm run test
```

说明：如发布窗口紧张，可将 `npm run test` 改为发布前强制门禁，而非每次部署门禁。

## 运行与健康检查

生产启动命令：

```bash
npm run start
```

建议上线后验证：

- 主页可访问（`/`）
- 登录流程可用（`/(auth)`）
- 编辑器核心页面可访问（`/(editor)`）
- 关键 AI 路由返回正常（`src/app/api/ai/**`）

## 后续可选增强

1. 新增 `.github/workflows/`，把 lint/build/test 固化为 PR 与主干门禁。
2. 增加部署平台配置文件（如 Vercel 项目配置）以统一环境变量与构建参数。
3. 增加 smoke test，确保部署后关键路径可用。
