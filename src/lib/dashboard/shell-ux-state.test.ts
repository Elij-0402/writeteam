/* @vitest-environment node */

import { describe, expect, it } from "vitest"
import { deriveShellUXState } from "./shell-ux-state"

describe("deriveShellUXState", () => {
  it("returns create_project when no projects", () => {
    const state = deriveShellUXState([])
    expect(state.recommendedNextAction).toBe("create_project")
  })

  it("returns create_first_document when project exists but has no docs", () => {
    const state = deriveShellUXState([
      { projectId: "p1", documents: [] },
    ])

    expect(state.recommendedNextAction).toBe("create_first_document")
  })

  it("returns resume_last_document when docs exist but no active doc", () => {
    const state = deriveShellUXState([
      {
        projectId: "p1",
        documents: [{ id: "d1", updatedAt: "2026-03-03T10:00:00Z", title: "第一章" }],
      },
    ])

    expect(state.lastEditedDocument?.id).toBe("d1")
    expect(state.recommendedNextAction).toBe("resume_last_document")
  })

  it("returns continue_current_document when active document exists", () => {
    const state = deriveShellUXState(
      [
        {
          projectId: "p1",
          documents: [
            { id: "d1", updatedAt: "2026-03-03T10:00:00Z", title: "第一章" },
            { id: "d2", updatedAt: "2026-03-03T11:00:00Z", title: "第二章" },
          ],
        },
      ],
      "d1",
    )

    expect(state.recommendedNextAction).toBe("continue_current_document")
    expect(state.lastEditedDocument?.id).toBe("d2")
  })
})
