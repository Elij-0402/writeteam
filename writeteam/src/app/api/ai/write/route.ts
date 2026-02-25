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

  const { context, mode, guidance, projectId, documentId, proseMode } = await request.json()

  // Fetch story bible for context
  const { data: bible } = await supabase
    .from("story_bibles")
    .select("genre, style, pov, tense, synopsis, prose_mode, style_sample")
    .eq("project_id", projectId)
    .single()

  let systemPrompt = `You are a creative fiction writing AI assistant. Your task is to continue the story seamlessly from where the author left off. Write in a natural, engaging style that matches the existing prose.`
  const proseGuidance = buildProseModeGuidanceWithOverride(bible, proseMode)

  if (bible) {
    const bibleContext = []
    if (bible.genre) bibleContext.push(`Genre: ${bible.genre}`)
    if (bible.style) bibleContext.push(`Style: ${bible.style}`)
    if (bible.pov) bibleContext.push(`POV: ${bible.pov}`)
    if (bible.tense) bibleContext.push(`Tense: ${bible.tense}`)
    if (bible.synopsis) bibleContext.push(`Synopsis: ${bible.synopsis}`)
    if (bibleContext.length > 0) {
      systemPrompt += `\n\nStory context:\n${bibleContext.join("\n")}`
    }
  }

  if (proseGuidance) {
    systemPrompt += `\n\nProse mode guidance:\n${proseGuidance}`
  }

  let userPrompt = ""

  switch (mode) {
    case "guided":
      userPrompt = `Continue the story based on this direction: "${guidance}"\n\nHere is the recent context:\n\n${context}\n\nContinue writing (about 200-400 words):`
      break
    case "tone-ominous":
      userPrompt = `Continue the story in an ominous, foreboding tone:\n\n${context}\n\nContinue writing with a dark, suspenseful atmosphere (about 200-400 words):`
      break
    case "tone-romantic":
      userPrompt = `Continue the story in a romantic, tender tone:\n\n${context}\n\nContinue writing with warmth and emotional depth (about 200-400 words):`
      break
    case "tone-fast":
      userPrompt = `Continue the story with fast-paced, high-energy prose:\n\n${context}\n\nContinue writing with urgency and momentum (about 200-400 words):`
      break
    case "tone-humorous":
      userPrompt = `Continue the story with wit and humor:\n\n${context}\n\nContinue writing with a light, humorous tone (about 200-400 words):`
      break
    default: // auto
      userPrompt = `Continue the story naturally:\n\n${context}\n\nContinue writing (about 200-400 words):`
      break
  }

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
        max_tokens: 1000,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return Response.json({ error: `OpenAI error: ${error}` }, { status: 500 })
    }

    // Stream the response
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
              } catch {
                // Skip malformed chunks
              }
            }
          }
        } finally {
          // Save to AI history
          await supabase.from("ai_history").insert({
            user_id: user.id,
            project_id: projectId,
            document_id: documentId || null,
            feature: "write",
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
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
