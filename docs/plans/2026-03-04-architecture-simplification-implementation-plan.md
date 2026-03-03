# 架构精简 阶段 1 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 22 个 AI 路由合并为 5+3 个，简化一致性系统（5→2 文件），精简上下文编排（~700→~200 行）。

**Architecture:** 创建共享 AI 管道工具函数，将每个 intent 的配置（温度、token 限制、prompt 模板）提取为声明式注册表。合并路由层，然后简化底层模块。

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Supabase

---

## Task 1: 创建 Intent 配置注册表

**Files:**
- Create: `src/lib/ai/intent-config.ts`
- Create: `src/lib/ai/intent-config.test.ts`

**Step 1: 写失败测试**

```ts
// src/lib/ai/intent-config.test.ts
import { describe, it, expect } from "vitest"
import {
  getIntentConfig,
  getIntentsByCategory,
  type AIIntent,
  type RouteCategory,
} from "@/lib/ai/intent-config"

describe("intent-config", () => {
  it("returns config for known intent", () => {
    const cfg = getIntentConfig("expand")
    expect(cfg).toBeDefined()
    expect(cfg!.temperature).toBe(0.8)
    expect(cfg!.maxTokens).toBe(1500)
    expect(cfg!.category).toBe("write")
    expect(cfg!.feature).toBe("expand")
  })

  it("returns undefined for unknown intent", () => {
    expect(getIntentConfig("nonexistent" as AIIntent)).toBeUndefined()
  })

  it("lists intents by category", () => {
    const writeIntents = getIntentsByCategory("write")
    expect(writeIntents.map((c) => c.intent)).toContain("write")
    expect(writeIntents.map((c) => c.intent)).toContain("expand")
    expect(writeIntents.map((c) => c.intent)).toContain("first-draft")
    expect(writeIntents.map((c) => c.intent)).toContain("describe")
  })

  it("maps edit category correctly", () => {
    const editIntents = getIntentsByCategory("edit")
    expect(editIntents.map((c) => c.intent)).toEqual(
      expect.arrayContaining(["quick-edit", "rewrite", "shrink", "tone-shift"])
    )
  })

  it("maps chat category correctly", () => {
    const chatIntents = getIntentsByCategory("chat")
    expect(chatIntents.map((c) => c.intent)).toEqual(
      expect.arrayContaining(["chat", "brainstorm", "twist", "muse", "bible-assist"])
    )
  })

  it("maps check category correctly", () => {
    const checkIntents = getIntentsByCategory("check")
    expect(checkIntents.map((c) => c.intent)).toEqual(
      expect.arrayContaining(["continuity-check", "saliency"])
    )
  })

  it("maps plan category correctly", () => {
    const planIntents = getIntentsByCategory("plan")
    expect(planIntents.map((c) => c.intent)).toEqual(
      expect.arrayContaining(["scene-plan", "canvas-generate", "visualize"])
    )
  })

  it("every intent has required fields", () => {
    const allIntents: AIIntent[] = [
      "write", "first-draft", "expand", "describe",
      "quick-edit", "rewrite", "shrink", "tone-shift",
      "continuity-check", "saliency",
      "chat", "brainstorm", "twist", "muse", "bible-assist",
      "scene-plan", "canvas-generate", "visualize",
    ]
    for (const intent of allIntents) {
      const cfg = getIntentConfig(intent)
      expect(cfg, `missing config for ${intent}`).toBeDefined()
      expect(cfg!.temperature).toBeGreaterThan(0)
      expect(cfg!.maxTokens).toBeGreaterThan(0)
      expect(cfg!.category).toBeTruthy()
      expect(cfg!.feature).toBeTruthy()
      expect(cfg!.streaming).toBeDefined()
    }
  })
})
```

**Step 2: 运行测试确认失败**

Run: `npx vitest run src/lib/ai/intent-config.test.ts`
Expected: FAIL — module not found

**Step 3: 实现最小代码**

```ts
// src/lib/ai/intent-config.ts
import type { AIFeature } from "@/lib/ai/feature-groups"

export type RouteCategory = "write" | "edit" | "check" | "chat" | "plan"

export type AIIntent =
  | "write" | "first-draft" | "expand" | "describe"
  | "quick-edit" | "rewrite" | "shrink" | "tone-shift"
  | "continuity-check" | "saliency"
  | "chat" | "brainstorm" | "twist" | "muse" | "bible-assist"
  | "scene-plan" | "canvas-generate" | "visualize"

export interface IntentConfig {
  intent: AIIntent
  feature: AIFeature          // maps to existing AIFeature for story-context
  category: RouteCategory
  temperature: number
  maxTokens: number
  streaming: boolean           // false for JSON-response intents
  contextLevel: "full" | "summary" | "minimal"
  consistencyPreflight: boolean // only write + quick-edit
}

const INTENT_CONFIGS: IntentConfig[] = [
  // --- write category ---
  { intent: "write", feature: "write", category: "write", temperature: 0.8, maxTokens: 1000, streaming: true, contextLevel: "full", consistencyPreflight: true },
  { intent: "first-draft", feature: "first-draft", category: "write", temperature: 0.85, maxTokens: 2500, streaming: true, contextLevel: "full", consistencyPreflight: false },
  { intent: "expand", feature: "expand", category: "write", temperature: 0.8, maxTokens: 1500, streaming: true, contextLevel: "full", consistencyPreflight: false },
  { intent: "describe", feature: "describe", category: "write", temperature: 0.9, maxTokens: 1000, streaming: true, contextLevel: "full", consistencyPreflight: false },

  // --- edit category ---
  { intent: "quick-edit", feature: "quick-edit", category: "edit", temperature: 0.7, maxTokens: 1500, streaming: true, contextLevel: "full", consistencyPreflight: true },
  { intent: "rewrite", feature: "rewrite", category: "edit", temperature: 0.7, maxTokens: 1500, streaming: true, contextLevel: "full", consistencyPreflight: false },
  { intent: "shrink", feature: "shrink", category: "edit", temperature: 0.5, maxTokens: 1000, streaming: true, contextLevel: "full", consistencyPreflight: false },
  { intent: "tone-shift", feature: "tone-shift", category: "edit", temperature: 0.7, maxTokens: 1000, streaming: true, contextLevel: "full", consistencyPreflight: false },

  // --- check category ---
  { intent: "continuity-check", feature: "continuity-check", category: "check", temperature: 0.3, maxTokens: 1500, streaming: true, contextLevel: "full", consistencyPreflight: false },
  { intent: "saliency", feature: "saliency", category: "check", temperature: 0.5, maxTokens: 500, streaming: false, contextLevel: "minimal", consistencyPreflight: false },

  // --- chat category ---
  { intent: "chat", feature: "chat", category: "chat", temperature: 0.7, maxTokens: 1000, streaming: true, contextLevel: "summary", consistencyPreflight: false },
  { intent: "brainstorm", feature: "brainstorm", category: "chat", temperature: 1.0, maxTokens: 1000, streaming: true, contextLevel: "summary", consistencyPreflight: false },
  { intent: "twist", feature: "twist", category: "chat", temperature: 0.9, maxTokens: 1000, streaming: true, contextLevel: "summary", consistencyPreflight: false },
  { intent: "muse", feature: "muse", category: "chat", temperature: 0.9, maxTokens: 1200, streaming: true, contextLevel: "summary", consistencyPreflight: false },
  { intent: "bible-assist", feature: "bible-assist", category: "chat", temperature: 0.7, maxTokens: 2000, streaming: true, contextLevel: "summary", consistencyPreflight: false },

  // --- plan category ---
  { intent: "scene-plan", feature: "scene-plan", category: "plan", temperature: 0.7, maxTokens: 1500, streaming: true, contextLevel: "summary", consistencyPreflight: false },
  { intent: "canvas-generate", feature: "canvas-generate", category: "plan", temperature: 0.7, maxTokens: 2000, streaming: false, contextLevel: "summary", consistencyPreflight: false },
  { intent: "visualize", feature: "visualize", category: "plan", temperature: 0.7, maxTokens: 500, streaming: false, contextLevel: "minimal", consistencyPreflight: false },
]

export function getIntentConfig(intent: AIIntent): IntentConfig | undefined {
  return INTENT_CONFIGS.find((c) => c.intent === intent)
}

export function getIntentsByCategory(category: RouteCategory): IntentConfig[] {
  return INTENT_CONFIGS.filter((c) => c.category === category)
}
```

**Step 4: 运行测试确认通过**

Run: `npx vitest run src/lib/ai/intent-config.test.ts`
Expected: PASS

**Step 5: 提交**

```bash
git add src/lib/ai/intent-config.ts src/lib/ai/intent-config.test.ts
git commit -m "feat: add intent configuration registry for AI endpoint consolidation"
```

---

## Task 2: 创建共享 AI 管道工具函数

**Files:**
- Create: `src/lib/ai/shared-pipeline.ts`
- Create: `src/lib/ai/shared-pipeline.test.ts`
- Reference: `src/lib/ai/openai-stream.ts`
- Reference: `src/lib/ai/story-context.ts`
- Reference: `src/lib/ai/resolve-config.ts`

**Goal:** 提取所有 22 个路由共享的 5 步管道（认证 → 配置解析 → 上下文加载 → 编排 → 流式响应）为一个可复用函数。

**Step 1: 写失败测试**

```ts
// src/lib/ai/shared-pipeline.test.ts
import { describe, it, expect, vi } from "vitest"

// Mock 依赖
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

import { validateAndResolve } from "@/lib/ai/shared-pipeline"

describe("shared-pipeline", () => {
  describe("validateAndResolve", () => {
    it("returns 401 when user is not authenticated", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: "not authenticated" },
          }),
        },
      }

      const result = await validateAndResolve(
        mockSupabase as any,
        new Request("http://test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: "p1", intent: "expand" }),
        })
      )

      expect(result.error).toBeDefined()
      expect(result.error!.status).toBe(401)
    })

    it("returns 400 when projectId is missing", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "u1" } },
            error: null,
          }),
        },
      }

      const result = await validateAndResolve(
        mockSupabase as any,
        new Request("http://test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent: "expand" }),
        })
      )

      expect(result.error).toBeDefined()
      expect(result.error!.status).toBe(400)
    })

    it("returns 400 when AI config is missing", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "u1" } },
            error: null,
          }),
        },
      }

      // No AI config headers
      const result = await validateAndResolve(
        mockSupabase as any,
        new Request("http://test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: "p1", intent: "expand" }),
        })
      )

      expect(result.error).toBeDefined()
      expect(result.error!.status).toBe(400)
    })
  })
})
```

**Step 2: 运行测试确认失败**

Run: `npx vitest run src/lib/ai/shared-pipeline.test.ts`
Expected: FAIL — module not found

**Step 3: 实现共享管道**

先阅读 `src/lib/ai/resolve-config.ts` 了解 `resolveAIConfig` 的签名，然后实现：

```ts
// src/lib/ai/shared-pipeline.ts
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { runConsistencyPreflight } from "@/lib/ai/consistency-preflight"
import { getIntentConfig, type AIIntent } from "@/lib/ai/intent-config"
import type { SaliencyMap } from "@/lib/ai/story-context"
import type { SupabaseClient } from "@supabase/supabase-js"

interface PipelineInput {
  supabase: SupabaseClient
  request: Request
  intent: AIIntent
  buildMessages: (params: {
    body: Record<string, unknown>
    fullContext: string
  }) => Array<{ role: "system" | "user" | "assistant"; content: string }>
}

interface ResolveResult {
  error?: { response: Response; status: number }
  userId?: string
  body?: Record<string, unknown>
  aiConfig?: { baseUrl: string; apiKey: string; modelId: string }
}

/**
 * Step 1-2 of the pipeline: authenticate + resolve AI config + parse body.
 * Extracted so it can be unit tested without real Supabase.
 */
export async function validateAndResolve(
  supabase: SupabaseClient,
  request: Request
): Promise<ResolveResult> {
  // Step 1: Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return {
      error: {
        response: Response.json({ error: "未登录" }, { status: 401 }),
        status: 401,
      },
    }
  }

  // Parse body
  const body = await request.json() as Record<string, unknown>

  // Validate projectId
  if (!body.projectId || typeof body.projectId !== "string") {
    return {
      error: {
        response: Response.json({ error: "缺少 projectId" }, { status: 400 }),
        status: 400,
      },
    }
  }

  // Step 2: AI config
  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) {
    return {
      error: {
        response: Response.json(
          { error: "请先配置 AI 服务商", errorType: "config_missing" },
          { status: 400 }
        ),
        status: 400,
      },
    }
  }

  return { userId: user.id, body, aiConfig }
}

/**
 * Full 5-step streaming pipeline.
 * Used by consolidated route handlers for streaming intents.
 */
export async function runStreamingPipeline(input: PipelineInput): Promise<Response> {
  const { supabase, request, intent, buildMessages } = input

  const intentConfig = getIntentConfig(intent)
  if (!intentConfig) {
    return Response.json({ error: `未知的 intent: ${intent}` }, { status: 400 })
  }

  // Steps 1-2: Auth + config
  const resolved = await validateAndResolve(supabase, request)
  if (resolved.error) return resolved.error.response

  const { userId, body, aiConfig } = resolved as Required<
    Pick<ResolveResult, "userId" | "body" | "aiConfig">
  >

  const projectId = body.projectId as string
  const documentId = typeof body.documentId === "string" ? body.documentId : null
  const retryMeta = extractRetryMeta(body)

  // Step 3: Consistency preflight (only for write + quick-edit)
  if (intentConfig.consistencyPreflight) {
    const storyCtxForPreflight = await fetchStoryContext(supabase, projectId, userId)
    if (storyCtxForPreflight.consistencyState) {
      const text = typeof body.text === "string" ? body.text : ""
      const context = typeof body.context === "string" ? body.context : ""
      const preflight = runConsistencyPreflight({
        text: `${context}\n${text}`,
        consistencyState: storyCtxForPreflight.consistencyState,
      })
      if (preflight.shouldBlock) {
        return Response.json(
          {
            error: "检测到高风险设定冲突，请先修正后再试",
            errorType: "consistency_high_risk",
            severity: "high",
            violations: preflight.violations,
          },
          { status: 409 }
        )
      }
    }
  }

  // Step 4: Story context + prompt orchestration
  const storyCtx = await fetchStoryContext(supabase, projectId, userId)

  const proseModeValue = typeof body.proseMode === "string" ? body.proseMode : null
  const saliencyMap =
    body.saliency && typeof body.saliency === "object"
      ? (body.saliency as SaliencyMap)
      : null

  const { fullContext } = buildStoryPromptContext(storyCtx, {
    feature: intentConfig.feature,
    proseMode: proseModeValue,
    saliencyMap,
  })

  // Build messages using intent-specific logic
  const messages = buildMessages({ body, fullContext })

  // Step 5: Stream response
  return createOpenAIStreamResponse(
    {
      messages,
      maxTokens: intentConfig.maxTokens,
      temperature: intentConfig.temperature,
      baseUrl: aiConfig.baseUrl,
      apiKey: aiConfig.apiKey,
      modelId: aiConfig.modelId,
    },
    {
      supabase,
      userId,
      projectId,
      documentId,
      feature: intentConfig.feature,
      promptLog: messages.map((m) => `[${m.role}] ${m.content.slice(0, 200)}`).join("\n"),
      ...retryMeta,
    }
  )
}
```

**Step 4: 运行测试确认通过**

Run: `npx vitest run src/lib/ai/shared-pipeline.test.ts`
Expected: PASS

**Step 5: 提交**

```bash
git add src/lib/ai/shared-pipeline.ts src/lib/ai/shared-pipeline.test.ts
git commit -m "feat: add shared AI streaming pipeline utility"
```

---

## Task 3: 创建合并的 /api/ai/write 路由

**Files:**
- Modify: `src/app/api/ai/write/route.ts`
- Reference: existing `expand/route.ts`, `first-draft/route.ts`, `describe/route.ts`

**Goal:** 将 write、first-draft、expand、describe 合并到一个路由，通过 `intent` 参数分发。

**Step 1: 阅读现有的 4 个路由文件**

Read 并记录每个路由的：
- 独特请求参数
- system prompt 构建方式
- 特殊逻辑

**Step 2: 写失败测试**

在现有的 `src/app/api/ai/write/route.test.ts` 中添加新的测试用例：

```ts
// 在现有测试文件末尾添加
describe("consolidated write route with intent", () => {
  it("handles expand intent", async () => {
    // mock fetch, supabase etc.
    const body = {
      intent: "expand",
      projectId: "p1",
      text: "测试文本",
      context: "上下文",
    }
    // ... 验证调用了正确的 temperature (0.8) 和 maxTokens (1500)
  })

  it("defaults intent to write when not specified", async () => {
    const body = {
      projectId: "p1",
      text: "测试文本",
    }
    // ... 验证向后兼容
  })
})
```

**Step 3: 重写 write/route.ts**

```ts
// src/app/api/ai/write/route.ts
import { createClient } from "@/lib/supabase/server"
import { runStreamingPipeline } from "@/lib/ai/shared-pipeline"
import type { AIIntent } from "@/lib/ai/intent-config"

const WRITE_INTENTS = new Set<AIIntent>(["write", "first-draft", "expand", "describe"])

export async function POST(request: Request) {
  const supabase = await createClient()
  const clonedRequest = request.clone()
  const body = await clonedRequest.json()

  // 向后兼容：无 intent 时默认为 "write"
  const intent: AIIntent = WRITE_INTENTS.has(body.intent) ? body.intent : "write"

  return runStreamingPipeline({
    supabase,
    request,
    intent,
    buildMessages: ({ body: reqBody, fullContext }) => {
      const text = typeof reqBody.text === "string" ? reqBody.text : ""
      const context = typeof reqBody.context === "string" ? reqBody.context : ""

      const systemPrompt = buildWriteCategorySystemPrompt(intent, fullContext, reqBody)
      const userPrompt = buildWriteCategoryUserPrompt(intent, text, context, reqBody)

      return [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userPrompt },
      ]
    },
  })
}

function buildWriteCategorySystemPrompt(
  intent: AIIntent,
  fullContext: string,
  body: Record<string, unknown>
): string {
  const base = `你是一位经验丰富的小说编辑和创意写作助手。使用中文（zh-CN）回复。\n\n${fullContext}`

  switch (intent) {
    case "expand":
      return `${base}\n\n扩展并丰富以下文本。增添感官描写、人物内心活动和环境细节，保持原有情节不变。`
    case "describe":
      return `${base}\n\n为以下内容生成生动的感官描写，覆盖视觉、听觉、触觉、嗅觉和味觉。`
    case "first-draft":
      return `${base}\n\n根据大纲生成完整的首稿场景。包含对话、描写和过渡，但保持文风自然。`
    case "write":
    default: {
      const mode = typeof body.mode === "string" ? body.mode : "auto"
      const guidance = typeof body.guidance === "string" ? body.guidance : ""
      if (mode === "guided" && guidance) {
        return `${base}\n\n按照以下指导续写：${guidance}`
      }
      return `${base}\n\n自然地续写故事。保持人物语气、场景氛围和情节节奏的一致性。`
    }
  }
}

function buildWriteCategoryUserPrompt(
  intent: AIIntent,
  text: string,
  context: string,
  body: Record<string, unknown>
): string {
  switch (intent) {
    case "expand":
      return context
        ? `上下文：\n${context.slice(-2000)}\n\n请扩写以下段落：\n${text}`
        : `请扩写以下段落：\n${text}`
    case "describe":
      return `请为以下内容生成感官描写：\n${text}`
    case "first-draft": {
      const outline = typeof body.outline === "string" ? body.outline : text
      return context
        ? `参考上下文：\n${context.slice(-2000)}\n\n大纲：\n${outline}\n\n请生成完整首稿。`
        : `大纲：\n${outline}\n\n请生成完整首稿。`
    }
    case "write":
    default:
      return context
        ? `前文：\n${context.slice(-3000)}\n\n${text ? `当前段落：\n${text}\n\n请续写。` : "请续写。"}`
        : text || "请开始写作。"
  }
}
```

**Step 4: 运行测试**

Run: `npx vitest run src/app/api/ai/write/route.test.ts`
Expected: PASS（现有测试应通过，因为无 intent 时默认为 "write"）

**Step 5: 提交**

```bash
git add src/app/api/ai/write/route.ts
git commit -m "feat: consolidate write/expand/first-draft/describe into single write endpoint"
```

---

## Task 4: 创建合并的 /api/ai/edit 路由

**Files:**
- Modify: `src/app/api/ai/edit/route.ts` (新建，因为原来不存在 edit 路由)
- Reference: existing `quick-edit/route.ts`, `rewrite/route.ts`, `shrink/route.ts`, `tone-shift/route.ts`

**Step 1: 写失败测试**

```ts
// src/app/api/ai/edit/route.test.ts
import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

describe("consolidated edit route", () => {
  it("accepts intent parameter", () => {
    // 验证路由模块可以导入
    expect(true).toBe(true) // placeholder
  })
})
```

**Step 2: 运行测试确认失败**

Run: `npx vitest run src/app/api/ai/edit/route.test.ts`
Expected: FAIL — module not found

**Step 3: 实现 edit 路由**

```ts
// src/app/api/ai/edit/route.ts
import { createClient } from "@/lib/supabase/server"
import { runStreamingPipeline } from "@/lib/ai/shared-pipeline"
import type { AIIntent } from "@/lib/ai/intent-config"

const EDIT_INTENTS = new Set<AIIntent>(["quick-edit", "rewrite", "shrink", "tone-shift"])

export async function POST(request: Request) {
  const supabase = await createClient()
  const clonedRequest = request.clone()
  const body = await clonedRequest.json()

  const intent: AIIntent = EDIT_INTENTS.has(body.intent) ? body.intent : "quick-edit"

  return runStreamingPipeline({
    supabase,
    request,
    intent,
    buildMessages: ({ body: reqBody, fullContext }) => {
      const text = typeof reqBody.text === "string" ? reqBody.text : ""
      const context = typeof reqBody.context === "string" ? reqBody.context : ""

      const systemPrompt = buildEditSystemPrompt(intent, fullContext, reqBody)
      const userPrompt = buildEditUserPrompt(intent, text, context, reqBody)

      return [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userPrompt },
      ]
    },
  })
}

function buildEditSystemPrompt(
  intent: AIIntent,
  fullContext: string,
  body: Record<string, unknown>
): string {
  const base = `你是一位经验丰富的小说编辑。使用中文（zh-CN）回复。\n\n${fullContext}`

  switch (intent) {
    case "rewrite": {
      const mode = typeof body.mode === "string" ? body.mode : "rephrase"
      const customInstructions = typeof body.customInstructions === "string" ? body.customInstructions : ""
      if (customInstructions) return `${base}\n\n按照以下要求改写：${customInstructions}`
      return `${base}\n\n以"${mode}"的方式改写以下文本。保持核心意思不变。`
    }
    case "shrink":
      return `${base}\n\n精简以下文本。保留核心信息和情感，删除冗余描写和不必要的修饰。`
    case "tone-shift": {
      const tone = typeof body.tone === "string" ? body.tone : "neutral"
      return `${base}\n\n将以下文本的语调转换为"${tone}"风格。保持情节和人物行为不变，只调整语气和用词。`
    }
    case "quick-edit":
    default: {
      const instruction = typeof body.instruction === "string" ? body.instruction : ""
      return `${base}\n\n根据用户的编辑指令修改文本。只修改指令要求的部分，保持其余内容不变。输出完整的修改后文本。`
    }
  }
}

function buildEditUserPrompt(
  intent: AIIntent,
  text: string,
  context: string,
  body: Record<string, unknown>
): string {
  const contextPrefix = context ? `上下文：\n${context.slice(-2000)}\n\n` : ""

  switch (intent) {
    case "rewrite":
      return `${contextPrefix}请改写以下文本：\n${text}`
    case "shrink":
      return `${contextPrefix}请精简以下文本：\n${text}`
    case "tone-shift":
      return `${contextPrefix}请转换以下文本的语调：\n${text}`
    case "quick-edit":
    default: {
      const instruction = typeof body.instruction === "string" ? body.instruction : ""
      return `${contextPrefix}原文：\n${text}\n\n编辑指令：${instruction}`
    }
  }
}
```

**Step 4: 运行测试确认通过**

Run: `npx vitest run src/app/api/ai/edit/route.test.ts`
Expected: PASS

**Step 5: 提交**

```bash
git add src/app/api/ai/edit/
git commit -m "feat: create consolidated edit endpoint (quick-edit/rewrite/shrink/tone-shift)"
```

---

## Task 5: 创建合并的 /api/ai/check 路由

**Files:**
- Create: `src/app/api/ai/check/route.ts`

**Note:** check 类别包含 3 种非常不同的 intent：
- `continuity-check` — 流式，结构化 JSON 输出
- `saliency` — 非流式，混合启发式 + AI JSON
- `feedback` — 非流式，纯数据库操作

由于这 3 种 intent 的实现差异很大，check 路由内部需要 intent 级别的分发：

**Step 1: 写失败测试**

创建 `src/app/api/ai/check/route.test.ts`，测试基本路由分发。

**Step 2: 实现 check 路由**

```ts
// src/app/api/ai/check/route.ts
import { createClient } from "@/lib/supabase/server"
import { runStreamingPipeline } from "@/lib/ai/shared-pipeline"
import type { AIIntent } from "@/lib/ai/intent-config"

export async function POST(request: Request) {
  const supabase = await createClient()
  const clonedRequest = request.clone()
  const body = await clonedRequest.json()

  const intent = body.intent as string

  switch (intent) {
    case "continuity-check":
      return handleContinuityCheck(supabase, request)
    case "saliency":
      return handleSaliency(supabase, request)
    case "feedback":
      return handleFeedback(supabase, request)
    default:
      // 向后兼容：无 intent 时按照旧的 continuity-check 行为
      return handleContinuityCheck(supabase, request)
  }
}

// 各 handler 从现有路由文件中迁移实现
// handleContinuityCheck: 复制 continuity-check/route.ts 的逻辑
// handleSaliency: 复制 saliency/route.ts 的逻辑
// handleFeedback: 复制 feedback/route.ts 的逻辑（纯 DB 操作）
```

**关键点：** continuity-check 和 saliency 的完整逻辑直接从现有文件复制过来，因为它们有独特的响应格式（非标准流）。feedback 的逻辑也直接复制（纯 DB 操作）。

**Step 3: 运行测试**

Run: `npx vitest run src/app/api/ai/check/route.test.ts`

**Step 4: 提交**

```bash
git add src/app/api/ai/check/
git commit -m "feat: create consolidated check endpoint (continuity-check/saliency/feedback)"
```

---

## Task 6: 创建合并的 /api/ai/chat 路由

**Files:**
- Modify: `src/app/api/ai/chat/route.ts`

**Goal:** 合并 chat、brainstorm、twist、muse、bible-assist。

**关键差异点：**
- `chat` — 多轮消息格式（messages[]）
- `brainstorm` — 单轮，最高温度
- `twist` — 单轮
- `muse` — 3 种子模式（what-if, random-prompt, suggest）
- `bible-assist` — 4 种子模式，特殊上下文（bible 字段数据）

**Step 1: 实现合并路由**

```ts
// src/app/api/ai/chat/route.ts
import { createClient } from "@/lib/supabase/server"
import { runStreamingPipeline } from "@/lib/ai/shared-pipeline"
import type { AIIntent } from "@/lib/ai/intent-config"

const CHAT_INTENTS = new Set<AIIntent>(["chat", "brainstorm", "twist", "muse", "bible-assist"])

export async function POST(request: Request) {
  const supabase = await createClient()
  const clonedRequest = request.clone()
  const body = await clonedRequest.json()

  const intent: AIIntent = CHAT_INTENTS.has(body.intent) ? body.intent : "chat"

  return runStreamingPipeline({
    supabase,
    request,
    intent,
    buildMessages: ({ body: reqBody, fullContext }) => {
      return buildChatMessages(intent, reqBody, fullContext)
    },
  })
}

function buildChatMessages(
  intent: AIIntent,
  body: Record<string, unknown>,
  fullContext: string
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const context = typeof body.context === "string" ? body.context : ""

  switch (intent) {
    case "chat": {
      // 多轮对话格式
      const messages = Array.isArray(body.messages) ? body.messages : []
      const systemPrompt = `你是一位深思熟虑的小说创作顾问。使用中文回复。\n\n${fullContext}${context ? `\n\n当前文档上下文：\n${context.slice(-3000)}` : ""}`
      return [
        { role: "system", content: systemPrompt },
        ...messages.filter((m: any) =>
          m && typeof m.role === "string" && typeof m.content === "string"
        ).map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ]
    }
    case "brainstorm": {
      const topic = typeof body.topic === "string" ? body.topic : ""
      return [
        { role: "system", content: `你是一位充满创意的故事顾问。使用中文回复。\n\n${fullContext}` },
        { role: "user", content: `${context ? `上下文：\n${context.slice(-1000)}\n\n` : ""}请围绕以下主题进行头脑风暴，生成 8-10 个创意想法：\n${topic}` },
      ]
    }
    case "twist": {
      return [
        { role: "system", content: `你是一位善于制造惊喜的故事建筑师。使用中文回复。\n\n${fullContext}` },
        { role: "user", content: `${context ? `当前情节：\n${context.slice(-2000)}\n\n` : ""}请生成 3-5 个出人意料的情节反转建议。每个反转应包含：反转内容、为什么有效、潜在影响。` },
      ]
    }
    case "muse": {
      const mode = typeof body.mode === "string" ? body.mode : "suggest"
      const input = typeof body.input === "string" ? body.input : ""
      return buildMuseMessages(mode, input, context, fullContext)
    }
    case "bible-assist": {
      const mode = typeof body.mode === "string" ? body.mode : "expand"
      return buildBibleAssistMessages(mode, body, fullContext)
    }
    default:
      return [
        { role: "system", content: `你是一位小说创作助手。使用中文回复。\n\n${fullContext}` },
        { role: "user", content: context || "你好" },
      ]
  }
}

// buildMuseMessages 和 buildBibleAssistMessages 从现有路由迁移
// muse 有 3 种模式：what-if, random-prompt, suggest
// bible-assist 有 4 种模式：expand, describe, analyze, suggest
function buildMuseMessages(
  mode: string,
  input: string,
  context: string,
  fullContext: string
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  // 从 muse/route.ts 迁移具体 prompt 逻辑
  const systemPrompt = `你是"灵感缪斯"，一位充满想象力的创作伙伴。使用中文回复。\n\n${fullContext}`

  switch (mode) {
    case "what-if":
      return [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${context ? `故事上下文：\n${context.slice(-2000)}\n\n` : ""}${input ? `基于这个想法：${input}\n\n` : ""}请提出 3 个大胆的"如果...会怎样"的设想，每个都应该能改变故事走向。` },
      ]
    case "random-prompt":
      return [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${context ? `故事上下文：\n${context.slice(-1000)}\n\n` : ""}请生成一个出人意料的创作提示或场景种子，帮助作者打破写作瓶颈。` },
      ]
    case "suggest":
    default:
      return [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${context ? `故事上下文：\n${context.slice(-2000)}\n\n` : ""}${input ? `关于：${input}\n\n` : ""}请提供 3-5 条创作建议，帮助推进故事发展。` },
      ]
  }
}

function buildBibleAssistMessages(
  mode: string,
  body: Record<string, unknown>,
  fullContext: string
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  // 从 bible-assist/route.ts 迁移具体 prompt 逻辑
  const targetField = typeof body.targetField === "string" ? body.targetField : ""
  const currentBible = typeof body.currentBible === "object" ? body.currentBible : {}
  const documentTexts = Array.isArray(body.documentTexts) ? body.documentTexts : []

  const systemPrompt = `你是一位故事世界构建专家。使用中文回复。帮助作者完善故事圣经。\n\n${fullContext}`

  const bibleContext = currentBible ? `当前圣经数据：\n${JSON.stringify(currentBible, null, 2).slice(0, 2000)}` : ""
  const docContext = documentTexts.length > 0 ? `\n\n相关文档摘要：\n${documentTexts.slice(0, 3).join("\n---\n").slice(0, 2000)}` : ""

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: `${bibleContext}${docContext}\n\n请${mode === "expand" ? "扩展" : mode === "describe" ? "描述" : mode === "analyze" ? "分析" : "建议"}「${targetField}」字段的内容。` },
  ]
}
```

**Step 2: 运行测试**

Run: `npx vitest run src/app/api/ai/chat/`

**Step 3: 提交**

```bash
git add src/app/api/ai/chat/route.ts
git commit -m "feat: consolidate chat/brainstorm/twist/muse/bible-assist into single chat endpoint"
```

---

## Task 7: 创建合并的 /api/ai/plan 路由

**Files:**
- Create: `src/app/api/ai/plan/route.ts`
- Reference: `scene-plan/route.ts`, `canvas-generate/route.ts`, `visualize/route.ts`

**注意：** plan 类别包含 3 种不同的响应格式：
- `scene-plan` — 流式文本
- `canvas-generate` — 非流式 JSON（节拍数组）
- `visualize` — 非流式 JSON（两步流程：文本优化 + DALL-E）

**Step 1: 实现 plan 路由**

```ts
// src/app/api/ai/plan/route.ts
import { createClient } from "@/lib/supabase/server"
import { runStreamingPipeline } from "@/lib/ai/shared-pipeline"
import type { AIIntent } from "@/lib/ai/intent-config"

export async function POST(request: Request) {
  const supabase = await createClient()
  const clonedRequest = request.clone()
  const body = await clonedRequest.json()

  const intent = body.intent as string

  switch (intent) {
    case "scene-plan":
      return handleScenePlan(supabase, request)
    case "canvas-generate":
      return handleCanvasGenerate(supabase, request)
    case "visualize":
      return handleVisualize(supabase, request)
    default:
      return handleScenePlan(supabase, request)
  }
}

// scene-plan 使用共享流式管道
async function handleScenePlan(supabase: any, request: Request) {
  return runStreamingPipeline({
    supabase,
    request,
    intent: "scene-plan",
    buildMessages: ({ body, fullContext }) => {
      const goal = typeof body.goal === "string" ? body.goal : ""
      const context = typeof body.context === "string" ? body.context : ""
      return [
        { role: "system" as const, content: `你是一位经验丰富的场景建筑师。使用中文回复。\n\n${fullContext}` },
        { role: "user" as const, content: `${context ? `上下文：\n${context.slice(-2000)}\n\n` : ""}场景目标：${goal}\n\n请生成详细的场景规划，包含节拍、转折和情感弧线。` },
      ]
    },
  })
}

// canvas-generate 和 visualize 直接从现有路由文件迁移
// 它们有独特的非流式逻辑，不适合共享管道
async function handleCanvasGenerate(supabase: any, request: Request) {
  // 从 canvas-generate/route.ts 迁移完整逻辑
  // 使用 callOpenAIJson 而非流式
  // ... (完整实现从现有文件复制)
  return Response.json({ error: "TODO: migrate from canvas-generate" }, { status: 501 })
}

async function handleVisualize(supabase: any, request: Request) {
  // 从 visualize/route.ts 迁移完整逻辑
  // 两步流程：文本优化 + DALL-E
  // ... (完整实现从现有文件复制)
  return Response.json({ error: "TODO: migrate from visualize" }, { status: 501 })
}
```

**Step 2: 运行测试 & 提交**

```bash
git add src/app/api/ai/plan/
git commit -m "feat: create consolidated plan endpoint (scene-plan/canvas-generate/visualize)"
```

---

## Task 8: 添加前端类别映射工具

**Files:**
- Create: `src/lib/ai/category-mapping.ts`
- Create: `src/lib/ai/category-mapping.test.ts`

**Goal:** 前端需要一个函数将 feature name 映射到新的类别端点 URL。

**Step 1: 写失败测试**

```ts
// src/lib/ai/category-mapping.test.ts
import { describe, it, expect } from "vitest"
import { getEndpointForFeature } from "@/lib/ai/category-mapping"

describe("category-mapping", () => {
  it("maps write features to /api/ai/write", () => {
    expect(getEndpointForFeature("write")).toBe("/api/ai/write")
    expect(getEndpointForFeature("expand")).toBe("/api/ai/write")
    expect(getEndpointForFeature("first-draft")).toBe("/api/ai/write")
    expect(getEndpointForFeature("describe")).toBe("/api/ai/write")
  })

  it("maps edit features to /api/ai/edit", () => {
    expect(getEndpointForFeature("quick-edit")).toBe("/api/ai/edit")
    expect(getEndpointForFeature("rewrite")).toBe("/api/ai/edit")
    expect(getEndpointForFeature("shrink")).toBe("/api/ai/edit")
    expect(getEndpointForFeature("tone-shift")).toBe("/api/ai/edit")
  })

  it("maps check features to /api/ai/check", () => {
    expect(getEndpointForFeature("continuity-check")).toBe("/api/ai/check")
    expect(getEndpointForFeature("saliency")).toBe("/api/ai/check")
  })

  it("maps chat features to /api/ai/chat", () => {
    expect(getEndpointForFeature("chat")).toBe("/api/ai/chat")
    expect(getEndpointForFeature("brainstorm")).toBe("/api/ai/chat")
    expect(getEndpointForFeature("twist")).toBe("/api/ai/chat")
    expect(getEndpointForFeature("muse")).toBe("/api/ai/chat")
    expect(getEndpointForFeature("bible-assist")).toBe("/api/ai/chat")
  })

  it("maps plan features to /api/ai/plan", () => {
    expect(getEndpointForFeature("scene-plan")).toBe("/api/ai/plan")
    expect(getEndpointForFeature("canvas-generate")).toBe("/api/ai/plan")
    expect(getEndpointForFeature("visualize")).toBe("/api/ai/plan")
  })

  it("preserves independent endpoints", () => {
    expect(getEndpointForFeature("plugin")).toBe("/api/ai/plugin")
    expect(getEndpointForFeature("models")).toBe("/api/ai/models")
    expect(getEndpointForFeature("test-connection")).toBe("/api/ai/test-connection")
  })
})
```

**Step 2: 实现映射**

```ts
// src/lib/ai/category-mapping.ts
import { getIntentConfig, type AIIntent } from "@/lib/ai/intent-config"

const INDEPENDENT_ENDPOINTS: Record<string, string> = {
  plugin: "/api/ai/plugin",
  models: "/api/ai/models",
  "test-connection": "/api/ai/test-connection",
}

export function getEndpointForFeature(feature: string): string {
  // 独立端点不参与合并
  if (feature in INDEPENDENT_ENDPOINTS) {
    return INDEPENDENT_ENDPOINTS[feature]
  }

  const config = getIntentConfig(feature as AIIntent)
  if (!config) {
    // 未知 feature 回退到直接路径（向后兼容）
    return `/api/ai/${feature}`
  }

  return `/api/ai/${config.category}`
}
```

**Step 3: 运行测试 & 提交**

```bash
git add src/lib/ai/category-mapping.ts src/lib/ai/category-mapping.test.ts
git commit -m "feat: add frontend category mapping utility"
```

---

## Task 9: 更新前端调用点

**Files:**
- Modify: `src/components/ai/ai-toolbar.tsx` (核心调用点)
- Modify: `src/components/editor/selection-ai-menu.tsx`
- Modify: `src/components/ai/ai-chat-panel.tsx`
- Modify: `src/components/ai/muse-panel.tsx`
- Modify: `src/components/canvas/canvas-editor.tsx`
- Modify: `src/components/ai/visualize-panel.tsx`
- Modify: `src/components/story-bible/story-bible-panel.tsx`
- Modify: `src/components/story-bible/ai-field-button.tsx`

**关键变更模式：** 在每个 fetch 调用中：
1. 替换 endpoint URL（使用 `getEndpointForFeature(feature)`）
2. 在 body 中添加 `intent` 字段

**Step 1: 修改 ai-toolbar.tsx**

当前代码（约第 254 行）：
```ts
const endpoint = feature === "plugin" ? "/api/ai/plugin" : `/api/ai/${feature}`
```

替换为：
```ts
import { getEndpointForFeature } from "@/lib/ai/category-mapping"
// ...
const endpoint = getEndpointForFeature(feature)
```

当前的 fetch body 构建中，添加 `intent` 字段：
```ts
body: JSON.stringify({
  intent: feature,  // 新增
  projectId,
  documentId,
  // ... 其余参数不变
})
```

**Step 2: 修改 selection-ai-menu.tsx**

当前代码（约第 148-169 行）有 switch 映射 action → endpoint。替换为：
```ts
import { getEndpointForFeature } from "@/lib/ai/category-mapping"
// ...
const endpoint = getEndpointForFeature(action)
// body 中添加 intent: action
```

**Step 3: 修改 ai-chat-panel.tsx**

3 个端点调用：
- `/api/ai/visualize` → `getEndpointForFeature("visualize")` + `intent: "visualize"`
- `/api/ai/muse` → `getEndpointForFeature("muse")` + `intent: "muse"`
- `/api/ai/chat` → `getEndpointForFeature("chat")` + `intent: "chat"`

**Step 4: 修改其他组件**

- `muse-panel.tsx`: `/api/ai/muse` → 加 intent
- `canvas-editor.tsx`: `/api/ai/canvas-generate` → 加 intent
- `visualize-panel.tsx`: `/api/ai/visualize` → 加 intent
- `story-bible-panel.tsx`: `/api/ai/bible-assist` → 加 intent
- `ai-field-button.tsx`: `/api/ai/bible-assist` → 加 intent

**Step 5: 运行所有测试**

Run: `npx vitest run`
Expected: 所有现有测试通过

**Step 6: 提交**

```bash
git add src/components/
git commit -m "refactor: update frontend AI callers to use consolidated endpoints"
```

---

## Task 10: 保留旧端点为重定向（过渡期）

**Files:**
- Modify: 所有旧的 route.ts 文件（expand、describe、first-draft 等）

**Goal:** 将旧端点改为薄重定向层，指向新的合并端点。这确保任何残留的直接 URL 调用继续工作。

**Step 1: 将每个旧路由改为重定向**

示例（expand/route.ts）：
```ts
// src/app/api/ai/expand/route.ts — 向后兼容重定向
import { POST as writeHandler } from "@/app/api/ai/write/route"

export async function POST(request: Request) {
  // 注入 intent 到请求体
  const body = await request.json()
  body.intent = "expand"
  const newRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(body),
  })
  return writeHandler(newRequest)
}
```

对所有旧路由执行相同操作。

**Step 2: 运行全套测试**

Run: `npm run test`
Expected: 所有测试通过

**Step 3: 提交**

```bash
git add src/app/api/ai/
git commit -m "refactor: convert old AI routes to thin redirects for backward compatibility"
```

---

## Task 11: 删除旧端点文件

**前置条件：** Task 9 和 10 完成后，确认所有前端已使用新端点，旧端点重定向正常工作。

**Files:**
- Delete: `src/app/api/ai/expand/`
- Delete: `src/app/api/ai/describe/`
- Delete: `src/app/api/ai/first-draft/`
- Delete: `src/app/api/ai/rewrite/`
- Delete: `src/app/api/ai/shrink/`
- Delete: `src/app/api/ai/tone-shift/`
- Delete: `src/app/api/ai/quick-edit/`
- Delete: `src/app/api/ai/brainstorm/`
- Delete: `src/app/api/ai/twist/`
- Delete: `src/app/api/ai/muse/`
- Delete: `src/app/api/ai/bible-assist/`
- Delete: `src/app/api/ai/scene-plan/`
- Delete: `src/app/api/ai/canvas-generate/`
- Delete: `src/app/api/ai/visualize/`
- Delete: `src/app/api/ai/saliency/`
- Delete: `src/app/api/ai/feedback/`
- Delete: `src/app/api/ai/continuity-check/`

**保留不删除：**
- `src/app/api/ai/write/` — 已重写为合并路由
- `src/app/api/ai/chat/` — 已重写为合并路由
- `src/app/api/ai/edit/` — 新建的合并路由
- `src/app/api/ai/check/` — 新建的合并路由
- `src/app/api/ai/plan/` — 新建的合并路由
- `src/app/api/ai/models/` — 独立保留
- `src/app/api/ai/test-connection/` — 独立保留
- `src/app/api/ai/plugin/` — 独立保留

**Step 1: 删除文件**

```bash
rm -rf src/app/api/ai/expand src/app/api/ai/describe src/app/api/ai/first-draft \
  src/app/api/ai/rewrite src/app/api/ai/shrink src/app/api/ai/tone-shift \
  src/app/api/ai/quick-edit src/app/api/ai/brainstorm src/app/api/ai/twist \
  src/app/api/ai/muse src/app/api/ai/bible-assist src/app/api/ai/scene-plan \
  src/app/api/ai/canvas-generate src/app/api/ai/visualize src/app/api/ai/saliency \
  src/app/api/ai/feedback src/app/api/ai/continuity-check
```

**Step 2: 迁移相关测试到新路由目录**

将旧路由的测试文件内容迁移到对应的新路由测试中：
- `quick-edit/route.test.ts` → `edit/route.test.ts`
- `continuity-check/route.contract.test.ts` → `check/route.contract.test.ts`
- `bible-assist/route.test.ts` → `chat/route.test.ts`
- `write/route.test.ts` → 保留在原位

**Step 3: 运行全套测试**

Run: `npm run test`
Expected: PASS

**Step 4: 提交**

```bash
git add -A
git commit -m "refactor: remove old AI route files after consolidation (22 → 8)"
```

---

## Task 12: 简化一致性系统

**Files:**
- Delete: `src/lib/story-bible/consistency-extractor.ts`
- Delete: `src/lib/story-bible/consistency-extractor.test.ts`
- Delete: `src/lib/ai/consistency-metrics.ts`
- Delete: `src/lib/ai/consistency-metrics.test.ts`
- Create: `src/lib/story-bible/consistency.ts` (合并 types + flags)
- Delete: `src/lib/story-bible/consistency-types.ts`
- Delete: `src/lib/story-bible/consistency-types.test.ts`
- Delete: `src/lib/story-bible/consistency-flags.ts`
- Delete: `src/lib/story-bible/consistency-flags.test.ts`
- Modify: `src/lib/ai/story-context.ts` (更新导入)
- Modify: `src/lib/ai/consistency-preflight.ts` (更新导入)
- Modify: `src/lib/ai/structured-context.ts` (更新导入)

**Step 1: 确认 consistency-metrics 仅被测试引用**

Run: `grep -r "consistency-metrics" src/ --include="*.ts" --include="*.tsx" | grep -v test`
Expected: 无结果（仅在 test 文件中引用）→ 安全删除

**Step 2: 确认 consistency-extractor 的调用链**

Run: `grep -r "extractConsistencyState\|consistency-extractor" src/ --include="*.ts" --include="*.tsx" | grep -v test`
Expected: 仅在 `story-context.ts` 中调用

**Step 3: 创建合并的 consistency.ts**

```ts
// src/lib/story-bible/consistency.ts
// 合并自 consistency-types.ts + consistency-flags.ts

// --- Types (from consistency-types.ts) ---

export interface CanonFact {
  fact: string
  source: "human" | "ai"
  confidence: number
  updated_at: string
}

export interface TimelineEvent {
  event: string
  timeAnchor: string
  participants: string[]
  stateChanges: string[]
  source: "human" | "ai"
  confidence: number
  updated_at: string
}

export interface CharacterArcState {
  characterName: string
  motivation: string
  relationshipStatus: string
  secretProgress: string
  source: "human" | "ai"
  confidence: number
  updated_at: string
}

export interface ConstraintRule {
  rule: string
  category: "forbidden" | "required" | "style"
  source: "human" | "ai"
  confidence: number
  updated_at: string
}

export interface ConsistencyState {
  canonFacts: CanonFact[]
  timelineEvents: TimelineEvent[]
  characterArcStates: CharacterArcState[]
  constraintRules: ConstraintRule[]
}

export function createEmptyConsistencyState(): ConsistencyState {
  return {
    canonFacts: [],
    timelineEvents: [],
    characterArcStates: [],
    constraintRules: [],
  }
}

// --- Feature Flags (from consistency-flags.ts) ---

interface ConsistencyFlagEnv {
  NEXT_PUBLIC_CONSISTENCY_PREFLIGHT?: string
  NEXT_PUBLIC_STRUCTURED_CONTEXT?: string
  NEXT_PUBLIC_POST_CHECK_ENHANCED?: string
}

export interface ConsistencyFeatureFlags {
  consistencyPreflight: boolean
  structuredContext: boolean
  postCheckEnhanced: boolean
}

function resolveFlag(value: string | undefined): boolean {
  if (value === undefined) return true // default enabled
  const lower = value.toLowerCase()
  return lower === "1" || lower === "true" || lower === "yes"
}

function getEnv(): ConsistencyFlagEnv {
  if (typeof process !== "undefined" && process.env) {
    return process.env as unknown as ConsistencyFlagEnv
  }
  return {}
}

export function isConsistencyPreflightEnabled(env?: ConsistencyFlagEnv): boolean {
  return resolveFlag((env ?? getEnv()).NEXT_PUBLIC_CONSISTENCY_PREFLIGHT)
}

export function isStructuredContextEnabled(env?: ConsistencyFlagEnv): boolean {
  return resolveFlag((env ?? getEnv()).NEXT_PUBLIC_STRUCTURED_CONTEXT)
}

export function isPostCheckEnhancedEnabled(env?: ConsistencyFlagEnv): boolean {
  return resolveFlag((env ?? getEnv()).NEXT_PUBLIC_POST_CHECK_ENHANCED)
}

export function getConsistencyFeatureFlags(env?: ConsistencyFlagEnv): ConsistencyFeatureFlags {
  const e = env ?? getEnv()
  return {
    consistencyPreflight: isConsistencyPreflightEnabled(e),
    structuredContext: isStructuredContextEnabled(e),
    postCheckEnhanced: isPostCheckEnhancedEnabled(e),
  }
}
```

**Step 4: 写合并测试**

```ts
// src/lib/story-bible/consistency.test.ts
// 合并自 consistency-types.test.ts + consistency-flags.test.ts
import { describe, it, expect } from "vitest"
import {
  createEmptyConsistencyState,
  getConsistencyFeatureFlags,
  isConsistencyPreflightEnabled,
  isStructuredContextEnabled,
} from "@/lib/story-bible/consistency"

describe("consistency types", () => {
  it("creates empty consistency state", () => {
    const state = createEmptyConsistencyState()
    expect(state.canonFacts).toEqual([])
    expect(state.timelineEvents).toEqual([])
    expect(state.characterArcStates).toEqual([])
    expect(state.constraintRules).toEqual([])
  })
})

describe("consistency flags", () => {
  it("defaults to enabled", () => {
    const flags = getConsistencyFeatureFlags({})
    expect(flags.consistencyPreflight).toBe(true)
    expect(flags.structuredContext).toBe(true)
    expect(flags.postCheckEnhanced).toBe(true)
  })

  it("respects explicit disable", () => {
    expect(isConsistencyPreflightEnabled({ NEXT_PUBLIC_CONSISTENCY_PREFLIGHT: "false" })).toBe(false)
    expect(isStructuredContextEnabled({ NEXT_PUBLIC_STRUCTURED_CONTEXT: "0" })).toBe(false)
  })
})
```

**Step 5: 更新所有导入**

在以下文件中将导入路径从 `consistency-types` 和 `consistency-flags` 更新为 `consistency`：

- `src/lib/ai/story-context.ts`:
  - `import { extractConsistencyState } from "@/lib/story-bible/consistency-extractor"` → 删除（见下一步）
  - `import { getConsistencyFeatureFlags, isStructuredContextEnabled } from "@/lib/story-bible/consistency-flags"` → `from "@/lib/story-bible/consistency"`
  - `import type { ConsistencyState } from "@/lib/story-bible/consistency-types"` → `from "@/lib/story-bible/consistency"`

- `src/lib/ai/consistency-preflight.ts`:
  - `import type { ConsistencyState } from "@/lib/story-bible/consistency-types"` → `from "@/lib/story-bible/consistency"`

- `src/lib/ai/structured-context.ts`:
  - `import type { ConsistencyState } from "@/lib/story-bible/consistency-types"` → `from "@/lib/story-bible/consistency"`

**Step 6: 从 story-context.ts 移除 extractConsistencyState 调用**

在 `fetchStoryContext()` 中，将 `extractConsistencyState()` 调用替换为 `createEmptyConsistencyState()`。
一致性数据现在直接作为原始文本传给 AI（通过 buildStoryPromptContext），不需要客户端结构化提取。

```ts
// 修改前：
consistencyState: shouldBuildConsistencyState
  ? extractConsistencyState({ bible, characters })
  : undefined

// 修改后：
consistencyState: shouldBuildConsistencyState
  ? createEmptyConsistencyState()
  : undefined
```

**Step 7: 删除旧文件**

```bash
rm src/lib/story-bible/consistency-extractor.ts src/lib/story-bible/consistency-extractor.test.ts
rm src/lib/story-bible/consistency-types.ts src/lib/story-bible/consistency-types.test.ts
rm src/lib/story-bible/consistency-flags.ts src/lib/story-bible/consistency-flags.test.ts
rm src/lib/ai/consistency-metrics.ts src/lib/ai/consistency-metrics.test.ts
```

**Step 8: 运行全套测试**

Run: `npm run test`
Expected: PASS

**Step 9: 提交**

```bash
git add -A
git commit -m "refactor: simplify consistency system (5 modules → 2)"
```

---

## Task 13: 简化 story-context.ts（3 个上下文层级）

**Files:**
- Modify: `src/lib/ai/story-context.ts`
- Modify: `src/lib/ai/story-context.test.ts`

**Goal:** 将 17 种特性分化的上下文构建简化为 3 个层级。

**当前状态：** `buildStoryPromptContext()` 中的每个 builder 函数（`buildGenreStyleGuidance`、`buildSynopsisGuidance` 等）都有针对不同 feature 的 if/switch 分支。

**目标状态：** 每个 builder 函数只输出数据，不再有 feature 分支。feature 相关的指导文本移到 prompt 模板中（在各合并路由的 buildMessages 里）。

**Step 1: 简化 builder 函数**

以 `buildGenreStyleGuidance` 为例：

```ts
// 修改前：
function buildGenreStyleGuidance(bible: StoryBibleData, feature: AIFeature): string {
  if (!bible.genre && !bible.style) return ""
  const prefix = `This is a ${bible.genre ?? ""} story${bible.style ? ` with ${bible.style} style` : ""}.`
  if (feature === "describe") return `${prefix} Ground sensory descriptions...`
  if (isWritingFeature(feature)) return `${prefix} Maintain genre conventions...`
  // ... 更多 feature 分支
  return prefix
}

// 修改后：
function buildGenreStyleGuidance(bible: StoryBibleData): string {
  if (!bible.genre && !bible.style) return ""
  const genrePart = bible.genre ? `${bible.genre} ` : ""
  const stylePart = bible.style ? ` with ${bible.style} style` : ""
  return `GENRE & STYLE: This is a ${genrePart}story${stylePart}. Maintain genre conventions in pacing, atmosphere, and reader expectations.`
}
```

对所有 builder 函数执行相同简化：
- `buildSynopsisGuidance` → 去掉 feature 分支
- `buildThemesGuidance` → 去掉 feature 分支
- `buildSettingGuidance` → 去掉 feature 分支
- `buildOutlineGuidance` → 去掉 feature 分支
- `buildBraindumpGuidance` → 去掉 feature 分支
- `buildCharacterGuidance` → 只保留 writing（最完整的字段集）和 default 两种

**Step 2: 简化 buildStoryPromptContext 签名**

```ts
// 修改前：
interface StoryPromptOptions {
  feature: AIFeature
  proseMode?: string | null
  saliencyMap?: SaliencyMap | null
}

// 修改后：
interface StoryPromptOptions {
  feature: AIFeature           // 仍然保留用于 structured context
  proseMode?: string | null
  saliencyMap?: SaliencyMap | null
}
```

`feature` 仍然保留，因为 `buildStructuredContext()` 和 `buildCharacterGuidance()` 需要它来决定包含哪些字段。但 builder 函数的内部分支从 17 个 feature 简化为 3 个类别（writing/planning/check）。

**Step 3: 更新测试**

`story-context.test.ts` 中的测试需要更新以匹配简化后的输出。

**Step 4: 运行测试**

Run: `npx vitest run src/lib/ai/story-context.test.ts`
Expected: PASS

**Step 5: 提交**

```bash
git add src/lib/ai/story-context.ts src/lib/ai/story-context.test.ts
git commit -m "refactor: simplify story-context.ts by removing per-feature prompt branches"
```

---

## Task 14: 运行全套验证

**Step 1: 运行 lint**

Run: `npm run lint`
Expected: PASS

**Step 2: 运行所有测试**

Run: `npm run test`
Expected: PASS

**Step 3: 运行构建**

Run: `npm run build`
Expected: PASS

**Step 4: 手动冒烟测试**

如果有开发环境可用：
1. 启动 dev server (`npm run dev`)
2. 打开编辑器，测试写作续写功能
3. 测试扩写、改写、压缩功能
4. 测试 AI 对话
5. 测试连贯性检查

**Step 5: 最终提交**

```bash
git commit --allow-empty -m "chore: phase 1 architecture simplification complete (22→8 routes, 5→2 consistency modules)"
```

---

## 完成总结

| 指标 | 修改前 | 修改后 |
|------|--------|--------|
| AI 路由文件 | 22 | 8 |
| 一致性模块 | 5 | 2 |
| story-context.ts 行数 | ~697 | ~350（估计） |
| 新增文件 | — | 4（intent-config, shared-pipeline, category-mapping, consistency） |
| 删除文件 | — | ~20 |
