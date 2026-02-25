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

  const { text, mode, customInstructions, projectId, documentId, proseMode } = await request.json()

  if (!text) {
    return Response.json({ error: "No text selected" }, { status: 400 })
  }

  const { data: bible } = await supabase
    .from("story_bibles")
    .select("style, prose_mode, style_sample")
    .eq("project_id", projectId)
    .single()

  let systemPrompt = `You are a skilled fiction editor. Rewrite the given text according to the instructions. Return ONLY the rewritten text — no explanations, no meta-commentary.`
  const proseGuidance = buildProseModeGuidanceWithOverride(bible, proseMode)

  if (proseGuidance) {
    systemPrompt += `\n\nProse mode guidance:\n${proseGuidance}`
  }

  let instruction = ""
  switch (mode) {
    case "rephrase":
      instruction = "Rephrase this passage while keeping the same meaning and narrative intent. Vary the sentence structure and word choice."
      break
    case "shorter":
      instruction = "Make this passage more concise. Remove unnecessary words and tighten the prose while preserving the essential meaning."
      break
    case "longer":
      instruction = "Expand this passage with more detail, description, and nuance. Add sensory details and deepen the emotional resonance."
      break
    case "show-not-tell":
      instruction = "Rewrite this passage using 'show, don't tell' techniques. Replace abstract statements with concrete actions, sensory details, and dialogue."
      break
    case "more-intense":
      instruction = "Rewrite this passage to be more emotionally intense and dramatic. Heighten the tension, urgency, or emotional impact."
      break
    case "more-lyrical":
      instruction = "Rewrite this passage in a more lyrical, poetic style. Use rhythm, metaphor, and evocative language."
      break
    case "custom":
      instruction = customInstructions || "Improve this passage."
      break
    default:
      instruction = "Rephrase this passage while keeping the same meaning."
  }

  const userPrompt = `${instruction}\n\nOriginal text:\n"${text}"\n\nRewritten text:`

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
        temperature: 0.7,
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
            feature: "rewrite",
            prompt: userPrompt.slice(0, 500),
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
