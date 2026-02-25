import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createTextFingerprint, estimateTokenCount } from "@/lib/ai/telemetry"
import { buildProseModeGuidanceWithOverride } from "@/lib/ai/prose-mode"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { text, context, projectId, documentId, proseMode } = await request.json()

  const { data: bible } = await supabase
    .from("story_bibles")
    .select("style, prose_mode, style_sample")
    .eq("project_id", projectId)
    .single()

  let systemPrompt = `You are a creative fiction writing assistant. Your task is to expand the given passage by adding more detail, description, sensory imagery, internal thoughts, and moment-to-moment action. Slow down the pacing and flesh out the scene without changing the plot direction. Return ONLY the expanded prose.`
  const proseGuidance = buildProseModeGuidanceWithOverride(bible, proseMode)

  if (proseGuidance) {
    systemPrompt += `\n\nProse mode guidance:\n${proseGuidance}`
  }

  const userPrompt = `Expand this passage with more detail, description, and depth:\n\n"${text}"\n\n${context ? `Story context:\n${context.slice(-2000)}\n\n` : ""}Write an expanded version (roughly 2-3x the original length). Focus on sensory details, character interiority, and scene-setting:`

  try {
    const startedAt = Date.now()
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return Response.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
        max_tokens: 1500,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return Response.json({ error: `OpenAI error: ${error}` }, { status: 500 })
    }

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        if (!reader) { controller.close(); return }
        const decoder = new TextDecoder()
        let fullText = ""
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split("\n").filter((l) => l.startsWith("data: "))
            for (const line of lines) {
              const data = line.slice(6)
              if (data === "[DONE]") continue
              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content
                if (content) {
                  fullText += content
                  controller.enqueue(encoder.encode(content))
                }
              } catch { /* skip */ }
            }
          }
        } finally {
          await supabase.from("ai_history").insert({
            user_id: user.id,
            project_id: projectId,
            document_id: documentId || null,
            feature: "expand",
            prompt: text.slice(0, 500),
            result: fullText,
            model: "gpt-4o-mini",
            tokens_used: estimateTokenCount(fullText),
            latency_ms: Date.now() - startedAt,
            output_chars: fullText.length,
            response_fingerprint: createTextFingerprint(fullText),
          })
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
