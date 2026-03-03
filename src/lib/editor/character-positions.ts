export interface CharacterMention {
  name: string
  from: number
  to: number
}

/**
 * Find all character name positions in a text string.
 * When names overlap (e.g. "陈安" inside "陈安然"), the longer name wins.
 */
export function findCharacterMentions(
  text: string,
  characterNames: string[]
): CharacterMention[] {
  if (!characterNames.length || !text) return []

  // Sort by length descending so longer names are matched first
  const sorted = [...characterNames].sort((a, b) => b.length - a.length)

  // Track which character positions are already claimed
  const claimed = new Set<number>()
  const mentions: CharacterMention[] = []

  for (const name of sorted) {
    let index = 0
    while ((index = text.indexOf(name, index)) !== -1) {
      // Check if any position in this range is already claimed
      let overlaps = false
      for (let i = index; i < index + name.length; i++) {
        if (claimed.has(i)) {
          overlaps = true
          break
        }
      }

      if (!overlaps) {
        mentions.push({ name, from: index, to: index + name.length })
        for (let i = index; i < index + name.length; i++) {
          claimed.add(i)
        }
      }
      index += name.length
    }
  }

  // Sort by position
  mentions.sort((a, b) => a.from - b.from)
  return mentions
}
