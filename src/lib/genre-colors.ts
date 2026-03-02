export const GENRES = [
  "奇幻",
  "科幻",
  "言情",
  "悬疑",
  "惊悚",
  "恐怖",
  "文学",
  "历史",
  "青少年",
  "儿童",
  "非虚构",
  "其他",
] as const

const GENRE_GRADIENTS: Record<string, string> = {
  奇幻: "from-purple-500/80 to-indigo-500/80",
  科幻: "from-cyan-500/80 to-blue-500/80",
  言情: "from-pink-500/80 to-rose-500/80",
  悬疑: "from-amber-500/80 to-orange-500/80",
  惊悚: "from-red-500/80 to-red-700/80",
  恐怖: "from-gray-500/80 to-gray-700/80",
  文学: "from-green-500/80 to-emerald-500/80",
  历史: "from-amber-700/80 to-yellow-600/80",
  青少年: "from-sky-400/80 to-blue-500/80",
  儿童: "from-yellow-400/80 to-orange-400/80",
  非虚构: "from-slate-400/80 to-gray-500/80",
  其他: "from-zinc-400/80 to-zinc-500/80",
}

const NEUTRAL_GRADIENT = "from-muted/80 to-muted-foreground/20"

export function getGenreGradient(genre: string | null | undefined): string {
  if (!genre) return NEUTRAL_GRADIENT
  return GENRE_GRADIENTS[genre] ?? NEUTRAL_GRADIENT
}
