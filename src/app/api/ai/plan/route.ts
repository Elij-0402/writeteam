import { createClient } from "@/lib/supabase/server"
import { runStreamingPipeline, validateAndResolve } from "@/lib/ai/shared-pipeline"
import { callOpenAIJson } from "@/lib/ai/openai-json"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import { createTextFingerprint, estimateTokenCount } from "@/lib/ai/telemetry"
import type { SupabaseClient } from "@supabase/supabase-js"

// ---------------------------------------------------------------------------
// Plan intent types
// ---------------------------------------------------------------------------

type PlanRouteIntent = "scene-plan" | "canvas-generate" | "visualize"

function isPlanRouteIntent(value: unknown): value is PlanRouteIntent {
  return (
    value === "scene-plan" ||
    value === "canvas-generate" ||
    value === "visualize"
  )
}

// ---------------------------------------------------------------------------
// Canvas-generate types & helpers
// ---------------------------------------------------------------------------

type CanvasBeat = {
  label: string
  content: string
  type: string
}

const ALLOWED_CANVAS_NODE_TYPES = new Set(["beat", "scene", "character", "location", "note"])

function cleanAIJson(content: string): string {
  return content.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim()
}

function normalizeBeat(rawBeat: unknown): CanvasBeat | null {
  if (!rawBeat || typeof rawBeat !== "object") {
    return null
  }

  const candidate = rawBeat as { label?: unknown; content?: unknown; type?: unknown }
  const label = typeof candidate.label === "string" ? candidate.label.trim() : ""
  const content = typeof candidate.content === "string" ? candidate.content.trim() : ""
  const rawType = typeof candidate.type === "string" ? candidate.type.trim() : ""
  const type = rawType && ALLOWED_CANVAS_NODE_TYPES.has(rawType) ? rawType : "beat"

  if (!label || !content) {
    return null
  }

  return {
    label: label.slice(0, 60),
    content: content.slice(0, 500),
    type,
  }
}

function parseBeats(content: string): { beats?: CanvasBeat[]; error?: string } {
  try {
    const parsed = JSON.parse(cleanAIJson(content)) as unknown
    if (!Array.isArray(parsed)) {
      return { error: "AI 返回格式错误：结果不是数组" }
    }

    const beats = parsed
      .map(normalizeBeat)
      .filter((beat): beat is CanvasBeat => beat !== null)

    if (beats.length === 0) {
      return { error: "AI 未生成可用节拍，请重试或调整大纲后再试" }
    }

    return { beats: beats.slice(0, 12) }
  } catch {
    return { error: "AI 返回格式错误，请重试" }
  }
}

// ---------------------------------------------------------------------------
// Visualize style prompts
// ---------------------------------------------------------------------------

const STYLE_PROMPTS: Record<string, string> = {
  realistic: "photorealistic, highly detailed, cinematic lighting",
  watercolor: "watercolor painting, soft washes, artistic, ethereal",
  anime: "anime art style, vibrant colors, detailed illustration",
  "oil-painting": "oil painting, rich textures, masterful brushstrokes, classical art",
  sketch: "pencil sketch, hand-drawn, detailed linework, artistic",
}

// ---------------------------------------------------------------------------
// Scene-plan message builder (used with runStreamingPipeline)
// ---------------------------------------------------------------------------

function buildScenePlanMessages(
  body: Record<string, unknown>,
  fullContext: string,
): Array<{ role: "system" | "user"; content: string }> {
  const goal = typeof body.goal === "string" ? body.goal.trim() : ""
  const context = typeof body.context === "string" ? body.context : ""

  let systemPrompt =
    "You are an expert fiction story architect. Break chapter goals into scene-by-scene plans. Ensure rising tension, cause-effect continuity, and clear scene purpose. Return only the plan."
  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `${context ? `Recent manuscript context:\n${context.slice(-2500)}\n\n` : ""}Create a scene plan for this chapter goal:\n${goal}\n\nOutput format:\n1) Scene Title\n- Purpose\n- POV\n- Conflict\n- Beat List (3-6 beats)\n- Exit Hook`

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]
}

// ---------------------------------------------------------------------------
// Canvas-generate handler (non-streaming JSON)
// ---------------------------------------------------------------------------

async function handleCanvasGenerate(
  supabase: SupabaseClient,
  request: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  const resolved = await validateAndResolve(supabase, request)
  if (resolved.error) {
    return resolved.error
  }

  const { userId, aiConfig } = resolved
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : ""
  const outline = typeof body.outline === "string" ? body.outline.trim() : ""

  if (!outline) {
    return Response.json({ error: "未提供大纲内容" }, { status: 400 })
  }

  if (outline.length < 10) {
    return Response.json({ error: "大纲内容过短，请补充更多剧情信息后重试" }, { status: 400 })
  }

  const startedAt = Date.now()

  try {
    const storyCtx = await fetchStoryContext(supabase, projectId, userId)
    const { fullContext } = buildStoryPromptContext(storyCtx, { feature: "canvas-generate" })

    let systemPrompt = `You are a story structure expert. Your task is to analyze an outline or synopsis and break it down into story beats — the essential narrative moments that drive the plot forward.

Return ONLY a valid JSON array of beat objects. Each beat should have:
- "label": A short, descriptive title for the beat (5-10 words)
- "content": A 1-2 sentence description of what happens in this beat
- "type": Always "beat"

Generate 6-12 beats depending on the complexity of the outline. Order them chronologically.

IMPORTANT: Return ONLY the JSON array. No markdown, no code fences, no explanations.`

    if (fullContext) {
      systemPrompt += `\n\n${fullContext}`
    }

    const userPrompt = `Analyze this outline and generate story beat nodes:\n\n${outline.slice(0, 5000)}`

    const result = await callOpenAIJson({
      ...aiConfig,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: 2000,
      temperature: 0.7,
    })

    if (result.error) {
      return Response.json({ error: result.error }, { status: 500 })
    }

    const content = result.content

    const parsed = parseBeats(content)
    if (parsed.error || !parsed.beats) {
      return Response.json({ error: parsed.error ?? "AI 生成失败" }, { status: 500 })
    }

    // Log to ai_history
    await supabase.from("ai_history").insert({
      user_id: userId,
      project_id: projectId,
      document_id: null,
      feature: "canvas-generate",
      prompt: outline.slice(0, 500),
      result: content,
      model: aiConfig.modelId,
      tokens_used: estimateTokenCount(content),
      latency_ms: Date.now() - startedAt,
      output_chars: content.length,
      response_fingerprint: createTextFingerprint(content),
    })

    return Response.json({ beats: parsed.beats })
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Visualize handler (non-streaming, two-step: LLM prompt optimize + DALL-E)
// ---------------------------------------------------------------------------

async function handleVisualize(
  supabase: SupabaseClient,
  request: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  const resolved = await validateAndResolve(supabase, request)
  if (resolved.error) {
    return resolved.error
  }

  const { userId, aiConfig } = resolved
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : ""
  const text = typeof body.text === "string" ? body.text : ""
  const style = typeof body.style === "string" ? body.style : ""

  if (!text) {
    return Response.json({ error: "未提供描述文本" }, { status: 400 })
  }

  // DALL-E image generation requires an API Key
  const apiKey = aiConfig.apiKey
  if (!apiKey) {
    return Response.json({ error: "图片生成需要 API Key" }, { status: 400 })
  }

  const startedAt = Date.now()

  try {
    // Step 1: Use user's configured model to optimize the text into a DALL-E prompt
    const styleHint = STYLE_PROMPTS[style] || STYLE_PROMPTS.realistic
    const optimizeResult = await callOpenAIJson({
      ...aiConfig,
      messages: [
        {
          role: "system",
          content: `You are an expert at crafting DALL-E image generation prompts. Convert the given text into an optimized DALL-E 3 prompt that creates a vivid, atmospheric scene. Focus on visual details: composition, lighting, colors, mood.

The desired art style is: ${styleHint}

Return ONLY the optimized prompt text. No explanations, no prefixes, no quotes.`,
        },
        {
          role: "user",
          content: `Create a DALL-E prompt based on this text:\n\n${text.slice(0, 2000)}`,
        },
      ],
      maxTokens: 500,
      temperature: 0.7,
    })

    if (optimizeResult.error) {
      return Response.json({ error: `Prompt 优化失败: ${optimizeResult.error}` }, { status: 500 })
    }

    const optimizedPrompt = optimizeResult.content.trim() || text.slice(0, 1000)

    // Step 2: Call DALL-E 3 API to generate image
    const dalleBaseUrl = aiConfig.baseUrl.replace(/\/+$/, "")
    const dalleResponse = await fetch(`${dalleBaseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: optimizedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      }),
    })

    if (!dalleResponse.ok) {
      const error = await dalleResponse.text()
      return Response.json({ error: `图片生成失败: ${error}` }, { status: 500 })
    }

    const dalleData = await dalleResponse.json()
    const imageUrl = dalleData.data?.[0]?.url

    if (!imageUrl) {
      return Response.json({ error: "未获取到图片链接" }, { status: 500 })
    }

    // Step 3: Save to images table
    const { error: insertError } = await supabase.from("images").insert({
      project_id: projectId,
      user_id: userId,
      prompt: optimizedPrompt,
      image_url: imageUrl,
      style: style || "realistic",
      source_text: text.slice(0, 2000),
    })

    if (insertError) {
      console.error("Failed to save image record:", insertError)
    }

    // Log to ai_history
    await supabase.from("ai_history").insert({
      user_id: userId,
      project_id: projectId,
      document_id: null,
      feature: "visualize",
      prompt: text.slice(0, 500),
      result: optimizedPrompt,
      model: "dall-e-3",
      tokens_used: estimateTokenCount(optimizedPrompt),
      latency_ms: Date.now() - startedAt,
      output_chars: optimizedPrompt.length,
      response_fingerprint: createTextFingerprint(optimizedPrompt),
    })

    return Response.json({ imageUrl, prompt: optimizedPrompt })
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const supabase = await createClient()

  // Pre-parse body to extract intent.
  // Clone so the pipeline / handlers can re-parse the body independently.
  const clonedRequest = request.clone()
  let body: Record<string, unknown> = {}
  let intent: PlanRouteIntent = "scene-plan"
  try {
    body = await clonedRequest.json()
    if (isPlanRouteIntent(body.intent)) {
      intent = body.intent
    }
  } catch {
    // Body parse will fail again inside the pipeline, which returns 400.
  }

  switch (intent) {
    case "canvas-generate":
      return handleCanvasGenerate(supabase, request.clone(), body)
    case "visualize":
      return handleVisualize(supabase, request.clone(), body)
    case "scene-plan":
    default:
      return runStreamingPipeline({
        supabase,
        request,
        intent: "scene-plan",
        buildMessages({ body: pipelineBody, fullContext }) {
          return buildScenePlanMessages(pipelineBody, fullContext)
        },
      })
  }
}
