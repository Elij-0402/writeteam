import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createTextFingerprint, estimateTokenCount } from "@/lib/ai/telemetry"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { passage, context, projectId, documentId } = await request.json()

  if (!passage) {
    return Response.json({ error: "No passage provided" }, { status: 400 })
  }

  const { data: bible } = await supabase
    .from("story_bibles")
    .select("genre, style, pov, tense, synopsis, worldbuilding")
    .eq("project_id", projectId)
    .single()

  const { data: characters } = await supabase
    .from("characters")
    .select("name, role, description, personality, goals, relationships")
    .eq("project_id", projectId)

  let storyContext = ""
  if (bible) {
    const parts = []
    if (bible.genre) parts.push(`Genre: ${bible.genre}`)
    if (bible.style) parts.push(`Style: ${bible.style}`)
    if (bible.pov) parts.push(`POV: ${bible.pov}`)
    if (bible.tense) parts.push(`Tense: ${bible.tense}`)
    if (bible.synopsis) parts.push(`Synopsis: ${bible.synopsis}`)
    if (bible.worldbuilding) parts.push(`Worldbuilding: ${bible.worldbuilding.slice(0, 1500)}`)
    if (parts.length > 0) {
      storyContext += `${parts.join("\n")}\n\n`
    }
  }

  if (characters && characters.length > 0) {
    storyContext += "Characters:\n"
    for (const character of characters) {
      storyContext += `- ${character.name}${character.role ? ` (${character.role})` : ""}${character.description ? ` | description: ${character.description}` : ""}${character.personality ? ` | personality: ${character.personality}` : ""}${character.goals ? ` | goals: ${character.goals}` : ""}${character.relationships ? ` | relationships: ${character.relationships}` : ""}\n`
    }
    storyContext += "\n"
  }

  const systemPrompt =
    "You are a strict fiction continuity editor. Find contradictions, logic gaps, timeline issues, POV drift, and character inconsistency. Output concise diagnostics and fixes."

  const userPrompt = `${storyContext ? `Story bible facts:\n${storyContext}` : ""}${context ? `Recent chapter context:\n${context.slice(-2500)}\n\n` : ""}Check this passage for continuity issues:\n\n${passage}\n\nOutput format:\n- Issue\n- Why it conflicts\n- Suggested fix\nIf no issues, output: No continuity issues found.`

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
        max_tokens: 1200,
        temperature: 0.3,
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
            feature: "continuity-check",
            prompt: passage.slice(0, 500),
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
