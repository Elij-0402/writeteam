type ProseMode = "balanced" | "cinematic" | "lyrical" | "minimal" | "match-style"

interface StoryBibleStyleFields {
  style?: string | null
  prose_mode?: string | null
  style_sample?: string | null
}

const PROSE_MODE_GUIDANCE: Record<ProseMode, string> = {
  balanced: "Keep prose balanced across dialogue, action, and description.",
  cinematic: "Use visual, momentum-driven prose with clear action beats and strong scene transitions.",
  lyrical: "Use expressive rhythm, imagery, and metaphor while keeping clarity.",
  minimal: "Use concise, precise language with short sentences and minimal ornamentation.",
  "match-style": "Mimic the user style sample's sentence rhythm, diction, and tone while preserving clarity.",
}

export function buildProseModeGuidance(bible: StoryBibleStyleFields | null): string {
  return buildProseModeGuidanceWithOverride(bible)
}

export function buildProseModeGuidanceWithOverride(
  bible: StoryBibleStyleFields | null,
  overrideMode?: string | null
): string {
  if (!bible) {
    return ""
  }

  const mode = (overrideMode || bible.prose_mode || "balanced") as ProseMode
  const base = PROSE_MODE_GUIDANCE[mode] || PROSE_MODE_GUIDANCE.balanced
  const style = bible.style ? `Style intent: ${bible.style}.` : ""
  const sample =
    mode === "match-style" && bible.style_sample
      ? `Style sample:\n${bible.style_sample.slice(0, 1800)}`
      : ""

  return [base, style, sample].filter(Boolean).join("\n")
}
