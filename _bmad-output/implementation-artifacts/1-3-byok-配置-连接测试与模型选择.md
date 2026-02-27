# Story 1.3: BYOK 配置、连接测试与模型选择

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 创作者用户,
I want 配置 BYOK 并测试连通性后选择可用模型,
so that 我可以确认当前 AI 链路可用后开始创作。

## Acceptance Criteria

1. **Given** 用户在设置页填写 Base URL、API Key、Model ID，**When** 用户保存配置，**Then** 配置持久化到 localStorage 并在页面刷新后恢复，且配置摘要正确显示当前状态。
2. **Given** 用户已填写 Base URL 和 Model ID，**When** 用户发起连接测试，**Then** 系统返回成功（含延迟毫秒数）或失败（含中文可解释原因与可执行下一步动作），满足 NFR12。
3. **Given** 用户已填写 Base URL 和 API Key，**When** 用户请求获取模型列表，**Then** 系统返回可用模型列表并支持搜索选择或手动输入回退，满足 FR22。
4. **Given** API Key 在任何传输路径中，**When** 请求到达服务端或日志/遥测记录，**Then** API Key 仅经 `X-AI-API-Key` 头传递，不落库、不入日志、不出现在遥测字段中，满足 NFR4。
5. **Given** 连接测试或模型查询失败（网络超时、认证失败、Provider 不可达、格式不兼容），**When** 系统处理异常，**Then** 错误提示为中文、可理解、包含可执行下一步动作（检查配置/切换 Provider/重试），满足 NFR12。

## Tasks / Subtasks

- [x] **验证 BYOK 配置完整性**（AC: 1）
  - [x] 验证设置页表单交互：Provider 预设按钮、Base URL 输入（自动规范化 https:// + /v1）、API Key 密码切换、Model 下拉与手动输入
  - [x] 验证配置保存到 localStorage 并在页面刷新后恢复
  - [x] 验证配置摘要显示（当前 Provider、Model、配置时间）
  - [x] 验证清除配置功能正常工作
  - [x] 验证 Ollama 场景下空 API Key 被正确接受
- [x] **验证连接测试链路**（AC: 2, 5）
  - [x] 验证 `/api/ai/test-connection` 端点成功路径（返回 success + latency_ms）
  - [x] 验证失败路径返回中文可解释错误信息
  - [x] 加固错误分类：区分网络超时、认证失败（401/403）、模型不存在（404）、Provider 不可达、格式不兼容
  - [x] 确保每种错误类型都附带中文可执行下一步动作提示
  - [x] 验证 UI 中 Toast 反馈正确显示成功/失败状态
- [x] **验证模型选择链路**（AC: 3）
  - [x] 验证 `/api/ai/models` 端点正确处理三种响应格式（OpenAI `{data:[]}`, Ollama `{models:[]}`, 直接数组）
  - [x] 验证模型列表 Combobox 搜索功能
  - [x] 验证获取失败时手动输入回退机制
  - [x] 验证空模型列表时的中文提示与引导
- [x] **验证安全合规**（AC: 4）
  - [x] 审计 `openai-stream.ts` 确认 API Key 不出现在 `ai_history` 遥测记录中
  - [x] 审计所有 AI route handlers 确认无 console.log/error 泄漏 API Key
  - [x] 审计 `test-connection/route.ts` 和 `models/route.ts` 确认错误响应不回显 API Key
  - [x] 验证 localStorage 中 API Key 存储行为（客户端持有、浏览器安全边界）
- [x] **补齐错误语义与恢复路径**（AC: 5）
  - [x] 统一连接测试错误信息为中文 + 可执行动作格式
  - [x] 统一模型获取错误信息为中文 + 可执行动作格式
  - [x] 确保 Provider 不可达时建议"检查 Base URL 是否正确"
  - [x] 确保认证失败时建议"检查 API Key 是否有效"
  - [x] 确保超时时建议"检查网络连接或更换 Provider"
- [x] **交付校验**
  - [x] 运行 `npm run lint`（0 errors）
  - [x] 运行 `npm run build`（通过）
  - [x] 执行手动或自动化验证覆盖所有 AC

## Dev Notes

- **这是 Brownfield 增量验证故事，不是从零构建。** 所有 BYOK 配置、连接测试和模型选择功能已在 `ea310f5` 中实现。本故事的核心任务是验证现有实现满足 AC 要求，并加固错误处理与安全合规。
- 承接 Story 1.2 的认证闭环，本故事聚焦于 BYOK 配置可用性与安全性，不扩展到 AI 写作能力或失败恢复（那是 Story 1.4）。
- 重点关注**错误语义中文化与可执行恢复提示**——这是 Story 1.2 review 中确立的关键质量标准。
- 保持 BYOK 安全红线：API Key 仅在 `X-AI-API-Key` 请求头中瞬时传递，服务端不持久化、不记录。

### Project Structure Notes

- 设置页面：`writeteam/src/app/(dashboard)/settings/page.tsx` → `components/settings/settings-content.tsx` → `components/settings/ai-provider-form.tsx`
- BYOK 核心：`src/lib/ai/ai-config.ts`（类型+常量）、`src/lib/ai/resolve-config.ts`（服务端提取）、`src/lib/ai/use-ai-config.ts`（客户端 Hook）
- Context：`src/components/providers/ai-config-provider.tsx`（全局 Provider）
- API 端点：`src/app/api/ai/test-connection/route.ts`、`src/app/api/ai/models/route.ts`
- 流式管线：`src/lib/ai/openai-stream.ts`（遥测写入 ai_history 表，需审计 Key 安全）
- 废弃文件：`src/lib/ai/model-registry.ts`（已标记 @deprecated，被 BYOK 系统取代）

### Developer Context Section

#### Technical Requirements

- 必须保持 BYOK 安全不变量：API Key 仅经 `X-AI-*` 头传递，不落库不入日志（NFR4）。
- 必须保持认证门禁：`test-connection` 和 `models` 端点需验证 `supabase.auth.getUser()`。
- 错误响应必须为中文、包含可执行下一步动作（NFR12）。
- 连接测试必须返回结构化结果：`{ success, model?, latency_ms?, error? }`。
- 模型列表必须兼容三种 Provider 响应格式（OpenAI `{data:[]}`, Ollama `{models:[]}`, 直接数组 `[...]`）。

#### Architecture Compliance

- 遵循 Next.js 16 约定：仅使用 `src/proxy.ts`，禁止新增 `middleware.ts`。
- API 端点遵循固定模式：`auth -> resolveAIConfig -> business logic -> response`。
- 非流式端点返回 JSON 包络：`Response.json({ ... }, { status })`。
- BYOK 数据流：客户端 localStorage → HTTP Headers (`X-AI-*`) → `resolveAIConfig(request)` → Provider API。
- Context Provider 嵌套顺序不可更改：`ThemeProvider > AuthProvider > AIConfigProvider > TooltipProvider`。

#### Library / Framework Requirements

- Next.js: 16.1.6（`proxy.ts` 约定，API Routes + Server Actions）
- React: 19.2.x
- Tailwind CSS: v4.2（CSS-first 配置）
- Supabase: `@supabase/supabase-js` v2 + `@supabase/ssr` v0.8.x
- shadcn/ui: v3.8.5（new-york style）
- TypeScript: strict 模式
- Zod: v4（如需表单验证）
- React Hook Form: v7（如需增强表单验证）
- Sonner: v2（Toast 通知）

#### File Structure Requirements

- 所有新增文件采用 kebab-case。
- 设置相关组件只放在 `src/components/settings/`。
- AI 配置相关逻辑只放在 `src/lib/ai/`。
- API 端点在 `src/app/api/ai/` 下，每个功能一个目录含 `route.ts`。
- 不创建新的 Context Provider（已有 `AIConfigProvider`）。

#### Testing Requirements

- 验证连接测试端点覆盖：成功路径 + 至少 3 种失败路径（网络、认证、格式）。
- 验证模型列表端点覆盖：三种响应格式 + 空列表 + 获取失败。
- 安全审计：确认 API Key 不出现在 ai_history 表、console 输出或错误响应中。
- 交付前至少执行：`npm run lint`、`npm run build`。

#### Previous Story Intelligence

- **Story 1.1** 已固化实现基线：Next.js 16 + proxy.ts、TypeScript strict、Tailwind v4、Supabase SSR。
- **Story 1.2** 已建立认证闭环与关键质量标准：
  - 开放重定向防护模式（`sanitizeRedirectPath`）
  - 统一中文错误映射器（`mapAuthError`）
  - 每种错误路径必须附带可执行下一步动作
  - `formData.get()` 必须使用运行时 `typeof` 检查而非 `as string`
  - 测试从源码字符串断言扩展到行为级断言（13 个测试覆盖）
- Story 1.2 Review 修复了 auth callback 开放重定向和 signOut 错误处理 — 本故事的 API 端点也需保持相同安全标准。

#### Git Intelligence Summary

- 最近提交：`e940978` Story 1-1 完成（基线+归档+审查修复），`ea310f5` BYOK AI 配置系统实现。
- 当前代码库已包含完整 BYOK 功能链路（5 个 Provider 预设、连接测试、模型选择、21 个 AI routes 集成）。
- 本故事不需引入新框架或新依赖，重点是验证与加固已有实现。

### Latest Tech Information

- Next.js 16 使用 `proxy.ts` 作为请求拦截入口，API Routes 保持标准 Route Handler 模式。
- OpenAI-compatible API 的 `/models` 端点在不同 Provider 间有三种响应格式变体（`{data:[]}`, `{models:[]}`, 直接数组），需全部兼容。
- Supabase SSR v0.8.x 的 Cookie 会话刷新机制在 `updateSession()` 中处理，API 端点通过 `createClient()` 自动继承。
- localStorage 中存储 API Key 受限于同源策略保护，但不提供加密——这是 BYOK 架构的已知权衡（用户自行承担浏览器安全）。

### Project Context Reference

- 关键上下文约束：中文用户文案、TypeScript strict、`@/*` 别名、`proxy.ts` 约定、Server Action 必须鉴权、RLS 强隔离。
- BYOK 数据流：`localStorage → X-AI-* headers → resolveAIConfig() → Provider API`。
- 若实现细节冲突，优先遵循 `_bmad-output/project-context.md` 与 `_bmad-output/planning-artifacts/architecture.md`。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3: BYOK 配置、连接测试与模型选择]
- [Source: _bmad-output/planning-artifacts/prd.md#AI Configuration & Reliability]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#失败恢复不断流（差异化关键路径）]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Form Patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Feedback Patterns]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: _bmad-output/project-context.md#BYOK 数据流]
- [Source: _bmad-output/implementation-artifacts/1-2-用户注册登录与访问隔离.md#Review Follow-ups]

### Existing Code Inventory (Brownfield Context)

以下文件已实现 BYOK 配置、连接测试与模型选择功能，开发者应以验证+加固为主：

| 文件 | 路径 | 状态 | 职责 |
|------|------|------|------|
| ai-config.ts | `src/lib/ai/` | ✅ 完整 | AIProviderConfig 类型、PROVIDER_PRESETS、X-AI-* Header 常量 |
| resolve-config.ts | `src/lib/ai/` | ✅ 完整 | 服务端从请求头提取 BYOK 配置 |
| use-ai-config.ts | `src/lib/ai/` | ✅ 完整 | 客户端 React Hook（localStorage 读写 + getHeaders()） |
| ai-config-provider.tsx | `src/components/providers/` | ✅ 完整 | 全局 AIConfigContext Provider |
| ai-provider-form.tsx | `src/components/settings/` | ✅ 完整 | 设置表单 UI（预设按钮、URL 规范化、密码切换、模型下拉、连接测试） |
| settings-content.tsx | `src/components/settings/` | ✅ 完整 | 设置页面布局容器 |
| settings/page.tsx | `src/app/(dashboard)/` | ✅ 完整 | 设置页路由（含 auth guard） |
| test-connection/route.ts | `src/app/api/ai/` | ✅ 完整 | 连接测试端点（POST，返回 success/latency/error） |
| models/route.ts | `src/app/api/ai/` | ✅ 完整 | 模型列表端点（GET，兼容 3 种格式） |
| openai-stream.ts | `src/lib/ai/` | ✅ 完整 | 流式响应 + ai_history 遥测（需审计 Key 安全） |
| model-registry.ts | `src/lib/ai/` | ⚠️ 废弃 | 已标记 @deprecated，被 BYOK 系统取代 |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- RED phase: 19/27 tests passed initially (Task 1 verification all pass, Tasks 2-5 error classification tests failed as expected)
- GREEN phase: Implemented `classifyHttpError()` and `classifyNetworkError()` in both `test-connection/route.ts` and `models/route.ts`
- All 27 tests pass after implementation
- Regression: Story 1.2 tests (13/13) all pass
- CODE REVIEW: 7 findings (2 HIGH, 3 MEDIUM, 2 LOW) — all HIGH and MEDIUM fixed
- POST-REVIEW: Extracted shared `error-classification.ts` module, added AbortController timeout, hardened openai-stream.ts error path, added runtime type filtering in models endpoint
- POST-REVIEW: Tests expanded from 27 → 33 (all pass), Story 1.2 regression 13/13 pass

### Completion Notes List

- ✅ Task 1: BYOK 配置完整性验证通过 — 所有现有实现（Provider 预设、URL 规范化、localStorage 持久化、密码切换、Combobox、Ollama 空 Key）均符合 AC 1 要求
- ✅ Task 2: 连接测试链路加固 — 新增 `classifyHttpError()` 和 `classifyNetworkError()` 函数，将原始 Provider 错误替换为分类的中文错误消息（401/403→认证失败、404→模型不存在、超时→检查网络、ECONNREFUSED→检查 Base URL）
- ✅ Task 3: 模型选择链路验证通过 — 三种响应格式（OpenAI/Ollama/直接数组）、Combobox 搜索、手动输入回退、空列表中文提示均已实现
- ✅ Task 4: 安全合规审计通过 — openai-stream.ts 遥测不含 API Key、无 console.log 泄漏、错误响应不再回显原始 Provider 文本（消除潜在 Key 泄漏风险）
- ✅ Task 5: 错误语义统一 — 两个端点的错误分类现在覆盖：认证失败→"检查 API Key 是否有效"、Provider 不可达→"检查 Base URL 是否正确"、超时→"检查网络连接或更换 Provider"、模型不存在→"检查模型 ID 是否正确"、频率限制→"稍后重试"
- ✅ Task 6: 交付校验 — lint 0 errors、build 通过、27 个自动化测试覆盖所有 AC
- ✅ Code Review 修复: 提取共享 error-classification.ts 模块（消除重复代码）、添加 AbortController 15s 超时（激活 timeout 错误分类）、加固 openai-stream.ts 错误路径（不再回显原始 Provider 文本）、models 端点添加运行时类型过滤（防止无效模型条目）、测试扩展至 33 个

### File List

- `writeteam/src/lib/ai/error-classification.ts` — 新增：共享错误分类模块（classifyHttpError、classifyNetworkError、AI_FETCH_TIMEOUT_MS）
- `writeteam/src/app/api/ai/test-connection/route.ts` — 修改：使用共享错误分类模块，添加 AbortController 超时控制
- `writeteam/src/app/api/ai/models/route.ts` — 修改：使用共享错误分类模块，添加 AbortController 超时控制，添加运行时模型类型过滤
- `writeteam/src/lib/ai/openai-stream.ts` — 修改：错误路径使用 classifyHttpError 替代原始 Provider 文本回显
- `writeteam/tests/story-1-3-byok-config.test.mjs` — 修改：适配共享模块重构，新增 AbortController/模块导入/类型安全验证测试（27→33）

## Change Log

- 2026-02-27: Story 文件创建，状态设为 ready-for-dev。
- 2026-02-27: Story 实现完成 — 验证 BYOK 配置完整性，加固 test-connection 和 models 端点的错误分类（中文 + 可执行提示），安全审计确认 API Key 不泄漏，新增 27 个自动化测试。状态更新为 review。
- 2026-02-27: Code Review 完成 — 发现 7 个问题（2 HIGH, 3 MEDIUM, 2 LOW），自动修复全部 HIGH 和 MEDIUM：提取共享 error-classification.ts 模块、添加 AbortController 超时控制、加固 openai-stream.ts 错误路径、models 端点运行时类型过滤、测试 27→33 全通过。状态更新为 done。
