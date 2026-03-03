interface EditorSessionState {
  focusMode: boolean
  sidebarCollapsed: boolean
  activeDocId: string | null
  lastQuickEditInstruction: string
}

const STORAGE_KEY_PREFIX = "writeteam:editor-session:"

export function createDefaultEditorSessionState(): EditorSessionState {
  return {
    focusMode: false,
    sidebarCollapsed: false,
    activeDocId: null,
    lastQuickEditInstruction: "",
  }
}

function getStorageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}`
}

function getSafeLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function parseStoredState(rawValue: string): EditorSessionState | null {
  const parsed: unknown = JSON.parse(rawValue)

  if (typeof parsed !== "object" || parsed === null) {
    return null
  }

  const record = parsed as Record<string, unknown>

  if (typeof record.focusMode !== "boolean") {
    return null
  }

  if (typeof record.sidebarCollapsed !== "boolean") {
    return null
  }

  if (record.activeDocId !== null && typeof record.activeDocId !== "string") {
    return null
  }

  if (typeof record.lastQuickEditInstruction !== "string") {
    return null
  }

  return {
    focusMode: record.focusMode,
    sidebarCollapsed: record.sidebarCollapsed,
    activeDocId: record.activeDocId,
    lastQuickEditInstruction: record.lastQuickEditInstruction,
  }
}

function buildPatchedState(
  baseState: EditorSessionState,
  patchOrState: Partial<EditorSessionState> | EditorSessionState
): EditorSessionState {
  return {
    focusMode:
      typeof patchOrState.focusMode === "boolean" ? patchOrState.focusMode : baseState.focusMode,
    sidebarCollapsed:
      typeof patchOrState.sidebarCollapsed === "boolean"
        ? patchOrState.sidebarCollapsed
        : baseState.sidebarCollapsed,
    activeDocId:
      patchOrState.activeDocId === null || typeof patchOrState.activeDocId === "string"
        ? patchOrState.activeDocId
        : baseState.activeDocId,
    lastQuickEditInstruction:
      typeof patchOrState.lastQuickEditInstruction === "string"
        ? patchOrState.lastQuickEditInstruction
        : baseState.lastQuickEditInstruction,
  }
}

export function readEditorSessionState(projectId: string): EditorSessionState {
  const localStorageInstance = getSafeLocalStorage()
  const defaultState = createDefaultEditorSessionState()

  if (!localStorageInstance) {
    return defaultState
  }

  const key = getStorageKey(projectId)
  const rawValue = localStorageInstance.getItem(key)

  if (rawValue === null) {
    return defaultState
  }

  try {
    const parsed = parseStoredState(rawValue)

    if (parsed) {
      return parsed
    }
  } catch {
    // Invalid JSON should be cleaned up and reset.
  }

  localStorageInstance.removeItem(key)
  return defaultState
}

export function writeEditorSessionState(
  projectId: string,
  patchOrState: Partial<EditorSessionState> | EditorSessionState
): void {
  const localStorageInstance = getSafeLocalStorage()

  if (!localStorageInstance) {
    return
  }

  const key = getStorageKey(projectId)
  const baseState = readEditorSessionState(projectId)
  const nextState = buildPatchedState(baseState, patchOrState)

  try {
    localStorageInstance.setItem(key, JSON.stringify(nextState))
  } catch {
    // Ignore write failures (private mode/quota) to avoid editor crashes.
  }
}
