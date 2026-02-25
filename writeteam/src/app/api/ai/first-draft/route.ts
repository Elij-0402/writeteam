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

  const { outline, context, projectId, documentId, proseMode } = await request.json()

  if (!outline) {
    return Response.json({ error: "No outline provided" }, { status: 400 })
  }

  // Fetch story bible for richer context
  const { data: bible } = await supabase
    .from("story_bibles")
    .select("genre, style, pov, tense, synopsis, worldbuilding, prose_mode, style_sample")
    .eq("project_id", projectId)
    .single()

  const { data: characters } = await supabase
    .from("characters")
    .select("name, role, description, personality, appearance")
    .eq("project_id", projectId)

  let storyContext = ""
  if (bible) {
    const parts = []
    if (bible.genre) parts.push(`Genre: ${bible.genre}`)
    if (bible.style) parts.push(`Style: ${bible.style}`)
    if (bible.pov) parts.push(`POV: ${bible.pov}`)
    if (bible.tense) parts.push(`Tense: ${bible.tense}`)
    if (bible.synopsis) parts.push(`Synopsis: ${bible.synopsis}`)
    if (parts.length > 0) storyContext += parts.join("\n") + "\n\n"
  }

  if (characters && characters.length > 0) {
    storyContext += "Characters:\n"
    for (const char of characters) {
      storyContext += `- ${char.name}${char.role ? ` (${char.role})` : ""}: ${char.description || "No description"}\n`
    }
    storyContext += "\n"
  }

  let systemPrompt = `You are a professional fiction writer. Given an outline or scene beats, write a complete, polished first draft scene. Write vivid, engaging prose with dialogue, action, and description. Match the specified POV and tense. Do NOT include meta-commentary — just write the scene.`
  const proseGuidance = buildProseModeGuidanceWithOverride(bible, proseMode)

  if (proseGuidance) {
    systemPrompt += `\n\nProse mode guidance:\n${proseGuidance}`
  }

  const userPrompt = `${storyContext ? `Story Bible:\n${storyContext}\n` : ""}${context ? `Previous context:\n${context.slice(-2000)}\n\n` : ""}Write a complete first draft scene based on these beats/outline:\n\n${outline}\n\nWrite the full scene (800-1200 words) with rich prose, dialogue, and description:`

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
        max_tokens: 2500,
        temperature: 0.85,
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
            feature: "first-draft",
            prompt: outline.slice(0, 500),
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
