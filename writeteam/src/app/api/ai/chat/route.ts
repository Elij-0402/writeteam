import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createTextFingerprint, estimateTokenCount } from "@/lib/ai/telemetry"
import { buildProseModeGuidanceWithOverride } from "@/lib/ai/prose-mode"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未授权访问" }, { status: 401 })
  }

  const { messages, context, projectId, documentId, proseMode } = await request.json()

  // Fetch story bible for chat context
  const { data: bible } = await supabase
    .from("story_bibles")
    .select("genre, style, synopsis, worldbuilding, braindump, prose_mode, style_sample")
    .eq("project_id", projectId)
    .single()

  const { data: characters } = await supabase
    .from("characters")
    .select("name, role, description, personality")
    .eq("project_id", projectId)

  let storyContext = ""
  if (bible) {
    const parts = []
    if (bible.genre) parts.push(`Genre: ${bible.genre}`)
    if (bible.style) parts.push(`Style: ${bible.style}`)
    if (bible.synopsis) parts.push(`Synopsis: ${bible.synopsis}`)
    if (bible.worldbuilding) parts.push(`Worldbuilding: ${bible.worldbuilding.slice(0, 500)}`)
    if (parts.length > 0) storyContext += parts.join("\n") + "\n\n"
  }

  if (characters && characters.length > 0) {
    storyContext += "Characters:\n"
    for (const char of characters) {
      storyContext += `- ${char.name}${char.role ? ` (${char.role})` : ""}: ${char.description || char.personality || "No description"}\n`
    }
    storyContext += "\n"
  }

  const proseGuidance = buildProseModeGuidanceWithOverride(bible, proseMode)

  const systemPrompt = `You are a knowledgeable, creative AI writing assistant. You have access to the author's story information and current document. Help them brainstorm, solve plot problems, develop characters, and answer questions about their story. Be concise but insightful. When suggesting changes, be specific.

${storyContext ? `Story Bible:\n${storyContext}` : ""}
${proseGuidance ? `Prose mode guidance:\n${proseGuidance}\n` : ""}
${context ? `Current document context (last 3000 chars):\n${context}\n` : ""}`

  const apiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ]

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
        messages: apiMessages,
        stream: true,
        max_tokens: 1000,
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
          const lastUserMessage = messages[messages.length - 1]?.content || ""
          await supabase.from("ai_history").insert({
            user_id: user.id,
            project_id: projectId,
            document_id: documentId || null,
            feature: "chat",
            prompt: lastUserMessage.slice(0, 500),
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
