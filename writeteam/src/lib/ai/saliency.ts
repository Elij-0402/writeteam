export interface SaliencyMap {
  activeCharacters: string[]
  activeLocations: string[]
  activePlotlines: string[]
}

export interface CharacterInfo {
  name: string
  role: string | null
}

/**
 * Compute saliency from recent text (last ~2000 chars).
 * Uses heuristic text matching - no AI call needed.
 */
export function computeSaliency(
  recentText: string,
  characters: CharacterInfo[],
  setting?: string | null,
  worldbuilding?: string | null
): SaliencyMap {
  const text = recentText.slice(-2000).toLowerCase()

  // Find active characters by name mention
  const activeCharacters = characters
    .filter((c) => {
      const name = c.name.toLowerCase()
      // Check for full name or first name (split by space)
      const names = [name, ...name.split(/\s+/)]
      return names.some((n) => n.length > 1 && text.includes(n))
    })
    .map((c) => c.name)

  // Extract potential locations from text
  const activeLocations: string[] = []
  // Check setting keywords if available
  if (setting) {
    const settingWords = setting.toLowerCase().split(/[,，、\s]+/).filter((w) => w.length > 2)
    for (const word of settingWords) {
      if (text.includes(word)) {
        activeLocations.push(word)
      }
    }
  }
  // Also check for common location patterns (in Chinese and English)
  const locationPatterns = [
    /在(.{2,8}?)(?:里|中|上|下|旁|边|前|后|内)/g,
    /来到(.{2,8})/g,
    /走进(.{2,6})/g,
  ]
  for (const pattern of locationPatterns) {
    let match
    while ((match = pattern.exec(recentText.slice(-2000))) !== null) {
      if (match[1] && !activeLocations.includes(match[1])) {
        activeLocations.push(match[1])
      }
    }
  }

  // Active plotlines - extract from worldbuilding keywords if available
  const activePlotlines: string[] = []
  void worldbuilding // reserved for future plotline extraction

  return {
    activeCharacters: activeCharacters.slice(0, 5),
    activeLocations: [...new Set(activeLocations)].slice(0, 3),
    activePlotlines,
  }
}
