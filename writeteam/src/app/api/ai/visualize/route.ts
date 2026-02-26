import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { callOpenAIJson } from "@/lib/ai/openai-json"
import { createTextFingerprint, estimateTokenCount } from "@/lib/ai/telemetry"

const STYLE_PROMPTS: Record<string, string> = {
  realistic: "photorealistic, highly detailed, cinematic lighting",
  watercolor: "watercolor painting, soft washes, artistic, ethereal",
  anime: "anime art style, vibrant colors, detailed illustration",
  "oil-painting": "oil painting, rich textures, masterful brushstrokes, classical art",
  sketch: "pencil sketch, hand-drawn, detailed linework, artistic",
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未授权访问" }, { status: 401 })
  }

  const { projectId, text, style } = await request.json()

  if (!text) {
    return Response.json({ error: "未提供描述文本" }, { status: 400 })
  }

  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) {
    return Response.json({ error: "AI 服务未配置" }, { status: 400 })
  }

  // DALL-E image generation requires OpenAI API — check if it's an OpenAI-compatible endpoint
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
    // DALL-E is OpenAI-specific, use the configured base URL
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
      user_id: user.id,
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
      user_id: user.id,
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
