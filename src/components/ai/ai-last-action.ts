const LAST_QUICK_EDIT_PREFIX = "wt:ai:last-quick-edit"

interface LastQuickEditPayload {
  instruction: string
  updatedAt: number
}

function getStorageKey(projectId: string): string {
  return `${LAST_QUICK_EDIT_PREFIX}:${projectId}`
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function saveLastQuickEditInstruction(projectId: string, instruction: string): void {
  const normalizedInstruction = instruction.trim()
  if (!projectId || !normalizedInstruction) {
    return
  }

  const storage = getStorage()
  if (!storage) {
    return
  }

  const payload: LastQuickEditPayload = {
    instruction: normalizedInstruction,
    updatedAt: Date.now(),
  }

  try {
    storage.setItem(getStorageKey(projectId), JSON.stringify(payload))
  } catch {
    return
  }
}

export function getLastQuickEditInstruction(projectId: string): string {
  if (!projectId) {
    return ""
  }

  const storage = getStorage()
  if (!storage) {
    return ""
  }

  try {
    const rawValue = storage.getItem(getStorageKey(projectId))
    if (!rawValue) {
      return ""
    }

    const parsed = JSON.parse(rawValue) as Partial<LastQuickEditPayload>
    if (typeof parsed.instruction !== "string") {
      return ""
    }

    return parsed.instruction.trim()
  } catch {
    return ""
  }
}
