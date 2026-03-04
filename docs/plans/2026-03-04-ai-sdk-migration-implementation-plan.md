# Phase 0: AI SDK 迁移实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 AI 调用层从 raw fetch 迁移到 Vercel AI SDK，保持所有 18 个意图行为零变化，为后续 Agent 能力（tool calling, structured output）奠定基础。

**Architecture:** 仅替换两个底层文件（`openai-stream.ts` 和 `openai-json.ts`）的内部实现，从手动 fetch + SSE 解析切换到 AI SDK 的 `streamText()` 和 `generateText()`。所有上层调用者（shared-pipeline、route handler、客户端组件）无需任何改动。

**Tech Stack:** Vercel AI SDK v6 (`ai` ^6.0.100)、`@ai-sdk/openai` ^3.0.33（已安装未使用）、zod ^4.3.6（已安装）

---

## 迁移范围

### 需要迁移的 raw fetch 调用

| 文件 | 函数 | 调用方式 | 迁移目标 |
|------|------|---------|---------|
| `src/lib/ai/openai-stream.ts` | `createOpenAIStreamResponse()` | `fetch()` + 手动 SSE 解析 | `streamText()` |
| `src/lib/ai/openai-json.ts` | `callOpenAIJson()` | `fetch()` + `response.json()` | `generateText()` |

### 不迁移（保持 raw fetch）

| 文件 | 原因 |
|------|------|
| `src/app/api/ai/models/route.ts` | 调用 `/models` 端点（非 chat），AI SDK 不覆盖 |
| `src/app/api/ai/test-connection/route.ts` | 简单探测调用，带自定义 timeout/abort，无需 SDK |

### 调用链影响分析

```
createOpenAIStreamResponse() 被以下文件调用：
  ├─ src/lib/ai/shared-pipeline.ts          → 不改（mock 接口不变）
  ├─ src/app/api/ai/check/route.ts          → 不改（函数签名不变）
  ├─ src/app/api/ai/plugin/route.ts         → 不改（函数签名不变）
  └─ 5 个 *.test.ts 文件 mock 了此函数      → 不改（mock 仍然有效）

callOpenAIJson() 被以下文件调用：
  ├─ src/app/api/ai/check/route.ts          → 不改（函数签名不变）
  └─ (可能) plan/route.ts canvas-generate   → 不改
```

**关键原则：函数签名不变，内部实现替换。所有调用者和测试零改动。**

---

## Task 1: 创建 BYOK Provider 工厂

**Files:**
- Create: `src/lib/ai/ai-provider.ts`
- Test: `src/lib/ai/ai-provider.test.ts`

**Step 1: 写失败测试**

```typescript
// src/lib/ai/ai-provider.test.ts
import { describe, it, expect, vi } from "vitest"

// Mock @ai-sdk/openai
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => {
    const modelFn = (modelId: string) => ({ modelId, provider: "openai" })
    return modelFn
  }),
}))

import { createBYOKProvider } from "./ai-provider"
import { createOpenAI } from "@ai-sdk/openai"

describe("createBYOKProvider", () => {
  it("creates provider with baseURL and apiKey", () => {
    createBYOKProvider({
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-test-123",
      modelId: "deepseek-chat",
    })

    expect(createOpenAI).toHaveBeenCalledWith({
      baseURL: "https://api.deepseek.com/v1",
      apiKey: "sk-test-123",
    })
  })

  it("omits apiKey when empty (Ollama)", () => {
    createBYOKProvider({
      baseUrl: "http://localhost:11434/v1",
      apiKey: "",
      modelId: "llama3",
    })

    expect(createOpenAI).toHaveBeenCalledWith({
      baseURL: "http://localhost:11434/v1",
      apiKey: undefined,
    })
  })

  it("returns a model instance with the given modelId", () => {
    const model = createBYOKProvider({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-key",
      modelId: "gpt-4o",
    })

    expect(model).toEqual({ modelId: "gpt-4o", provider: "openai" })
  })
})
```

**Step 2: 运行测试确认失败**

```bash
npx vitest run src/lib/ai/ai-provider.test.ts
```

Expected: FAIL — `Cannot find module './ai-provider'`

**Step 3: 实现**

```typescript
// src/lib/ai/ai-provider.ts
import { createOpenAI } from "@ai-sdk/openai"

interface BYOKConfig {
  baseUrl: string
  apiKey: string
  modelId: string
}

/**
 * 从用户的 BYOK 配置创建 AI SDK model 实例。
 * 所有预设 provider（DeepSeek, OpenAI, Ollama, OpenRouter, 硅基流动）
 * 都兼容 OpenAI 格式，统一使用 createOpenAI。
 */
export function createBYOKProvider(config: BYOKConfig) {
  const openai = createOpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey || undefined,
  })
  return openai(config.modelId)
}

export type { BYOKConfig }
```

**Step 4: 运行测试确认通过**

```bash
npx vitest run src/lib/ai/ai-provider.test.ts
```

Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/lib/ai/ai-provider.ts src/lib/ai/ai-provider.test.ts
git commit -m "feat: add BYOK provider factory for AI SDK"
```

---

## Task 2: 迁移 openai-stream.ts（流式生成）

**Files:**
- Modify: `src/lib/ai/openai-stream.ts` (全文重写内部实现)
- Test: `src/lib/ai/openai-stream.test.ts` (新建)
- Reference: `src/lib/ai/ai-provider.ts` (Task 1)

**Step 1: 写失败测试**

```typescript
// src/lib/ai/openai-stream.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock dependencies
vi.mock("ai", () => ({
  streamText: vi.fn(),
}))

vi.mock("./ai-provider", () => ({
  createBYOKProvider: vi.fn(() => "mock-model"),
}))

vi.mock("./telemetry", () => ({
  createTextFingerprint: vi.fn(() => "fp-abc"),
  estimateTokenCount: vi.fn(() => 42),
}))

vi.mock("./error-classification", () => ({
  classifyAIError: vi.fn(() => ({
    errorType: "network",
    message: "网络异常",
    retriable: true,
    suggestedActions: ["retry"],
    severity: "medium",
  })),
}))

vi.mock("./ai-config", () => ({
  resolveProviderNameByBaseUrl: vi.fn(() => "TestProvider"),
}))

import { createOpenAIStreamResponse, extractRetryMeta } from "./openai-stream"
import { streamText } from "ai"
import { createBYOKProvider } from "./ai-provider"

// Helper: create a mock async iterable for textStream
function mockTextStream(chunks: string[]) {
  return {
    textStream: (async function* () {
      for (const chunk of chunks) yield chunk
    })(),
    usage: Promise.resolve({ promptTokens: 100, completionTokens: 50 }),
  }
}

const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn(() => Promise.resolve({ error: null })),
  })),
}

const baseTelemetry = {
  supabase: mockSupabase as unknown as import("@supabase/supabase-js").SupabaseClient,
  userId: "u1",
  projectId: "p1",
  documentId: null,
  feature: "write",
  promptLog: "test prompt",
}

describe("createOpenAIStreamResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates BYOK provider with correct config", async () => {
    vi.mocked(streamText).mockReturnValue(mockTextStream(["hello"]) as ReturnType<typeof streamText>)

    await createOpenAIStreamResponse(
      {
        messages: [{ role: "user", content: "hi" }],
        maxTokens: 100,
        temperature: 0.8,
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "sk-test",
        modelId: "deepseek-chat",
      },
      baseTelemetry,
    )

    expect(createBYOKProvider).toHaveBeenCalledWith({
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-test",
      modelId: "deepseek-chat",
    })
  })

  it("calls streamText with correct parameters", async () => {
    vi.mocked(streamText).mockReturnValue(mockTextStream(["hello"]) as ReturnType<typeof streamText>)

    const messages = [
      { role: "system" as const, content: "sys" },
      { role: "user" as const, content: "usr" },
    ]

    await createOpenAIStreamResponse(
      {
        messages,
        maxTokens: 1000,
        temperature: 0.8,
        baseUrl: "https://api.test.com/v1",
        apiKey: "key",
        modelId: "model-1",
      },
      baseTelemetry,
    )

    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mock-model",
        messages,
        maxTokens: 1000,
        temperature: 0.8,
      }),
    )
  })

  it("returns a streaming Response with text content", async () => {
    vi.mocked(streamText).mockReturnValue(
      mockTextStream(["你好", "世界"]) as ReturnType<typeof streamText>,
    )

    const response = await createOpenAIStreamResponse(
      {
        messages: [{ role: "user", content: "hi" }],
        maxTokens: 100,
        temperature: 0.5,
        baseUrl: "https://api.test.com/v1",
        apiKey: "key",
        modelId: "m1",
      },
      baseTelemetry,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8")

    const text = await response.text()
    expect(text).toBe("你好世界")
  })

  it("writes success telemetry to ai_history", async () => {
    vi.mocked(streamText).mockReturnValue(
      mockTextStream(["ok"]) as ReturnType<typeof streamText>,
    )

    const mockInsert = vi.fn(() => Promise.resolve({ error: null }))
    const supabase = {
      from: vi.fn(() => ({ insert: mockInsert })),
    } as unknown as import("@supabase/supabase-js").SupabaseClient

    await createOpenAIStreamResponse(
      {
        messages: [{ role: "user", content: "hi" }],
        maxTokens: 100,
        temperature: 0.5,
        baseUrl: "https://api.test.com/v1",
        apiKey: "key",
        modelId: "m1",
      },
      { ...baseTelemetry, supabase },
    )

    // Consume the stream to trigger finally block
    // (Response body must be consumed for telemetry to fire)

    expect(supabase.from).toHaveBeenCalledWith("ai_history")
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u1",
        project_id: "p1",
        feature: "write",
        result: "ok",
        recovery_status: "success",
      }),
    )
  })

  it("returns error JSON when streamText throws", async () => {
    vi.mocked(streamText).mockImplementation(() => {
      throw new Error("ECONNREFUSED")
    })

    const response = await createOpenAIStreamResponse(
      {
        messages: [{ role: "user", content: "hi" }],
        maxTokens: 100,
        temperature: 0.5,
        baseUrl: "https://bad.url/v1",
        apiKey: "key",
        modelId: "m1",
      },
      baseTelemetry,
    )

    expect(response.status).toBe(502)
    const json = await response.json()
    expect(json.errorType).toBeDefined()
    expect(json.retriable).toBeDefined()
  })
})

describe("extractRetryMeta", () => {
  it("extracts retry metadata from body", () => {
    const result = extractRetryMeta({
      _isRetry: true,
      _attemptedModel: "old-model",
      _recoveryType: "switch",
    })

    expect(result).toEqual({
      isRetry: true,
      attemptedModel: "old-model",
      recoveryType: "switch",
    })
  })

  it("returns empty object when no retry metadata", () => {
    const result = extractRetryMeta({ text: "hello" })
    expect(result).toEqual({})
  })
})
```

**Step 2: 运行测试确认失败**

```bash
npx vitest run src/lib/ai/openai-stream.test.ts
```

Expected: FAIL — tests fail because current implementation doesn't use `streamText` or `createBYOKProvider`

**Step 3: 重写 openai-stream.ts**

```typescript
// src/lib/ai/openai-stream.ts
import { streamText } from "ai"
import { createBYOKProvider } from "@/lib/ai/ai-provider"
import { createTextFingerprint, estimateTokenCount } from "@/lib/ai/telemetry"
import { classifyAIError } from "@/lib/ai/error-classification"
import { resolveProviderNameByBaseUrl } from "@/lib/ai/ai-config"
import type { SupabaseClient } from "@supabase/supabase-js"

interface OpenAIStreamOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  maxTokens: number
  temperature: number
  baseUrl: string
  apiKey: string
  modelId: string
}

interface TelemetryOptions {
  supabase: SupabaseClient
  userId: string
  projectId: string
  documentId: string | null
  feature: string
  promptLog: string
  isRetry?: boolean
  attemptedModel?: string
  recoveryType?: "retry" | "switch"
}

/**
 * Extract retry/recovery metadata from API request body.
 * Client injects _isRetry, _attemptedModel, _recoveryType when retrying via RecoveryActionBar.
 */
export function extractRetryMeta(body: Record<string, unknown>): {
  isRetry?: boolean
  attemptedModel?: string
  recoveryType?: "retry" | "switch"
} {
  const meta: { isRetry?: boolean; attemptedModel?: string; recoveryType?: "retry" | "switch" } = {}
  if (body._isRetry === true) meta.isRetry = true
  if (typeof body._attemptedModel === "string") meta.attemptedModel = body._attemptedModel
  if (body._recoveryType === "retry" || body._recoveryType === "switch") meta.recoveryType = body._recoveryType
  return meta
}

export async function createOpenAIStreamResponse(
  options: OpenAIStreamOptions,
  telemetry: TelemetryOptions,
): Promise<Response> {
  const startedAt = Date.now()
  const provider = resolveProviderNameByBaseUrl(options.baseUrl)

  // Create AI SDK model from BYOK config
  let model
  try {
    model = createBYOKProvider({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      modelId: options.modelId,
    })
  } catch (error) {
    const classification = classifyAIError(null, error, "ai-stream")
    await writeTelemetry(telemetry, "", startedAt, provider, "failure", options.modelId)
    return Response.json(
      {
        error: classification.message,
        errorType: classification.errorType,
        retriable: classification.retriable,
        suggestedActions: classification.suggestedActions,
      },
      { status: 502 },
    )
  }

  // Start streaming
  let result
  try {
    result = streamText({
      model,
      messages: options.messages,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    })
  } catch (error) {
    const classification = classifyAIError(null, error, "ai-stream")
    await writeTelemetry(telemetry, "", startedAt, provider, "failure", options.modelId)
    return Response.json(
      {
        error: classification.message,
        errorType: classification.errorType,
        retriable: classification.retriable,
        suggestedActions: classification.suggestedActions,
      },
      { status: 502 },
    )
  }

  // Build streaming response
  const encoder = new TextEncoder()
  let fullText = ""
  let streamError = false

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          fullText += chunk
          controller.enqueue(encoder.encode(chunk))
        }
      } catch {
        streamError = true
        const errorEvent = JSON.stringify({
          error: "流式传输中断，请重试。",
          errorType: "network",
          retriable: true,
          suggestedActions: ["retry", "switch_model"],
        })
        controller.enqueue(encoder.encode(`\n\ndata: ${errorEvent}\n\n`))
      } finally {
        const recoveryStatus = streamError
          ? "failure"
          : telemetry.recoveryType === "switch"
            ? "recovered_switch"
            : telemetry.isRetry
              ? "recovered_retry"
              : "success"

        await writeTelemetry(
          telemetry, fullText, startedAt, provider, recoveryStatus, options.modelId, streamError,
        )
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}

/** Write telemetry to ai_history table */
async function writeTelemetry(
  telemetry: TelemetryOptions,
  fullText: string,
  startedAt: number,
  provider: string,
  recoveryStatus: string,
  modelId: string,
  isError = false,
) {
  await telemetry.supabase.from("ai_history").insert({
    user_id: telemetry.userId,
    project_id: telemetry.projectId,
    document_id: telemetry.documentId,
    provider,
    feature: telemetry.feature,
    prompt: telemetry.promptLog,
    result: fullText,
    model: modelId,
    tokens_used: estimateTokenCount(fullText),
    latency_ms: Date.now() - startedAt,
    output_chars: fullText.length,
    response_fingerprint: fullText ? createTextFingerprint(fullText) : null,
    error_type: isError ? "network" : null,
    error_message: isError ? "流式传输中断" : null,
    is_retry: telemetry.isRetry ?? false,
    recovery_status: recoveryStatus,
    attempted_model: telemetry.attemptedModel ?? null,
  })
}
```

**Step 4: 运行新测试确认通过**

```bash
npx vitest run src/lib/ai/openai-stream.test.ts
```

Expected: ALL PASS

**Step 5: 运行所有现有测试确认零回归**

```bash
npx vitest run src/lib/ai/shared-pipeline.test.ts
npx vitest run src/app/api/ai/write/route.test.ts
npx vitest run src/app/api/ai/edit/route.test.ts
npx vitest run src/app/api/ai/chat/route.test.ts
npx vitest run src/app/api/ai/plan/route.test.ts
npx vitest run src/app/api/ai/check/route.test.ts
```

Expected: ALL PASS — 这些测试都 mock 了 `createOpenAIStreamResponse`，函数签名不变所以 mock 仍然有效。

**Step 6: Commit**

```bash
git add src/lib/ai/openai-stream.ts src/lib/ai/openai-stream.test.ts
git commit -m "refactor: migrate openai-stream from raw fetch to AI SDK streamText"
```

---

## Task 3: 迁移 openai-json.ts（非流式 JSON 调用）

**Files:**
- Modify: `src/lib/ai/openai-json.ts` (重写内部实现)
- Test: `src/lib/ai/openai-json.test.ts` (新建)

**Step 1: 写失败测试**

```typescript
// src/lib/ai/openai-json.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("ai", () => ({
  generateText: vi.fn(),
}))

vi.mock("./ai-provider", () => ({
  createBYOKProvider: vi.fn(() => "mock-model"),
}))

import { callOpenAIJson } from "./openai-json"
import { generateText } from "ai"
import { createBYOKProvider } from "./ai-provider"

describe("callOpenAIJson", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls generateText with correct parameters", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '{"result": "ok"}',
    } as Awaited<ReturnType<typeof generateText>>)

    const messages = [
      { role: "system" as const, content: "sys" },
      { role: "user" as const, content: "usr" },
    ]

    await callOpenAIJson({
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      modelId: "model-1",
      messages,
      maxTokens: 500,
      temperature: 0.3,
    })

    expect(createBYOKProvider).toHaveBeenCalledWith({
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      modelId: "model-1",
    })

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mock-model",
        messages,
        maxTokens: 500,
        temperature: 0.3,
      }),
    )
  })

  it("returns content on success", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '{"activeCharacters": ["李明"]}',
    } as Awaited<ReturnType<typeof generateText>>)

    const result = await callOpenAIJson({
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      modelId: "m1",
      messages: [{ role: "user", content: "test" }],
      maxTokens: 100,
      temperature: 0.3,
    })

    expect(result.content).toBe('{"activeCharacters": ["李明"]}')
    expect(result.error).toBeUndefined()
  })

  it("returns error when generateText throws", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("API error"))

    const result = await callOpenAIJson({
      baseUrl: "https://bad.url/v1",
      apiKey: "key",
      modelId: "m1",
      messages: [{ role: "user", content: "test" }],
      maxTokens: 100,
      temperature: 0.3,
    })

    expect(result.content).toBe("")
    expect(result.error).toContain("AI API 错误")
  })
})
```

**Step 2: 运行测试确认失败**

```bash
npx vitest run src/lib/ai/openai-json.test.ts
```

Expected: FAIL — current implementation doesn't use `generateText`

**Step 3: 重写 openai-json.ts**

```typescript
// src/lib/ai/openai-json.ts
import { generateText } from "ai"
import { createBYOKProvider } from "@/lib/ai/ai-provider"

/**
 * Non-streaming OpenAI-compatible JSON call.
 * Used by saliency, canvas-generate, and visualize routes.
 *
 * Migrated from raw fetch to AI SDK generateText().
 * External interface unchanged — callers need no modifications.
 */
export async function callOpenAIJson(options: {
  baseUrl: string
  apiKey: string
  modelId: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  maxTokens: number
  temperature: number
}): Promise<{ content: string; error?: string }> {
  try {
    const model = createBYOKProvider({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      modelId: options.modelId,
    })

    const result = await generateText({
      model,
      messages: options.messages,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    })

    return { content: result.text }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { content: "", error: `AI API 错误: ${message}` }
  }
}
```

**Step 4: 运行测试确认通过**

```bash
npx vitest run src/lib/ai/openai-json.test.ts
```

Expected: ALL PASS

**Step 5: 运行 check route 测试确认零回归**

```bash
npx vitest run src/app/api/ai/check/route.test.ts
```

Expected: PASS — check route 测试 mock 了 `callOpenAIJson`，签名不变。

**Step 6: Commit**

```bash
git add src/lib/ai/openai-json.ts src/lib/ai/openai-json.test.ts
git commit -m "refactor: migrate openai-json from raw fetch to AI SDK generateText"
```

---

## Task 4: 全量测试回归验证

**Files:**
- No code changes
- Run all existing tests

**Step 1: 运行全部 AI 相关测试**

```bash
npx vitest run src/lib/ai/
```

Expected: ALL PASS。关键测试文件：
- `shared-pipeline.test.ts` — mock `createOpenAIStreamResponse`，签名不变 ✓
- `intent-config.test.ts` — 不涉及 stream ✓
- `story-context.test.ts` — 不涉及 stream ✓
- `consistency-preflight.test.ts` — 不涉及 stream ✓
- `category-mapping.test.ts` — 不涉及 stream ✓
- `read-ai-stream.test.ts` — 客户端消费流，不涉及 ✓

**Step 2: 运行全部 route handler 测试**

```bash
npx vitest run src/app/api/ai/
```

Expected: ALL PASS。这些测试都 mock 了底层函数。

**Step 3: 运行完整测试套件**

```bash
npm run test
```

Expected: ALL PASS

**Step 4: Commit（如有任何修复）**

```bash
# 仅在需要修复时 commit
git add -A
git commit -m "fix: resolve test regressions from AI SDK migration"
```

---

## Task 5: ESLint + Build 验证

**Files:**
- No code changes expected

**Step 1: 运行 ESLint**

```bash
npm run lint
```

Expected: No new errors。注意检查：
- `ai` 和 `@ai-sdk/openai` 的 import 是否被 lint 规则接受
- 未使用的旧 import（如 `openai-stream.ts` 中删除的 `fetch` 相关代码）是否被清理

**Step 2: 运行 production build**

```bash
npm run build
```

Expected: Build succeeds。关键验证点：
- 服务端代码正确 bundle 了 `ai` 和 `@ai-sdk/openai`
- 没有 "module not found" 错误
- `node:crypto`（telemetry.ts 中使用）不与 AI SDK 冲突

**Step 3: Commit（如有修复）**

```bash
git add -A
git commit -m "fix: resolve lint/build issues from AI SDK migration"
```

---

## Task 6: 清理旧代码

**Files:**
- Modify: `src/lib/ai/openai-stream.ts` — 确认无残留 raw fetch 代码
- Modify: `src/lib/ai/openai-json.ts` — 确认无残留 raw fetch 代码

**Step 1: 检查并删除不再需要的 import**

在 `openai-stream.ts` 中，确认以下内容已被移除：
- 不再有 `fetch()` 调用
- 不再有手动 SSE 解析 (`data.slice(6)`, `[DONE]` 检查)
- 不再有手动 `Authorization: Bearer` header 拼装
- 不再有 `choices[0].delta.content` 手动提取

在 `openai-json.ts` 中，确认以下内容已被移除：
- 不再有 `fetch()` 调用
- 不再有 `response.json()` + `data.choices[0].message.content` 提取

**Step 2: 最终验证**

```bash
npm run lint && npm run test && npm run build
```

Expected: ALL PASS

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: clean up residual raw fetch code after AI SDK migration"
```

---

## 迁移后的文件状态总结

| 文件 | 变更 | 行数变化 |
|------|------|---------|
| `src/lib/ai/ai-provider.ts` | **新建** | +20 行 |
| `src/lib/ai/ai-provider.test.ts` | **新建** | +50 行 |
| `src/lib/ai/openai-stream.ts` | **重写** | 228 → ~130 行 (−43%) |
| `src/lib/ai/openai-stream.test.ts` | **新建** | +120 行 |
| `src/lib/ai/openai-json.ts` | **重写** | 43 → ~30 行 (−30%) |
| `src/lib/ai/openai-json.test.ts` | **新建** | +70 行 |

**净变化：** 代码 −90 行，测试 +240 行

**零改动文件（验证列表）：**
- `src/lib/ai/shared-pipeline.ts` — 不变
- `src/lib/ai/shared-pipeline.test.ts` — 不变
- `src/app/api/ai/write/route.ts` — 不变
- `src/app/api/ai/edit/route.ts` — 不变
- `src/app/api/ai/chat/route.ts` — 不变
- `src/app/api/ai/plan/route.ts` — 不变
- `src/app/api/ai/check/route.ts` — 不变
- `src/app/api/ai/plugin/route.ts` — 不变
- `src/app/api/ai/models/route.ts` — 不变
- `src/app/api/ai/test-connection/route.ts` — 不变
- 所有客户端组件 — 不变

## 迁移后解锁的能力

迁移完成后，以下 AI SDK 功能可在后续 Phase 中直接使用：

```typescript
// Phase 1: 结构化输出（章节摘要生成）
import { generateObject } from "ai"
const { object } = await generateObject({ model, schema: ChapterSummarySchema, ... })

// Phase 2: Agent Loop（验证-修正循环）
import { generateText } from "ai"
const verification = await generateText({ model, prompt: "检查一致性...", maxTokens: 500 })

// Phase 3: Tool Calling（工具驱动 Agent）
import { generateText, tool } from "ai"
const result = await generateText({
  model,
  tools: { searchChapters: tool({ ... }), getCharacter: tool({ ... }) },
  maxSteps: 5,
})
```
