# WriteTeam

WriteTeam 是一款 AI 创意写作应用，受 Sudowrite 启发。提供项目/文档管理、富文本编辑器、故事圣经、流式 AI 写作工具等功能。

## 技术栈

- Next.js 16 (App Router), React 19, TypeScript
- shadcn/ui + Tailwind CSS v4
- Supabase (Auth + Postgres + RLS)
- TipTap 编辑器
- XYFlow 画布编辑器
- BYOK OpenAI 兼容 API（服务端路由处理器）
- Vitest 测试框架

## 功能

### 认证与项目
- Supabase 邮箱/密码认证
- OAuth 第三方登录
- 仪表盘项目 CRUD
- 系列（Series）管理

### 编辑器
- TipTap 富文本编辑器
- 文档自动保存
- 聚焦模式
- 字数统计与进度追踪
- 选中文本 AI 菜单

### AI 工具（21 个端点）
- **Write** - 续写
- **Rewrite** - 重写
- **Describe** - 描述
- **Brainstorm** - 头脑风暴
- **Expand** - 扩展
- **First Draft** - 初稿
- **Muse** - 灵感对话
- **Twist** - 转折
- **Scene Plan** - 场景规划
- **Continuity Check** - 连贯性检查
- **Tone Shift** - 语气调整
- **Saliency** - 重点标注
- **Visualize** - 可视化
- **Feedback** - 反馈
- **Quick Edit** - 快速编辑
- **Shrink** - 精简
- **Plugin** - 插件

### 故事圣经
- 角色管理
- 冲突工作台
- 连贯性检查
- 语气与文风配置

### 画布
- 节点式故事大纲
- 节点详情面板
- AI 生成节点

### 其他
- 命令面板（Cmd/Ctrl + K）
- 主题切换
- 导入/导出（DOCX, TXT）
- 插件系统

## 环境要求

- Node.js 20+
- npm 10+
- Supabase 项目
- 兼容的模型提供商（BYOK）

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

## Supabase 配置

1. 创建 Supabase 项目
2. 获取：
   - Project URL
   - Anon public key
3. 将值填入 `.env.local`
4. 执行 SQL 迁移文件：
   - `supabase/migrations/001_initial_schema.sql`
   - 及其他迁移文件

可在 Supabase SQL Editor 或使用 Supabase CLI 执行。

## 安装与运行

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`

## 脚本命令

- `npm run dev` - 启动开发服务器
- `npm run build` - 生产构建
- `npm run start` - 启动生产服务器
- `npm run lint` - ESLint 检查
- `npm run test` - 运行测试
- `npx vitest run <file>` - 运行单个测试文件

## 项目结构

```
src/
├── app/
│   ├── (auth)/            # 登录、注册页面
│   ├── (dashboard)/       # 仪表盘、设置、系列页面
│   ├── (editor)/          # 编辑器、画布页面
│   ├── actions/           # Server Actions
│   ├── api/ai/            # 21 个 AI 路由
│   └── api/auth/          # 认证回调
├── components/
│   ├── ai/                # AI 工具栏、聊天面板、Muse 面板
│   ├── canvas/            # 画布编辑器
│   ├── dashboard/         # 仪表盘组件
│   ├── editor/            # 编辑器组件
│   ├── layout/            # 布局组件（命令面板）
│   ├── plugins/           # 插件管理
│   ├── series/            # 系列组件
│   ├── settings/          # 设置页面
│   ├── story-bible/       # 故事圣经组件
│   ├── providers/         # React Context Providers
│   └── ui/                # shadcn/ui 组件
├── lib/
│   ├── ai/                # AI 工具函数
│   ├── editor/            # 编辑器工具函数
│   ├── story-bible/       # 故事圣经工具函数
│   └── supabase/          # Supabase 客户端
└── types/
    └── database.ts         # 数据库类型定义

supabase/
└── migrations/             # 数据库迁移（14 个文件）

scripts/
└── run-tests.mjs           # 测试入口脚本
```

## AI 与安全说明

- 使用 BYOK 架构：用户在客户端配置模型，请求通过 `X-AI-*` 头传递
- 服务器不持久化提供商 API 密钥
- AI 路由位于 `src/app/api/ai/*`
- Supabase 认证/会话处理通过 `src/proxy.ts` 和 `src/lib/supabase/*` 实现
- 包含 AI 历史记录与错误恢复机制

## 本地验证

推送代码前建议执行：

```bash
npm run lint
npm run build
```

## 相关文档

- [AGENTS.md](./AGENTS.md) - 开发规范与约定
- [docs/plans](./docs/plans/) - 功能设计与实现计划

## 许可证

MIT
