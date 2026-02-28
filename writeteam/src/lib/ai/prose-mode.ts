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

  const requestedMode = (overrideMode || bible.prose_mode || "balanced") as ProseMode
  const fallbackToBalanced = requestedMode === "match-style" && !bible.style_sample
  const effectiveMode: ProseMode = fallbackToBalanced ? "balanced" : requestedMode
  const base = PROSE_MODE_GUIDANCE[effectiveMode] || PROSE_MODE_GUIDANCE.balanced
  const style = bible.style ? `Style intent: ${bible.style}.` : ""
  const sample =
    effectiveMode === "match-style" && bible.style_sample
      ? `Style sample:\n${bible.style_sample.slice(0, 1800)}`
      : ""
  const fallbackReason = fallbackToBalanced
    ? "Style mode fallback: match-style requested but no style sample found; using balanced mode."
    : ""

  return [base, style, sample, fallbackReason].filter(Boolean).join("\n")
}
