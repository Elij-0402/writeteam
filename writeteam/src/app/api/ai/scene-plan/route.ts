import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createTextFingerprint, estimateTokenCount } from "@/lib/ai/telemetry"
import { buildProseModeGuidanceWithOverride } from "@/lib/ai/prose-mode"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "未授权访问" }, { status: 401 })
  }

  const { goal, context, projectId, documentId, proseMode } = await request.json()

  if (!goal) {
    return Response.json({ error: "未提供场景规划目标" }, { status: 400 })
  }

  const { data: bible } = await supabase
    .from("story_bibles")
    .select("genre, style, pov, tense, synopsis, worldbuilding, outline, prose_mode, style_sample")
    .eq("project_id", projectId)
    .single()

  const { data: characters } = await supabase
    .from("characters")
    .select("name, role, goals, personality")
    .eq("project_id", projectId)

  let storyContext = ""
  if (bible) {
    const parts = []
    if (bible.genre) parts.push(`Genre: ${bible.genre}`)
    if (bible.style) parts.push(`Style: ${bible.style}`)
    if (bible.pov) parts.push(`POV: ${bible.pov}`)
    if (bible.tense) parts.push(`Tense: ${bible.tense}`)
    if (bible.synopsis) parts.push(`Synopsis: ${bible.synopsis}`)
    if (bible.outline) parts.push(`Outline: ${JSON.stringify(bible.outline).slice(0, 2000)}`)
    if (parts.length > 0) {
      storyContext += `${parts.join("\n")}\n\n`
    }
  }

  if (characters && characters.length > 0) {
    storyContext += "Characters:\n"
    for (const character of characters) {
      storyContext += `- ${character.name}${character.role ? ` (${character.role})` : ""}${character.goals ? ` | goals: ${character.goals}` : ""}${character.personality ? ` | personality: ${character.personality}` : ""}\n`
    }
    storyContext += "\n"
  }

  let systemPrompt =
    "You are an expert fiction story architect. Break chapter goals into scene-by-scene plans. Ensure rising tension, cause-effect continuity, and clear scene purpose. Return only the plan."
  const proseGuidance = buildProseModeGuidanceWithOverride(bible, proseMode)

  if (proseGuidance) {
    systemPrompt += `\n\nProse mode guidance:\n${proseGuidance}`
  }

  const userPrompt = `${storyContext ? `Story bible context:\n${storyContext}` : ""}${context ? `Recent manuscript context:\n${context.slice(-2500)}\n\n` : ""}Create a scene plan for this chapter goal:\n${goal}\n\nOutput format:\n1) Scene Title\n- Purpose\n- POV\n- Conflict\n- Beat List (3-6 beats)\n- Exit Hook`

  try {
    const startedAt = Date.now()
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return Response.json({ error: "OpenAI API Key 未配置" }, { status: 500 })
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
        max_tokens: 1800,
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
        if (!reader) {
          controller.close()
          return
        }

        const decoder = new TextDecoder()
        let fullText = ""
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split("\n").filter((line) => line.startsWith("data: "))
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
              } catch {
                continue
              }
            }
          }
        } finally {
          await supabase.from("ai_history").insert({
            user_id: user.id,
            project_id: projectId,
            document_id: documentId || null,
            feature: "scene-plan",
            prompt: goal.slice(0, 500),
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
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
