# WriteTeam — 架构文档

> 生成日期: 2026-02-27 | 架构模式: Next.js App Router 全栈单体

## 1. 架构概览

WriteTeam 采用 Next.js 16 App Router 全栈架构，将前端 UI、API 路由和服务端逻辑统一在一个部署单元中。数据库使用 Supabase (Postgres + Auth + RLS)，AI 功能通过 BYOK (Bring Your Own Key) 模式接入任意 OpenAI 兼容的 LLM Provider。

```
┌─────────────────────────────────────────────────────────┐
│                    客户端 (Browser)                      │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │ThemeCtx  │  │AuthCtx   │  │AIConfigCtx (localStorage)│
│  └──────────┘  └──────────┘  └────────────────────────┘ │
│  ┌──────────────────────────────────────────────────┐   │
│  │           EditorShell (主编辑器)                   │   │
│  │  ┌────────┐ ┌──────────┐ ┌─────────────────────┐ │   │
│  │  │文档列表 │ │WritingEditor│ │右侧面板 (Bible/Chat/│ │   │
│  │  │(CRUD)  │ │(TipTap)   │ │Muse/Visualize)     │ │   │
│  │  └────────┘ └──────────┘ └─────────────────────┘ │   │
│  │  ┌──────────────┐ ┌──────────────────────────┐   │   │
│  │  │SelectionAIMenu│ │AIToolbar (12+ AI 功能)   │   │   │
│  │  └──────────────┘ └──────────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (BYOK Headers)
┌────────────────────────┼────────────────────────────────┐
│                Next.js Server                            │
│  ┌─────────────┐                                        │
│  │ proxy.ts    │ ← updateSession() 会话刷新              │
│  └─────────────┘                                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Server Actions (39 函数)                         │    │
│  │ projects, documents, series, canvas, plugins,    │    │
│  │ story-bible, images, auth                        │    │
│  └─────────────────────┬───────────────────────────┘    │
│  ┌─────────────────────┼───────────────────────────┐    │
│  │ API Route Handlers  │ (21 AI routes)             │    │
│  │  resolveAIConfig() → fetchStoryContext()         │    │
│  │  → buildStoryPromptContext()                     │    │
│  │  → createOpenAIStreamResponse()                  │    │
│  └─────────────────────┼───────────────────────────┘    │
└────────────────────────┼────────────────────────────────┘
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌──────────┐   ┌──────────┐   ┌──────────────┐
   │ Supabase │   │ LLM API  │   │ DALL-E 3 API │
   │ Postgres │   │ (BYOK)   │   │ (图像生成)    │
   │ + Auth   │   │ OpenAI等 │   │              │
   │ + RLS    │   │          │   │              │
   └──────────┘   └──────────┘   └──────────────┘
```

## 2. 请求生命周期

### 2.1 认证流程

```
Browser Request
  → proxy.ts (Next.js 16 proxy convention)
    → updateSession() [middleware.ts]
      → createServerClient() with cookie auth
      → supabase.auth.getUser()
      → 路由规则:
        - 未认证 + 受保护页面 → redirect(/login)
        - 已认证 + 认证页面 → redirect(/dashboard)
        - 公共页面/API → 放行
      → 同步 request + response cookies
```

### 2.2 AI 请求管道

所有 AI 流式 API 路由遵循统一模式:

```
1. supabase.auth.getUser()           → 401 if unauthenticated
2. resolveAIConfig(request)          → 从 X-AI-* 头提取 BYOK 配置
                                       → 400 if missing baseUrl/modelId
3. request.json()                    → 解析请求体
4. fetchStoryContext(supabase, pid)  → 并行查询:
   ├── story_bibles (project)
   ├── characters (limit 15)
   ├── projects (获取 series_id)
   └── series_bibles (如有 series)
5. buildStoryPromptContext(ctx, opts)→ 组装 13 个 prompt sections:
   ├── AI Rules (最高优先级)
   ├── Genre/Style (feature-aware)
   ├── Writing params (POV, tense)
   ├── Tone, Synopsis, Themes
   ├── Setting, Worldbuilding
   ├── Outline, Braindump, Notes
   ├── Characters (feature-aware 字段选择)
   ├── Prose mode guidance
   └── Saliency guidance
6. createOpenAIStreamResponse()     → POST {baseUrl}/chat/completions
   ├── SSE 流解析 (data: lines)
   ├── 提取 choices[0].delta.content
   ├── 剥离 SSE 帧 → 纯文本流
   └── finally: INSERT ai_history (遥测)
       ├── latency_ms
       ├── output_chars
       ├── response_fingerprint (SHA-256)
       └── estimated tokens
```

### 2.3 BYOK 配置流

```
客户端:
  localStorage["writeteam-ai-config"] → AIProviderConfig
  useAIConfig().getHeaders() → { X-AI-Base-URL, X-AI-API-Key, X-AI-Model-ID }
  fetch("/api/ai/...", { headers: getHeaders() })

服务端:
  resolveAIConfig(request) → 读取 3 个自定义 HTTP 头
  → 验证 URL 格式
  → 返回 { baseUrl, apiKey, modelId } 或 null
```

## 3. Provider 架构

根布局中的 Provider 嵌套顺序:

```tsx
<ThemeProvider>          // next-themes: 暗色/亮色模式
  <AuthProvider>         // Supabase Auth: 用户状态 via onAuthStateChange
    <AIConfigProvider>   // BYOK 配置: localStorage → React Context
      <TooltipProvider>  // Radix UI: 全局 tooltip 延迟=0
        {children}
        <Toaster />      // sonner: Toast 通知
      </TooltipProvider>
    </AIConfigProvider>
  </AuthProvider>
</ThemeProvider>
```

| Provider | 数据源 | Hook | 提供内容 |
|----------|--------|------|----------|
| `ThemeProvider` | next-themes | `useTheme()` | 主题切换 (system/light/dark) |
| `AuthProvider` | Supabase Auth | `useAuth()` | `{ user, loading }` |
| `AIConfigProvider` | localStorage | `useAIConfigContext()` | `{ config, isConfigured, getHeaders, updateConfig, clearConfig }` |

## 4. 数据架构

### 4.1 实体关系图

```
auth.users (Supabase 管理)
  │
  ├── 1:1 → profiles              (id = auth.users.id, CASCADE)
  │
  ├── 1:N → series                (user_id, CASCADE)
  │           ├── 1:1 → series_bibles  (series_id UNIQUE, CASCADE)
  │           ├── 1:N ← projects       (series_id, SET NULL)
  │           └── 1:N ← characters     (series_id, SET NULL)
  │
  ├── 1:N → projects              (user_id, CASCADE)
  │           ├── 1:N → documents       (project_id, CASCADE)
  │           ├── 1:N → characters      (project_id, CASCADE)
  │           ├── 1:1 → story_bibles    (project_id UNIQUE, CASCADE)
  │           ├── 1:N → ai_history      (project_id, CASCADE)
  │           ├── 1:N → canvas_nodes    (project_id, CASCADE)
  │           │     └── 1:N → canvas_edges (source/target_node_id, CASCADE)
  │           ├── 1:N → canvas_edges    (project_id, CASCADE)
  │           ├── 1:N → images          (project_id, CASCADE)
  │           └── 0:N → plugins         (project_id nullable, CASCADE)
  │
  ├── 1:N → plugins               (user_id, CASCADE)
  ├── 1:N → ai_history            (user_id, CASCADE)
  └── 1:N → images                (user_id, CASCADE)
```

### 4.2 RLS 策略模式

所有 12 张表均启用 RLS，强制 `(select auth.uid()) = user_id`:

| 表 | SELECT | INSERT | UPDATE | DELETE | 说明 |
|---|---|---|---|---|---|
| `profiles` | ✓ | ✓ | ✓ | — | 用户删除由 auth.users CASCADE 处理 |
| `projects` | ✓ | ✓ | ✓ | ✓ | 完整 CRUD |
| `documents` | ✓ | ✓ | ✓ | ✓ | 完整 CRUD |
| `characters` | ✓ | ✓ | ✓ | ✓ | 完整 CRUD |
| `story_bibles` | ✓ | ✓ | ✓ | ✓ | 完整 CRUD |
| `ai_history` | ✓ | ✓ | — | — | 仅追加日志 |
| `plugins` | ✓ | ✓ | ✓ | ✓ | 完整 CRUD |
| `series` | ✓ | ✓ | ✓ | ✓ | 完整 CRUD |
| `series_bibles` | ✓ | ✓ | ✓ | ✓ | 完整 CRUD |
| `canvas_nodes` | ✓ | ✓ | ✓ | ✓ | 完整 CRUD |
| `canvas_edges` | ✓ | ✓ | ✓ | ✓ | 完整 CRUD |
| `images` | ✓ | ✓ | — | ✓ | 不可变 (无 UPDATE) |

## 5. AI 功能架构

### 5.1 Feature 分类

17 种 `AIFeature` 被分为 3 个功能组，影响 prompt 上下文组装:

| 功能组 | Features | Prompt 倾向 |
|--------|----------|-------------|
| **WRITING** | write, rewrite, expand, first-draft, describe, shrink, tone-shift, quick-edit, plugin | 角色外貌/描述, 散文风格 |
| **PLANNING** | scene-plan, brainstorm, twist, muse | 角色目标/关系 |
| **CHECK** | continuity-check | 所有角色字段 |

### 5.2 散文风格系统

5 种 `ProseMode` 控制 AI 输出风格:

| Mode | 描述 | 场景 |
|------|------|------|
| `balanced` | 对话、动作、描写均衡 | 默认 |
| `cinematic` | 视觉化、节奏感强 | 动作场景 |
| `lyrical` | 富有节奏、意象和隐喻 | 文学性场景 |
| `minimal` | 简洁精确、短句 | 硬派风格 |
| `match-style` | 模仿用户风格样本 | 个性化 |

### 5.3 Saliency 系统

客户端启发式分析 (`computeSaliency()`):
- 分析最近 2000 字符
- **角色检测**: 全名/名字部分匹配
- **位置检测**: 设定关键词 + 中文空间词正则 (在…里/中/上/旁, 来到…, 走进…)
- **无 AI 调用**: 纯计算，5 秒 debounce

## 6. 组件架构

### 6.1 编辑器架构

```
EditorShell (主容器, 14 useState + refs)
├── Left Sidebar (可折叠)
│   └── 文档列表 (CRUD, 导入/导出)
├── Center
│   ├── AIToolbar (12+ AI 功能, 19 useState)
│   ├── WritingEditor (TipTap, 自动保存 1s)
│   │   └── SelectionAIMenu (浮动菜单, 11 useState, createPortal)
│   └── SaliencyIndicator (活跃角色/地点显示)
└── Right Panel (ResizablePanelGroup, 切换式)
    ├── StoryBiblePanel (4 标签, 18 useState)
    ├── AIChatPanel (多轮对话)
    ├── MusePanel (3 种灵感模式)
    └── VisualizePanel (DALL-E 3 图像)
```

### 6.2 状态管理模式

本项目不使用 Redux/Zustand 等状态库，而是使用:

1. **React Context**: 3 个全局 Provider (Theme, Auth, AIConfig)
2. **组件级 useState**: 所有功能组件使用本地状态
3. **Server Actions**: 数据库 CRUD 操作通过 Server Actions 执行
4. **URL 状态**: 动态路由参数 (`[id]`) 驱动数据加载

## 7. 安全架构

### 7.1 认证层

- **方式**: Supabase Auth (Email/Password + OAuth)
- **会话**: Cookie-based, 自动刷新 (proxy.ts → updateSession)
- **路由守卫**:
  - Server Components: `getUser()` → redirect
  - API Routes: `getUser()` → 401 JSON
  - Server Actions: `getUser()` → return error

### 7.2 数据隔离

- **RLS**: 所有表强制 `user_id = auth.uid()`
- **Server Action 验证**: 每个函数独立调用 `auth.getUser()`
- **无跨用户访问**: 设计上不可能访问他人数据

### 7.3 密钥管理 (BYOK)

- **无服务端 API Key**: 所有 LLM 密钥存储在客户端 localStorage
- **传输**: 通过自定义 HTTP 头 (`X-AI-*`)
- **生命周期**: 仅在单次请求中使用，不持久化到服务端

## 8. 部署架构

### 8.1 环境变量

```
NEXT_PUBLIC_SUPABASE_URL=...        # Supabase 项目 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # Supabase 匿名公钥
```

无需 `OPENAI_API_KEY` — BYOK 模式由用户自行提供。

### 8.2 构建与运行

```bash
npm run dev      # 开发服务器 (0.0.0.0:3000)
npm run build    # 生产构建
npm run start    # 生产服务器
npm run lint     # ESLint 检查
```

### 8.3 数据库迁移

迁移文件位于 `writeteam/supabase/migrations/`，可通过 Supabase SQL Editor 或 CLI 执行。当前 10 个迁移 (001-010) 按顺序执行。
