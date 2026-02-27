# WriteTeam — 源码树分析

> 生成日期: 2026-02-27 | 扫描级别: Exhaustive

## 仓库根目录

```
writeteam/                          # 仓库根目录
├── package.json                    # 代理 package.json (转发命令到 writeteam/)
├── CLAUDE.md                       # AI 助手指令文件
├── _bmad/                          # BMAD 方法论模板 (非应用代码)
├── _bmad-output/                   # BMAD 输出制品
├── docs/                           # 项目文档 (本目录)
└── writeteam/                      # ★ 应用主目录 (所有源码)
```

## 应用目录 (`writeteam/`)

```
writeteam/
├── .env                            # 环境变量 (Supabase URL + Key)
├── .gitignore                      # Git 忽略规则
├── next.config.ts                  # Next.js 配置 (最小化)
├── tsconfig.json                   # TypeScript 配置 (target: ES2017, @/* 路径别名)
├── package.json                    # 依赖清单 (Next.js 16, React 19, 45+ 依赖)
├── pnpm-lock.yaml                  # pnpm 锁文件
├── package-lock.json               # npm 锁文件
├── components.json                 # shadcn/ui 配置 (new-york 风格, zinc 基色)
├── eslint.config.mjs               # ESLint 配置 (Next.js core-web-vitals + typescript)
├── postcss.config.mjs              # PostCSS 配置 (Tailwind CSS v4)
├── public/                         # 静态资源
├── .next/                          # Next.js 构建输出 (gitignore)
├── node_modules/                   # 依赖 (gitignore)
├── supabase/                       # ★ 数据库迁移
│   └── migrations/
│       ├── 001_initial_schema.sql          # 基础表: profiles, projects, documents, characters, story_bibles, ai_history
│       ├── 002_ai_quality_observability.sql # AI 遥测: latency_ms, output_chars, response_fingerprint, user_rating
│       ├── 003_story_bible_prose_mode.sql   # 散文模式: prose_mode, style_sample
│       ├── 004_story_bible_tone_ai_rules.sql # 语气 + AI 规则: tone, ai_rules
│       ├── 005_story_bible_visibility.sql   # 可见性控制: visibility (jsonb)
│       ├── 006_plugins.sql                  # 插件系统: plugins 表
│       ├── 007_model_selection.sql          # 模型选择: projects.preferred_model
│       ├── 008_series_support.sql           # 系列支持: series, series_bibles 表 + FK
│       ├── 009_canvas.sql                   # 画布: canvas_nodes, canvas_edges 表
│       └── 010_images.sql                   # 图像: images 表
└── src/                            # ★ 源码根目录
```

## 源码目录 (`src/`)

```
src/
├── proxy.ts                        # ★ 入口 — Next.js 16 proxy (替代 middleware.ts), 调用 updateSession()
│
├── app/                            # ★ App Router 路由
│   ├── layout.tsx                  # 根布局 — Provider 链: Theme > Auth > AIConfig > Tooltip > Toaster
│   ├── page.tsx                    # 公共着陆页 (6 个功能卡片, 中文)
│   ├── globals.css                 # 全局样式 — Tailwind v4 + shadcn 主题 + TipTap 编辑器样式
│   ├── favicon.ico                 # 站点图标
│   │
│   ├── (auth)/                     # 认证路由组 (公开)
│   │   ├── login/page.tsx          # 登录页 — email/password, 调用 signIn() Server Action
│   │   └── signup/page.tsx         # 注册页 — email/password/fullName, 调用 signUp() Server Action
│   │
│   ├── (dashboard)/                # 仪表板路由组 (需认证)
│   │   ├── layout.tsx              # Auth 守卫 — supabase.auth.getUser() → redirect(/login)
│   │   ├── dashboard/page.tsx      # 主仪表板 — 项目列表 (SELECT projects + profiles)
│   │   ├── projects/[id]/page.tsx  # (未使用 — 直接跳转编辑器)
│   │   ├── series/page.tsx         # 系列列表 — SELECT series + 项目计数聚合
│   │   ├── series/[id]/page.tsx    # 系列详情 — 3 标签页 (概览/项目/Bible)
│   │   └── settings/page.tsx       # 设置 — BYOK AI 配置
│   │
│   ├── (editor)/                   # 编辑器路由组 (需认证)
│   │   ├── editor/[id]/page.tsx    # ★ 主编辑器 — 5 个 DB 查询加载全部上下文 → EditorShell
│   │   └── canvas/[id]/page.tsx    # ★ 画布编辑器 — React Flow 可视化规划 → CanvasEditor
│   │
│   ├── actions/                    # ★ Server Actions (39 个导出函数)
│   │   ├── auth.ts                 # 3 函数: signIn, signUp, signOut (含 15s 超时 + 中文错误映射)
│   │   ├── projects.ts             # 4 函数: CRUD (创建时自动生成 story_bible + 第一章)
│   │   ├── documents.ts            # 5 函数: CRUD (TipTap JSON content + 纯文本镜像 + 字数)
│   │   ├── series.ts               # 8 函数: CRUD + 系列 Bible upsert + 项目关联
│   │   ├── canvas.ts               # 8 函数: 节点/边 CRUD + 批量位置更新 (Promise.all)
│   │   ├── images.ts               # 2 函数: getImages, deleteImage
│   │   ├── plugins.ts              # 4 函数: CRUD (camelCase→snake_case 映射)
│   │   └── story-bible.ts          # 6 函数: Bible CRUD + Character CRUD
│   │
│   └── api/                        # ★ API Route Handlers (22 个)
│       ├── auth/callback/route.ts  # OAuth 回调 — exchangeCodeForSession
│       └── ai/                     # ★ AI API Routes (21 个)
│           ├── write/route.ts      # 续写 — 6 种模式, maxTokens=1000, temp=0.8
│           ├── rewrite/route.ts    # 改写 — 7 种模式, maxTokens=1500, temp=0.7
│           ├── expand/route.ts     # 扩写 — maxTokens=1500, temp=0.8
│           ├── shrink/route.ts     # 缩写 — maxTokens=1000, temp=0.5
│           ├── describe/route.ts   # 描述 — 感官结构化输出, temp=0.9
│           ├── brainstorm/route.ts # 头脑风暴 — 8-10 个创意, temp=1.0
│           ├── first-draft/route.ts # 初稿 — maxTokens=2500, temp=0.85
│           ├── scene-plan/route.ts # 场景规划 — maxTokens=1800, temp=0.7
│           ├── chat/route.ts       # AI 对话 — 多轮对话, temp=0.7
│           ├── muse/route.ts       # 灵感伙伴 — 3 种模式, temp=0.85-0.95
│           ├── continuity-check/route.ts # 连续性检查 — temp=0.3
│           ├── tone-shift/route.ts # 语气转换 — 6 种语气, temp=0.7
│           ├── twist/route.ts      # 反转 — 3-5 个反转建议, temp=0.9
│           ├── quick-edit/route.ts  # 快速编辑 — 自然语言指令, temp=0.7
│           ├── plugin/route.ts     # 插件执行 — 从 DB 加载自定义 prompt
│           ├── visualize/route.ts  # 图像生成 — DALL-E 3, 非流式
│           ├── canvas-generate/route.ts # 画布 AI 生成 — 非流式 JSON
│           ├── saliency/route.ts   # 服务端 Saliency 分析
│           ├── models/route.ts     # 模型列表 — GET, 查询 provider /models
│           ├── test-connection/route.ts # 连接测试 — POST, 最小化测试调用
│           ├── feedback/route.ts   # 反馈记录 — UPDATE ai_history 评分
│           └── generate-bible/route.ts  # Bible 生成
│
├── components/                     # ★ 组件 (55 个文件)
│   ├── ui/                         # shadcn/ui 原语 (27 个) — Button, Card, Dialog, Sheet, Tabs, Select, Command, ...
│   ├── providers/                  # Context Providers (3 个) — Theme, Auth, AIConfig
│   ├── editor/                     # 编辑器组件 (4 个) — EditorShell, WritingEditor, SelectionAIMenu, SaliencyIndicator
│   ├── ai/                         # AI 组件 (4 个) — AIToolbar, AIChatPanel, MusePanel, VisualizePanel
│   ├── canvas/                     # 画布组件 (4 个) — CanvasEditor, CanvasNode, CanvasToolbar, NodeDetailPanel
│   ├── dashboard/                  # 仪表板 (1 个) — DashboardContent
│   ├── series/                     # 系列 (4 个) — SeriesManager, SeriesBiblePanel, SeriesListContent, SeriesDetailContent
│   ├── settings/                   # 设置 (2 个) — SettingsContent, AIProviderForm
│   ├── story-bible/                # Story Bible (1 个) — StoryBiblePanel (含 CharacterField, VisibilityToggle)
│   ├── plugins/                    # 插件 (1 个) — PluginManager
│   ├── layout/                     # 布局 (1 个) — CommandPalette (Ctrl+K)
│   └── auth/                       # (空 — 认证 UI 直接在 (auth) 路由中)
│
├── lib/                            # ★ 核心库 (13 个文件)
│   ├── ai/                         # AI 集成层 (10 个文件)
│   │   ├── story-context.ts        # ★ 核心 — 故事上下文编排 (17 个 AIFeature, 13 个 prompt sections)
│   │   ├── openai-stream.ts        # 流式调用 — SSE → 纯文本流 + ai_history 遥测
│   │   ├── openai-json.ts          # 非流式 JSON 调用 (canvas, visualize, saliency)
│   │   ├── prose-mode.ts           # 5 种散文风格 — balanced, cinematic, lyrical, minimal, match-style
│   │   ├── saliency.ts             # 客户端启发式 — 角色名匹配 + 中文位置 regex
│   │   ├── ai-config.ts            # BYOK 共享类型 + 5 个 Provider 预设
│   │   ├── resolve-config.ts       # 服务端 — 从 HTTP 头提取 BYOK 配置
│   │   ├── use-ai-config.ts        # 客户端 React hook — localStorage BYOK 管理
│   │   ├── telemetry.ts            # SHA-256 指纹 + 令牌估算
│   │   └── model-registry.ts       # (已废弃) 旧版模型注册
│   ├── supabase/                   # Supabase 客户端 (3 个文件)
│   │   ├── server.ts               # 服务端客户端 — createServerClient + cookie auth
│   │   ├── client.ts               # 浏览器客户端 — createBrowserClient
│   │   └── middleware.ts           # 会话刷新 + 路由守卫 (updateSession)
│   ├── utils.ts                    # cn() — Tailwind 类名合并
│   ├── export.ts                   # 导出 — exportAsText, exportAsDocx, exportProjectAsDocx
│   └── import.ts                   # 导入 — parseImportedFile (txt/docx)
│
├── hooks/                          # 自定义 Hooks (1 个)
│   └── use-mobile.ts               # useIsMobile() — 768px 断点检测
│
└── types/                          # 类型定义 (1 个)
    └── database.ts                 # ★ 完整 Supabase 数据库类型 — 12 张表, Row/Insert/Update 变体
```

## 关键入口点

| 入口 | 文件 | 用途 |
|------|------|------|
| **请求代理** | `src/proxy.ts` | Next.js 16 请求拦截, 刷新 Supabase 会话 |
| **根布局** | `src/app/layout.tsx` | Provider 链初始化, 全局 metadata |
| **编辑器** | `src/app/(editor)/editor/[id]/page.tsx` | 主写作界面入口 |
| **仪表板** | `src/app/(dashboard)/dashboard/page.tsx` | 项目管理入口 |
| **AI 管道** | `src/lib/ai/story-context.ts` | AI 上下文编排核心 |
| **流式引擎** | `src/lib/ai/openai-stream.ts` | AI 响应流式处理 |

## 关键目录说明

| 目录 | 文件数 | 说明 |
|------|--------|------|
| `src/app/api/ai/` | 21 | 所有 AI 功能的 API 端点 |
| `src/app/actions/` | 8 | 39 个 Server Action 函数 |
| `src/components/ui/` | 27 | shadcn/ui 设计系统原语 |
| `src/components/editor/` | 4 | 编辑器核心组件 |
| `src/components/ai/` | 4 | AI 面板组件 |
| `src/lib/ai/` | 10 | AI 集成层 (BYOK, streaming, context) |
| `supabase/migrations/` | 10 | 数据库 schema 迁移 |
