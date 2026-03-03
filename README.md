# WriteTeam

WriteTeam 是一款中文 AI 创意写作应用，受 Sudowrite 启发。它围绕「项目管理 + 长文写作 + 故事设定 + AI 协作」构建，覆盖从灵感整理到正文迭代的完整写作流程。

## 核心能力

- 项目、系列（Series）与文档分层管理
- TipTap 富文本编辑器（自动保存、聚焦模式、字数统计）
- 故事圣经（角色、冲突、文风/语气等设定）
- 画布大纲（XYFlow 节点编辑与 AI 辅助生成）
- AI 写作工具集（续写、重写、扩展、场景规划、连贯性检查等）
- BYOK（Bring Your Own Key）模型接入与流式输出

## 技术栈

- Next.js 16（App Router）+ React 19 + TypeScript（strict）
- Tailwind CSS v4 + shadcn/ui
- Supabase（Auth + Postgres + RLS）
- TipTap（编辑器）+ XYFlow（画布）
- OpenAI 兼容接口（通过服务端 AI 路由处理）
- Vitest + Node test（契约测试）

## AI 路由概览

`src/app/api/ai/` 下包含 21 个 AI POST 路由（用于创作/分析/改写）以及模型相关辅助路由。

常用创作工具包括：

- `write`（续写）
- `rewrite`（重写）
- `describe`（描写）
- `brainstorm`（头脑风暴）
- `expand` / `shrink`（扩展 / 精简）
- `first-draft`（初稿）
- `scene-plan`（场景规划）
- `continuity-check`（连贯性检查）
- `quick-edit`（快速编辑）
- `tone-shift`（语气调整）
- `feedback`（反馈）
- `visualize`（可视化）

## 环境要求

- Node.js 20+
- npm 10+
- 可用的 Supabase 项目
- 可访问的 OpenAI 兼容模型服务（BYOK）

## 环境变量

在项目根目录创建 `.env.local`：

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

快速复制示例配置：

```bash
# macOS / Linux
cp .env.local.example .env.local

# Windows
copy .env.local.example .env.local
```

## 本地开发

```bash
npm install
npm run dev
```

默认地址：`http://localhost:3000`

## 常用命令

- `npm run dev`：启动开发服务器（`0.0.0.0:3000`）
- `npm run build`：生产构建
- `npm run start`：启动生产服务
- `npm run lint`：ESLint 检查
- `npm run test`：运行主测试入口（Vitest + `tests/` 契约测试）
- `npm run test -- --reporter=default`：仅运行 Vitest（跳过 `tests/`）
- `npx vitest run src/path/to/file.test.ts`：运行单个 Vitest 文件

## Supabase 初始化

1. 在 Supabase 创建项目并拿到 URL / anon key
2. 写入 `.env.local`
3. 执行 `supabase/migrations/*.sql` 迁移文件

可使用 Supabase SQL Editor 或 Supabase CLI 执行。

## 目录结构

```text
src/
├── app/
│   ├── (auth)/              # 登录、注册
│   ├── (dashboard)/         # 仪表盘、设置、系列
│   ├── (editor)/            # 编辑器、画布
│   ├── actions/             # Server Actions
│   ├── api/ai/              # AI 路由
│   └── api/auth/callback/   # Supabase OAuth 回调
├── components/              # 业务组件与 UI
├── lib/
│   ├── ai/                  # AI 上下文、流式、错误分类、配置解析
│   └── supabase/            # Supabase 客户端（server/client）
├── proxy.ts                 # 会话刷新与鉴权跳转（Next.js 16）
└── types/database.ts        # 数据库类型

scripts/run-tests.mjs        # 测试入口
supabase/migrations/         # 数据库迁移
```

## 安全说明

- 默认按用户维度进行鉴权与数据所有权约束（RLS + 服务端校验）
- AI 请求通过 `X-AI-*` 头传递 BYOK 配置
- 服务端不持久化模型提供商 API Key
- AI 相关调用包含历史记录与错误恢复元信息

## 建议验证流程

提交前建议至少执行：

```bash
npm run lint
npm run test
```

若改动涉及跨模块行为，再执行：

```bash
npm run build
```

## 相关文档

- [AGENTS.md](./AGENTS.md)：仓库开发规范
- [docs/plans](./docs/plans/)：功能设计与实现计划

## 许可证

MIT
