export function countDocumentWords(text: string): number {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return 0
  }

  const hanChars = normalized.match(/\p{Script=Han}/gu)?.length ?? 0
  const latinWords = normalized.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)?.length ?? 0

  return hanChars + latinWords
}
