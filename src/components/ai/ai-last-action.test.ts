/* @vitest-environment jsdom */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import {
  getLastQuickEditInstruction,
  saveLastQuickEditInstruction,
} from "./ai-last-action"

describe("ai-last-action", () => {
  beforeAll(() => {
    const storage = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
      clear: () => {
        storage.clear()
      },
    })
  })

  const projectAStorageKey = "wt:ai:last-quick-edit:project-a"
  const projectBStorageKey = "wt:ai:last-quick-edit:project-b"

  beforeEach(() => {
    window.localStorage.removeItem(projectAStorageKey)
    window.localStorage.removeItem(projectBStorageKey)
  })

  it("saves and loads quick-edit instruction by project", () => {
    saveLastQuickEditInstruction("project-a", "改得更紧张")

    expect(getLastQuickEditInstruction("project-a")).toBe("改得更紧张")
    expect(getLastQuickEditInstruction("project-b")).toBe("")
  })

  it("ignores empty instruction when saving", () => {
    saveLastQuickEditInstruction("project-a", "   ")

    expect(getLastQuickEditInstruction("project-a")).toBe("")
  })

  it("returns empty string for malformed storage payload", () => {
    window.localStorage.setItem(projectAStorageKey, "not-json")

    expect(getLastQuickEditInstruction("project-a")).toBe("")
  })
})
