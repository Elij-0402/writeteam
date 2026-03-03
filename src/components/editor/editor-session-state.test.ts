/* @vitest-environment jsdom */

import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import {
  createDefaultEditorSessionState,
  readEditorSessionState,
  writeEditorSessionState,
} from "./editor-session-state"

describe("editor-session-state", () => {
  beforeAll(() => {
    const storage = createMemoryStorage()
    Object.defineProperty(window, "localStorage", {
      value: storage,
      configurable: true,
    })
  })

  beforeEach(() => {
    localStorage.clear()
  })

  it("returns defaults when storage missing", () => {
    const state = readEditorSessionState("project-1")

    expect(state).toEqual(createDefaultEditorSessionState())
  })

  it("writes and reads state for a project", () => {
    writeEditorSessionState("project-1", {
      focusMode: true,
      sidebarCollapsed: true,
      activeDocId: "doc-1",
      lastQuickEditInstruction: "润色语气",
    })

    expect(readEditorSessionState("project-1")).toEqual({
      focusMode: true,
      sidebarCollapsed: true,
      activeDocId: "doc-1",
      lastQuickEditInstruction: "润色语气",
    })
  })

  it("cleans corrupt JSON and returns defaults", () => {
    writeEditorSessionState("project-1", { focusMode: true })
    const storageKey = localStorage.key(0)
    expect(storageKey).not.toBeNull()

    localStorage.setItem(String(storageKey), "{invalid")

    const state = readEditorSessionState("project-1")

    expect(state).toEqual(createDefaultEditorSessionState())
    expect(localStorage.getItem(String(storageKey))).toBeNull()
  })

  it("isolates state by project key", () => {
    writeEditorSessionState("project-1", { activeDocId: "doc-a" })
    writeEditorSessionState("project-2", { activeDocId: "doc-b" })

    expect(readEditorSessionState("project-1").activeDocId).toBe("doc-a")
    expect(readEditorSessionState("project-2").activeDocId).toBe("doc-b")
  })
})

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}
