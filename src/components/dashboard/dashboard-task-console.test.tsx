/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DashboardTaskConsole } from "./dashboard-task-console"
import type { ShellUXDocument, ShellUXState } from "@/lib/dashboard/shell-ux-state"

afterEach(cleanup)

function createState(overrides: Partial<ShellUXState> = {}): ShellUXState {
  return {
    recommendedNextAction: "resume_last_document",
    lastEditedDocument: {
      id: "doc-1",
      title: "第一章",
      updatedAt: "2026-03-03T10:00:00Z",
    },
    ...overrides,
  }
}

function createRecentDocuments(): ShellUXDocument[] {
  return [
    { id: "doc-1", title: "第一章", updatedAt: "2026-03-03T10:00:00Z" },
    { id: "doc-2", title: "第二章", updatedAt: "2026-03-03T09:00:00Z" },
    { id: "doc-3", title: "第三章", updatedAt: "2026-03-03T08:00:00Z" },
    { id: "doc-4", title: "第四章", updatedAt: "2026-03-03T07:00:00Z" },
    { id: "doc-5", title: "第五章", updatedAt: "2026-03-03T06:00:00Z" },
    { id: "doc-6", title: "第六章", updatedAt: "2026-03-03T05:00:00Z" },
  ]
}

describe("DashboardTaskConsole", () => {
  it("renders continue writing primary action", () => {
    render(
      <DashboardTaskConsole
        state={createState()}
        recentDocuments={createRecentDocuments()}
        onResumeLastDoc={vi.fn()}
        onCreateProject={vi.fn()}
        onCreateFirstDoc={vi.fn()}
      />,
    )

    const button = screen.getByRole("button", { name: "继续写作" })
    expect(button).not.toBeNull()
  })

  it("renders at most 5 recent documents", () => {
    render(
      <DashboardTaskConsole
        state={createState()}
        recentDocuments={createRecentDocuments()}
        onResumeLastDoc={vi.fn()}
        onCreateProject={vi.fn()}
        onCreateFirstDoc={vi.fn()}
      />,
    )

    expect(screen.getByText("第一章")).not.toBeNull()
    expect(screen.getByText("第五章")).not.toBeNull()
    expect(screen.queryByText("第六章")).toBeNull()
  })

  it("renders next action message based on recommended next action", () => {
    render(
      <DashboardTaskConsole
        state={createState({ recommendedNextAction: "create_project", lastEditedDocument: undefined })}
        recentDocuments={[]}
        onResumeLastDoc={vi.fn()}
        onCreateProject={vi.fn()}
        onCreateFirstDoc={vi.fn()}
      />,
    )

    expect(screen.getByText("下一步建议：先创建一个项目。")).not.toBeNull()
  })

  it("renders continue current document suggestion when recommended", () => {
    render(
      <DashboardTaskConsole
        state={createState({ recommendedNextAction: "continue_current_document" })}
        recentDocuments={createRecentDocuments()}
        onResumeLastDoc={vi.fn()}
        onCreateProject={vi.fn()}
        onCreateFirstDoc={vi.fn()}
      />,
    )

    expect(screen.getByText("下一步建议：继续当前文档写作。")).not.toBeNull()
    expect(screen.getByRole("button", { name: "继续当前文档" })).not.toBeNull()
  })

  it("triggers create first document callback from suggestion action", () => {
    const onCreateFirstDoc = vi.fn()
    render(
      <DashboardTaskConsole
        state={createState({ recommendedNextAction: "create_first_document", lastEditedDocument: undefined })}
        recentDocuments={[]}
        onResumeLastDoc={vi.fn()}
        onCreateProject={vi.fn()}
        onCreateFirstDoc={onCreateFirstDoc}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "创建首个文档" }))

    expect(onCreateFirstDoc).toHaveBeenCalledTimes(1)
  })
})
