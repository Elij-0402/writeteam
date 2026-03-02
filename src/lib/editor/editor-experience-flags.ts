type EnvMap = Record<string, string | undefined>

export function isEditorFocusEnhancementEnabled(env: EnvMap = process.env): boolean {
  return env.NEXT_PUBLIC_EDITOR_FOCUS !== "0"
}

export function isEditorQuickEditReuseEnabled(env: EnvMap = process.env): boolean {
  return env.NEXT_PUBLIC_EDITOR_QUICK_REUSE !== "0"
}
