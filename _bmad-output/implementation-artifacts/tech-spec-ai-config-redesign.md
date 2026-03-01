---
title: 'AI 模型配置功能重设计与重构'
slug: 'ai-config-redesign'
created: '2026-03-02'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 16', 'React 19', 'TypeScript', 'Tailwind CSS v4', 'shadcn/ui', 'localStorage', 'React Context', 'sonner']
files_to_modify: ['src/components/settings/ai-provider-form.tsx', 'src/components/settings/settings-content.tsx', 'src/lib/ai/ai-config.ts', 'src/components/editor/editor-shell.tsx']
code_patterns: ['React Context + localStorage', 'BYOK headers protocol', 'shadcn/ui Command Popover ComboBox', 'normalizeBaseUrl']
test_patterns: ['Vitest + @testing-library/react + jsdom', 'colocated .test.tsx files']
---

# Tech-Spec: AI 模型配置功能重设计与重构

**Created:** 2026-03-02

## Overview

### Problem Statement

当前 AI 配置设置页面功能臃肿混乱——基础配置（URL、Key、模型选择）、失败分析仪表盘（图表、错误分布）、Runbook 生成器堆在同一个页面。用户只是想连个 DeepSeek 填个 Key，却面对一整屏的图表和诊断工具。功能没有层次感，认知负担重，视觉臃肿。模型选择依赖硬编码列表，无法适配 Codex 等最新模型。

### Solution

极简化配置体验（URL + Key + 模型三字段）+ 智能适配（URL 补全、Key 自动识别、模型自动拉取）+ 彻底删除失败分析和 Runbook 模块 + 双入口（极简设置页 + 编辑器快捷切换组件）。

### Scope

**In Scope:**
- 设置页极简重设计（三字段 + 智能补全 + 自动拉取模型）
- 编辑器内快捷配置切换组件（Popover/Dialog）
- 彻底删除 FailureAnalysisPanel 和 SupportRunbookPanel 及相关代码
- 模型列表自动拉取（填完 URL+Key 后自动触发）
- 移除模型硬编码白名单，兼容任意模型 + 手动输入兜底
- 智能 Base URL 补全（增强现有 normalize 逻辑为模糊匹配建议）

**Out of Scope:**
- 场景化多配置方案（第三优先级，后续迭代）
- 先用后配流程（第三优先级，后续迭代）
- 连接状态自动检测指示灯（第二优先级）
- 出错时内联诊断提示（第二优先级）

## Context for Development

### Codebase Patterns

- **状态管理**：BYOK 配置通过 React Context + localStorage 管理，hook `useAIConfig` 提供 `config`、`updateConfig`、`clearConfig`、`getHeaders` 方法
- **BYOK 协议**：客户端通过 `X-AI-Base-URL`、`X-AI-API-Key`、`X-AI-Model-ID` 请求头传递配置，服务端 `resolveAIConfig(request)` 提取验证
- **URL 规范化（注意命名冲突）**：`ai-config.ts` 中已有一个私有的 `normalizeBaseUrl()`（解析 protocol+hostname+port，用于 `resolveProviderNameByBaseUrl()`）。`ai-provider-form.tsx` 中有另一个同名但功能不同的局部函数（加 https、去尾斜杠、补 /v1）。为避免冲突，将表单版本重命名为 `formatBaseUrl()` 后再提升到 `ai-config.ts`
- **Error/Recovery 子系统（保留不动）**：`use-ai-recovery.ts`、`recovery-action-bar.tsx`、`parse-ai-error.ts`、`error-classification.ts` 是独立于被删模块的存留系统，本次不改动
- **提供商预设**：`ai-config.ts` 的 `PROVIDER_PRESETS` 数组定义了 DeepSeek、OpenAI、Ollama、OpenRouter、硅基流动
- **模型拉取**：`/api/ai/models` 端点已支持 OpenAI `{ data: [] }`、Ollama `{ models: [] }`、直接数组三种格式
- **模型选择 UI**：已使用 shadcn Command + Popover 实现 ComboBox，支持搜索过滤 + 手动输入
- **组件库**：shadcn/ui new-york style，通过 `npx shadcn@latest add <component>` 添加新组件

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/lib/ai/ai-config.ts` | BYOK 类型定义（`AIProviderConfig`）、Header 常量、`PROVIDER_PRESETS`、`resolveProviderNameByBaseUrl()`、`createTemporaryConfig()`、`buildConfigHeaders()` |
| `src/lib/ai/use-ai-config.ts` | 客户端 hook：`useAIConfig()` → `config`、`isConfigured`、`updateConfig`、`clearConfig`、`getHeaders` |
| `src/lib/ai/resolve-config.ts` | 服务端：`resolveAIConfig(request)` 从请求头提取配置 |
| `src/components/providers/ai-config-provider.tsx` | `AIConfigProvider` Context + `useAIConfigContext()` hook |
| `src/components/settings/ai-provider-form.tsx` | 当前配置表单（438 行），含 `normalizeBaseUrl()`、模型拉取、测试连接、保存/清除——**待重写** |
| `src/components/settings/settings-content.tsx` | 设置页容器，引用三个面板——**待简化** |
| `src/components/settings/failure-analysis-panel.tsx` | 失败分析面板——**待删除** |
| `src/components/settings/failure-analysis-panel.test.tsx` | 失败分析测试——**待删除** |
| `src/components/settings/support-runbook-panel.tsx` | Runbook 面板——**待删除** |
| `src/components/settings/support-runbook-panel.test.tsx` | Runbook 测试——**待删除** |
| `src/lib/ai/model-registry.ts` | 已 deprecated 的硬编码模型列表，仅被 runbook/failure-analysis 引用——**待删除** |
| `src/app/api/ai/failure-analysis/route.ts` | 失败分析 API——**待删除** |
| `src/app/api/ai/failure-analysis/route.test.ts` | 失败分析 API 测试——**待删除** |
| `src/app/api/ai/support-runbook/route.ts` | Runbook API——**待删除** |
| `src/app/api/ai/support-runbook/route.test.ts` | Runbook API 测试——**待删除** |
| `src/app/api/ai/models/route.ts` | 模型拉取端点（保留，不改动） |
| `src/app/api/ai/test-connection/route.ts` | 连接测试端点（保留，不改动） |
| `src/app/(dashboard)/settings/page.tsx` | 设置页路由（保留，不改动） |
| `src/components/editor/editor-shell.tsx` | 编辑器主容器——**待添加快捷配置入口** |
| `scripts/run-tests.mjs` | 测试脚本——第 20 行引用 `failure-analysis/route.test.ts`，第 28 行引用 `failure-analysis-panel.test.tsx`——**待移除这两行** |
| `tests/story-1-3-byok-config.test.mjs` | BYOK 配置 contract test——第 89-106 行读取 `ai-provider-form.tsx` 验证 `normalizeBaseUrl`，第 140-167 行验证表单特定 UI 字符串——**待更新** |

### Technical Decisions

- 配置持久化继续使用 localStorage（不引入服务端存储）
- 双入口共享同一个核心配置组件，设置页和编辑器快捷组件是同一组件的不同呈现形式
- 模型拉取失败时回退为手动输入（ComboBox：下拉选择 + 自由输入）
- 表单中的 `normalizeBaseUrl()` 重命名为 `formatBaseUrl()` 后提升到 `ai-config.ts` 作为共享工具函数导出，避免与 `ai-config.ts` 中已有的同名私有函数冲突
- 智能 URL 补全基于 `PROVIDER_PRESETS` 数组做模糊前缀匹配，不引入额外依赖
- 模型自动拉取使用防抖（500ms debounce），在 baseUrl 非空时自动触发（apiKey 可选，Ollama 不需要 Key）
- **保留不删**的模块：`use-ai-recovery.ts`、`recovery-action-bar.tsx`、`parse-ai-error.ts`、`error-classification.ts`、`ai_history` 表、`ai_failure_recovery` 表及相关 migration（011）——这些是独立的 error/recovery 子系统
- **DB 表不变**：failure analysis 和 runbook 的 API route 被删除，但底层的 `ai_history` 和 `ai_failure_recovery` 表保留不动，不新增 migration 删表

## Implementation Plan

### Tasks

- [x] Task 1: 删除失败分析和 Runbook 相关代码
  - File: `src/components/settings/failure-analysis-panel.tsx` — 删除整个文件
  - File: `src/components/settings/failure-analysis-panel.test.tsx` — 删除整个文件
  - File: `src/components/settings/support-runbook-panel.tsx` — 删除整个文件
  - File: `src/components/settings/support-runbook-panel.test.tsx` — 删除整个文件
  - File: `src/app/api/ai/failure-analysis/route.ts` — 删除整个文件
  - File: `src/app/api/ai/failure-analysis/route.test.ts` — 删除整个文件
  - File: `src/app/api/ai/support-runbook/route.ts` — 删除整个文件
  - File: `src/app/api/ai/support-runbook/route.test.ts` — 删除整个文件
  - File: `src/lib/ai/model-registry.ts` — 删除整个文件（已 deprecated，仅被上述模块引用）
  - Notes: 先删除消费者（panel + API），再删除 model-registry。删除后立即运行 `npm run build` 确认无残留引用。

- [x] Task 2: 简化 settings-content.tsx
  - File: `src/components/settings/settings-content.tsx`
  - Action: 移除 `FailureAnalysisPanel` 和 `SupportRunbookPanel` 的 import 及 JSX 引用，只保留 `<AIProviderForm />`
  - Notes: 设置页容器保持现有 header/layout 结构不变，仅移除两个面板组件的引用。

- [x] Task 3: 重命名并提升 `formatBaseUrl()` + 新增 `suggestBaseUrl()`
  - File: `src/lib/ai/ai-config.ts`
  - Action:
    1. 将 `ai-provider-form.tsx` 中的 `normalizeBaseUrl()` 以新名称 `formatBaseUrl()` 移至此文件并导出。**不要**触碰 `ai-config.ts` 中已有的私有 `normalizeBaseUrl()`（用于 `resolveProviderNameByBaseUrl()`），两者功能不同
    2. 新增 `suggestBaseUrl(input: string): string[]` 函数：根据用户输入前缀在 `PROVIDER_PRESETS` 中模糊匹配，返回匹配的完整 URL 列表。例如输入 "deep" 返回 `["https://api.deepseek.com/v1"]`，输入 "open" 返回 OpenAI 和 OpenRouter 的 URL
  - Notes: `suggestBaseUrl` 做简单的 `preset.name.toLowerCase().includes(input.toLowerCase()) || preset.baseUrl.includes(input)` 匹配即可，不过度设计。

- [x] Task 4: 重写 AIProviderForm 为极简配置组件
  - File: `src/components/settings/ai-provider-form.tsx`
  - Action: 完全重写，实现以下设计：
    1. **三字段核心**：Base URL（带智能建议下拉）、API Key（密码切换）、Model（ComboBox）
    2. **智能 URL 建议**：输入时调用 `suggestBaseUrl()`，在输入框下方显示匹配的预设 URL 列表，点击即填入
    3. **模型自动拉取**：当 `baseUrl` 非空时（apiKey 可选，Ollama 不需要 Key），500ms 防抖后自动调用 `/api/ai/models` 拉取模型列表填充 ComboBox。拉取失败（含未登录 401）静默回退为手动输入
    4. **保存即测试**：保存时自动触发测试连接，成功则保存+toast"配置已保存"，失败则保存+toast 报错+在配置摘要旁显示黄色警告图标"连接未验证"（下次成功测试时自动消失）
    5. **当前配置摘要**：已配置时在底部显示一行摘要（模型名 + 提供商名）
    6. **清除配置**：保留清除按钮
    7. **移除**：独立的"获取模型列表"按钮（改为自动拉取）、独立的"测试连接"按钮（合并到保存流程）、预设服务商按钮行（改为 URL 智能建议）
  - Notes: 组件接受可选 `variant` prop：`"full"` 用于设置页（默认，Card 包裹），`"compact"` 用于编辑器弹窗（无 Card 包裹、无 CardHeader/CardDescription、间距更紧凑 `space-y-3`）。两个 variant 都显示：三字段、URL 建议、保存/清除按钮。full variant 额外显示配置摘要行；compact variant 省略摘要行以节省空间。内部逻辑完全相同。

- [x] Task 5: 在编辑器中添加快捷配置入口
  - File: `src/components/editor/editor-shell.tsx`
  - Action:
    1. 在编辑器顶栏（header 区域）添加一个 AI 配置快捷按钮：
       - 已配置时：显示当前模型名的小 Badge（如 "deepseek-chat"），点击打开 Popover
       - 未配置时：显示 "配置 AI" 按钮，点击打开 Popover
    2. Popover 内渲染 `<AIProviderForm variant="compact" />`
  - Notes: 使用 shadcn Popover 组件。Popover 宽度 `w-80`（320px），`max-h-[70vh]` 带 overflow-y-auto。按钮位置放在顶栏右侧的现有操作按钮区域。z-index 使用 shadcn Popover 默认值（z-50），与编辑器其他弹窗一致。

- [x] Task 6: 清理 scripts/run-tests.mjs
  - File: `scripts/run-tests.mjs`
  - Action: 移除第 20 行 `"src/app/api/ai/failure-analysis/route.test.ts"` 和第 28 行 `"src/components/settings/failure-analysis-panel.test.tsx"`
  - Notes: 其他已删测试文件（support-runbook 相关）不在此脚本中，无需额外处理。

- [x] Task 7: 更新 contract test
  - File: `tests/story-1-3-byok-config.test.mjs`
  - Action:
    1. 第 89-106 行 `normalizeBaseUrl` 测试：改为读取 `src/lib/ai/ai-config.ts` 并验证 `formatBaseUrl` 的存在（包含 `https://`、`/v1`、`replace(/\/+$/, "")` 断言）
    2. 第 140-155 行 `Config summary` 测试：更新断言以匹配重写后的表单结构（仍需包含 `config.baseUrl`、`config.modelName || config.modelId`）。移除 `config.configuredAt` 和 `toLocaleString("zh-CN")` 断言（compact variant 不显示摘要）
    3. 第 157-167 行 `provider preset buttons` 测试：重写——不再有 `PROVIDER_PRESETS.map` 和 `handlePresetClick`，改为验证 `suggestBaseUrl` 相关逻辑
    4. 第 342-370 行 `model combobox` 测试：更新占位符文本断言以匹配重写后的 UI 文案
  - Notes: 保持 contract test 的读取源码+断言模式不变，仅更新断言内容以匹配新实现。

- [x] Task 8: 验证构建与测试
  - Action: 运行 `npm run build` 确认无编译错误，运行 `npm run test` 确认所有测试通过（含 contract test `tests/story-1-3-byok-config.test.mjs`）
  - Notes: 重点验证：(1) 无残留 import 引用已删除模块 (2) contract test 断言匹配新实现 (3) error/recovery 子系统（`use-ai-recovery.ts`、`recovery-action-bar.tsx` 等）未受影响。

### Acceptance Criteria

- [x] AC 1: Given 用户打开设置页, when 页面加载完成, then 只看到三个字段（Base URL、API Key、Model）和保存/清除操作，不再有失败分析图表和 Runbook 工具
- [x] AC 2: Given 用户在 Base URL 输入框输入 "deep", when 输入内容变化, then 输入框下方出现 "https://api.deepseek.com/v1" 的建议，点击即填入
- [x] AC 3: Given 用户在 Base URL 输入框输入 "open", when 输入内容变化, then 出现 OpenAI 和 OpenRouter 两条 URL 建议
- [x] AC 4: Given 用户已填入有效的 Base URL（如 https://api.deepseek.com/v1）且已登录, when 500ms 无进一步输入, then 自动拉取模型列表并填充模型下拉框（apiKey 可选，Ollama 无需 Key）
- [x] AC 5: Given 模型自动拉取失败（网络错误、无效 URL、或未登录 401）, when 拉取完成, then 静默失败不弹 toast，模型字段显示手动输入框供用户自行输入模型 ID
- [x] AC 6: Given 用户选择了模型并点击保存, when 保存操作执行, then 自动测试连接；成功时 toast 显示"配置已保存"；失败时配置仍保存，toast 报错，配置摘要旁显示黄色警告图标"连接未验证"
- [x] AC 7: Given 用户粘贴任意模型 ID（如 "codex-mini"、"o3"、"deepseek-r1"）, when 该模型不在拉取列表中, then 仍可通过手动输入保存该模型 ID，不受白名单限制
- [x] AC 8: Given 用户在编辑器中, when 点击顶栏的 AI 配置按钮, then 弹出 Popover 显示紧凑版配置表单，可完成完整的配置操作
- [x] AC 9: Given 用户已在编辑器中配置完成, when 配置保存成功, then 顶栏按钮立即更新显示当前模型名
- [x] AC 10: Given 项目构建, when 运行 `npm run build`, then 编译成功无错误，所有已删除模块无残留引用
- [x] AC 11: Given 测试运行, when 运行 `npm run test`, then 所有测试通过（含更新后的 contract test，已删除模块的测试一并移除）
- [x] AC 12: Given error/recovery 子系统, when AI 调用失败, then `RecoveryActionBar` 仍正常工作（retry、switch model、dismiss 功能不受影响）

## Additional Context

### Dependencies

- 无新增外部依赖。所有实现基于现有 shadcn/ui 组件（Command、Popover、Input、Button、Badge、Card）
- `/api/ai/models` 和 `/api/ai/test-connection` 端点保持不变

### Testing Strategy

- **单元测试**：为重写后的 `AIProviderForm` 编写 `ai-provider-form.test.tsx`，覆盖：
  - URL 智能建议匹配逻辑
  - 模型自动拉取触发（mock fetch）
  - 保存流程（含自动测试连接、连接失败时黄色警告图标）
  - 手动输入模型 ID
  - compact vs full variant 渲染差异
- **单元测试**：为 `formatBaseUrl()` 和 `suggestBaseUrl()` 函数编写测试（在 `ai-config.test.ts` 中）
- **Contract test 更新**：更新 `tests/story-1-3-byok-config.test.mjs` 中 4 处断言（详见 Task 7）
- **手动测试**：
  - 设置页完整配置流程（输入 URL→智能建议→填 Key→自动拉取模型→保存）
  - 编辑器 Popover 配置流程（打开→配置→保存→Badge 更新）
  - 各提供商实际连接测试（DeepSeek、OpenAI、Ollama、OpenRouter）
  - 手动输入自定义模型 ID 并成功使用 AI 功能
  - 验证 error/recovery 子系统不受影响（触发 AI 错误，确认 RecoveryActionBar 正常）

### Notes

- **设计哲学**：极简主义 + 智能适配 + 按需出现
- **用户原则**：不过度设计，简单操作覆盖复杂场景
- **来源**：头脑风暴会议 `brainstorming-session-2026-03-01-232838.md`
- **风险**：删除 failure-analysis 和 support-runbook 后，用户遇到 AI 错误时失去了主动排障的仪表盘工具。但内联 error/recovery 子系统（`RecoveryActionBar`、`useAIRecovery`）仍完整保留，可自动提示 retry/switch model/check config。这是一个**有意识的产品决策**：用更轻量的内联恢复替代重量级诊断面板。后续通过"出错时内联诊断提示"（第二优先级）进一步增强
- **后续迭代**：场景化多配置方案、先用后配流程、连接状态实时指示灯

## Review Notes

- Adversarial review completed
- Findings: 9 total, 6 fixed, 3 skipped
- Resolution approach: auto-fix
- Fixed: F1 (AbortController cleanup on unmount), F2 (http:// for localhost), F3 (useEffect deps), F5 (blur clears suggestions), F7 (/v1 duplicate guard), F9 (mounted guard on save)
- Skipped: F4 (intentional save-before-test design), F6 (connectionWarning persistence — out of scope), F8 (noise — docs reference)
