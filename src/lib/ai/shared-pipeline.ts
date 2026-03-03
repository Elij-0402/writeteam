import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import type { ResolvedAIConfig } from "@/lib/ai/resolve-config"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import { runConsistencyPreflight } from "@/lib/ai/consistency-preflight"
import { getIntentConfig } from "@/lib/ai/intent-config"
import type { AIIntent } from "@/lib/ai/intent-config"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineInput {
  supabase: SupabaseClient
  request: Request
  intent: AIIntent
  buildMessages: (params: {
    body: Record<string, unknown>
    fullContext: string
  }) => Array<{ role: "system" | "user" | "assistant"; content: string }>
}

interface ValidateResult {
  error?: Response
  userId: string
  body: Record<string, unknown>
  aiConfig: ResolvedAIConfig
}

// ---------------------------------------------------------------------------
// validateAndResolve — auth + body parsing + AI config resolution
// ---------------------------------------------------------------------------

export async function validateAndResolve(
  supabase: SupabaseClient,
  request: Request,
): Promise<ValidateResult> {
  // 1. Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      error: Response.json({ error: "未登录" }, { status: 401 }),
      userId: "",
      body: {},
      aiConfig: { baseUrl: "", apiKey: "", modelId: "" },
    }
  }

  // 2. Parse request body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return {
      error: Response.json(
        { error: "请求参数格式错误，请刷新后重试" },
        { status: 400 },
      ),
      userId: user.id,
      body: {},
      aiConfig: { baseUrl: "", apiKey: "", modelId: "" },
    }
  }

  // 3. Validate projectId
  const rawProjectId = body.projectId
  const projectId =
    typeof rawProjectId === "string" && rawProjectId.trim().length > 0
      ? rawProjectId.trim()
      : null
  if (!projectId) {
    return {
      error: Response.json(
        { error: "缺少项目ID，请返回项目后重试" },
        { status: 400 },
      ),
      userId: user.id,
      body,
      aiConfig: { baseUrl: "", apiKey: "", modelId: "" },
    }
  }

  // 4. Resolve AI config from headers
  const aiConfig = resolveAIConfig(request as Parameters<typeof resolveAIConfig>[0])
  if (!aiConfig) {
    return {
      error: Response.json(
        { error: "AI 服务未配置，请先在设置中配置模型后重试" },
        { status: 400 },
      ),
      userId: user.id,
      body,
      aiConfig: { baseUrl: "", apiKey: "", modelId: "" },
    }
  }

  return { userId: user.id, body, aiConfig }
}

// ---------------------------------------------------------------------------
// runStreamingPipeline — full 5-step pipeline
// ---------------------------------------------------------------------------

export async function runStreamingPipeline(
  input: PipelineInput,
): Promise<Response> {
  const { supabase, request, intent, buildMessages } = input

  // Lookup intent configuration
  const intentConfig = getIntentConfig(intent)
  if (!intentConfig) {
    return Response.json(
      { error: `未知的 AI 意图: ${intent}` },
      { status: 400 },
    )
  }

  // Clone request so body can be consumed by both validateAndResolve and later logic
  const clonedRequest = request.clone()

  // Step 1-2: Auth + body parse + AI config
  const resolved = await validateAndResolve(supabase, clonedRequest)
  if (resolved.error) {
    return resolved.error
  }

  const { userId, body, aiConfig } = resolved
  const projectId = (body.projectId as string).trim()
  const documentId =
    typeof body.documentId === "string" && body.documentId.trim().length > 0
      ? body.documentId.trim()
      : null

  try {
    // Step 3: Fetch story context
    const storyCtx = await fetchStoryContext(supabase, projectId, userId)

    // Step 3.5: Consistency preflight (if enabled for this intent)
    if (intentConfig.consistencyPreflight) {
      const preflight = runConsistencyPreflight({
        text: JSON.stringify(body).slice(0, 3000),
        consistencyState: storyCtx.consistencyState,
      })
      if (preflight.shouldBlock) {
        return Response.json(
          {
            error: "检测到高风险设定冲突，请先修正后再试",
            errorType: "consistency_high_risk",
            severity: "high",
            violations: preflight.violations,
          },
          { status: 409 },
        )
      }
    }

    // Step 4: Build story prompt context
    const proseMode =
      typeof body.proseMode === "string" ? body.proseMode : null
    const saliency = body.saliency ?? null
    const { fullContext } = buildStoryPromptContext(storyCtx, {
      feature: intentConfig.feature,
      proseMode,
      saliencyMap: saliency as Parameters<typeof buildStoryPromptContext>[1]["saliencyMap"],
    })

    // Step 4.5: Let the caller build messages
    const messages = buildMessages({ body, fullContext })

    // Step 5: Build prompt log (truncated to 200 chars)
    const promptSummary = messages
      .map((m) => `[${m.role}] ${m.content}`)
      .join(" | ")
    const promptLog = promptSummary.slice(0, 200)

    // Extract retry metadata
    const retryMeta = extractRetryMeta(body)

    // Step 6: Create streaming response
    return await createOpenAIStreamResponse(
      {
        messages,
        maxTokens: intentConfig.maxTokens,
        temperature: intentConfig.temperature,
        ...aiConfig,
      },
      {
        supabase,
        userId,
        projectId,
        documentId,
        feature: intentConfig.feature,
        promptLog,
        ...retryMeta,
      },
    )
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
