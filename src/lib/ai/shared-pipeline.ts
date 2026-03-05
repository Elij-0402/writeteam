import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import type { ResolvedAIConfig } from "@/lib/ai/resolve-config"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import { runConsistencyPreflight } from "@/lib/ai/consistency-preflight"
import { getIntentConfig } from "@/lib/ai/intent-config"
import type { AIIntent } from "@/lib/ai/intent-config"
import { logger } from "@/lib/observability/logger"
import { createRequestId } from "@/lib/observability/request-id"

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

function errorResponse(
  error: string,
  code: string,
  requestId: string,
  status: number,
): Response {
  return Response.json({ error, code, requestId }, { status })
}

export async function validateAndResolve(
  supabase: SupabaseClient,
  request: Request,
  requestId: string = createRequestId(null),
): Promise<ValidateResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: errorResponse("未登录", "UNAUTHORIZED", requestId, 401),
      userId: "",
      body: {},
      aiConfig: { baseUrl: "", apiKey: "", modelId: "" },
    }
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return {
      error: errorResponse("请求参数格式错误，请刷新后重试", "INVALID_JSON", requestId, 400),
      userId: user.id,
      body: {},
      aiConfig: { baseUrl: "", apiKey: "", modelId: "" },
    }
  }

  const rawProjectId = body.projectId
  const projectId =
    typeof rawProjectId === "string" && rawProjectId.trim().length > 0
      ? rawProjectId.trim()
      : null

  if (!projectId) {
    return {
      error: errorResponse("缺少项目ID，请返回项目后重试", "MISSING_PROJECT_ID", requestId, 400),
      userId: user.id,
      body,
      aiConfig: { baseUrl: "", apiKey: "", modelId: "" },
    }
  }

  const aiConfig = resolveAIConfig(request as Parameters<typeof resolveAIConfig>[0])
  if (!aiConfig) {
    return {
      error: errorResponse("AI 服务未配置，请先在设置中配置模型后重试", "AI_CONFIG_MISSING", requestId, 400),
      userId: user.id,
      body,
      aiConfig: { baseUrl: "", apiKey: "", modelId: "" },
    }
  }

  return { userId: user.id, body, aiConfig }
}

export async function runStreamingPipeline(
  input: PipelineInput,
): Promise<Response> {
  const { supabase, request, intent, buildMessages } = input
  const requestId = createRequestId(request.headers.get("x-request-id"))

  const intentConfig = getIntentConfig(intent)
  if (!intentConfig) {
    return errorResponse(`未知 AI 意图: ${intent}`, "UNKNOWN_INTENT", requestId, 400)
  }

  const clonedRequest = request.clone()
  const resolved = await validateAndResolve(supabase, clonedRequest, requestId)
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
    const storyCtx = await fetchStoryContext(supabase, projectId, userId)

    if (intentConfig.consistencyPreflight) {
      const preflight = runConsistencyPreflight({
        text: JSON.stringify(body).slice(0, 3000),
        consistencyState: storyCtx.consistencyState,
      })

      if (preflight.shouldBlock) {
        return Response.json(
          {
            error: "检测到高风险设定冲突，请先修正后再试",
            code: "CONSISTENCY_HIGH_RISK",
            requestId,
            errorType: "consistency_high_risk",
            severity: "high",
            violations: preflight.violations,
          },
          { status: 409 },
        )
      }
    }

    const proseMode = typeof body.proseMode === "string" ? body.proseMode : null
    const saliency = body.saliency ?? null
    const { fullContext } = buildStoryPromptContext(storyCtx, {
      feature: intentConfig.feature,
      proseMode,
      saliencyMap: saliency as Parameters<typeof buildStoryPromptContext>[1]["saliencyMap"],
    })

    const messages = buildMessages({ body, fullContext })

    const promptSummary = messages
      .map((m) => `[${m.role}] ${m.content}`)
      .join(" | ")
    const promptLog = promptSummary.slice(0, 200)

    const retryMeta = extractRetryMeta(body)

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
    logger.error("runStreamingPipeline failed", {
      requestId,
      route: "/api/ai/*",
      feature: intentConfig.feature,
      userId,
      errorCode: "PIPELINE_INTERNAL_ERROR",
    })

    return errorResponse("服务器内部错误", "PIPELINE_INTERNAL_ERROR", requestId, 500)
  }
}
