export interface WorldbuildingSection {
  title: string
  content: string
}

export const DEFAULT_SECTION_TITLES = [
  "地理环境",
  "势力与阵营",
  "能力体系",
  "社会与文化",
] as const

const SECTION_HEADER_RE = /^\[(.+?)\]\s*$/

export function parseWorldbuildingSections(
  text: string | null | undefined
): WorldbuildingSection[] {
  if (!text || text.trim() === "") return []

  const lines = text.split("\n")
  const sections: WorldbuildingSection[] = []
  let currentTitle: string | null = null
  let currentLines: string[] = []

  for (const line of lines) {
    const match = SECTION_HEADER_RE.exec(line)
    if (match) {
      if (currentTitle !== null) {
        sections.push({ title: currentTitle, content: currentLines.join("\n").trim() })
      }
      currentTitle = match[1]
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }

  if (currentTitle !== null) {
    sections.push({ title: currentTitle, content: currentLines.join("\n").trim() })
  } else if (currentLines.join("\n").trim()) {
    sections.push({ title: "通用", content: currentLines.join("\n").trim() })
  }

  return sections
}

export function serializeWorldbuildingSections(
  sections: WorldbuildingSection[]
): string {
  const nonEmpty = sections.filter((s) => s.content.trim() !== "")
  if (nonEmpty.length === 0) return ""
  if (nonEmpty.length === 1 && nonEmpty[0].title === "通用") {
    return nonEmpty[0].content
  }
  return nonEmpty.map((s) => `[${s.title}]\n${s.content}`).join("\n\n")
}
