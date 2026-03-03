/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useEffect, useRef } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readEditorSessionState } from "./editor-session-state"
import { EditorShell } from "./editor-shell"
import type { AutosaveStatus } from "./autosave-status"
import type { Character, Document, Project } from "@/types/database"

const writingEditorMock = vi.hoisted(() => ({
  retryRequestCount: 0,
}))

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}))

vi.mock("lucide-react", () => {
  const Icon = () => <svg aria-hidden="true" />
  return {
    PenLine: Icon,
    ArrowLeft: Icon,
    ArrowUp: Icon,
    ArrowDown: Icon,
    Plus: Icon,
    FileText: Icon,
    BookOpen: Icon,
    MessageSquare: Icon,
    MoreVertical: Icon,
    Trash2: Icon,
    Loader2: Icon,
    ChevronLeft: Icon,
    ChevronRight: Icon,
    Download: Icon,
    Upload: Icon,
    Lightbulb: Icon,
    Image: Icon,
    LayoutGrid: Icon,
    Settings: Icon,
    Check: Icon,
    ChevronsUpDown: Icon,
  }
})

vi.mock("@/components/providers/ai-config-provider", () => ({
  useAIConfigContext: () => ({
    config: null,
    isConfigured: false,
    updateConfig: vi.fn(),
  }),
}))

vi.mock("@/app/actions/documents", () => ({
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  reorderDocuments: vi.fn(),
}))

vi.mock("@/lib/export", () => ({
  exportAsText: vi.fn(),
  exportAsDocx: vi.fn(),
  exportProjectAsDocx: vi.fn(),
}))

vi.mock("@/lib/import", () => ({
  parseImportedFile: vi.fn(),
}))

vi.mock("@/lib/ai/saliency", () => ({
  computeSaliency: vi.fn(() => null),
}))

vi.mock("@/components/editor/writing-editor", () => ({
  WritingEditor: ({
    retryRequestId,
    onAutosaveStatusChange,
  }: {
    retryRequestId?: number
    onAutosaveStatusChange?: (status: AutosaveStatus) => void
  }) => {
    const retryRequestIdRef = useRef(retryRequestId ?? 0)

    useEffect(() => {
      onAutosaveStatusChange?.("error")
    }, [onAutosaveStatusChange])

    useEffect(() => {
      const nextRetryRequestId = retryRequestId ?? 0
      if (nextRetryRequestId === retryRequestIdRef.current) {
        return
      }

      retryRequestIdRef.current = nextRetryRequestId
      writingEditorMock.retryRequestCount += 1
      onAutosaveStatusChange?.("retrying")
    }, [onAutosaveStatusChange, retryRequestId])

    return <div data-testid="writing-editor" />
  },
}))

vi.mock("@/components/story-bible/story-bible-panel", () => ({
  StoryBiblePanel: () => <div data-testid="story-bible-panel" />,
}))

vi.mock("@/components/ai/ai-chat-panel", () => ({
  AIChatPanel: () => <div data-testid="ai-chat-panel" />,
}))

vi.mock("@/components/ai/ai-toolbar", () => ({
  AIToolbar: () => <div data-testid="ai-toolbar" />,
}))

vi.mock("@/components/ai/muse-panel", () => ({
  MusePanel: () => <div data-testid="muse-panel" />,
}))

vi.mock("@/components/ai/visualize-panel", () => ({
  VisualizePanel: () => <div data-testid="visualize-panel" />,
}))

vi.mock("@/components/plugins/plugin-manager", () => ({
  PluginManager: () => null,
}))

vi.mock("@/components/editor/saliency-indicator", () => ({
  SaliencyIndicator: () => null,
}))

vi.mock("@/components/layout/command-palette", () => ({
  CommandPalette: () => null,
}))

vi.mock("@/components/settings/ai-provider-form", () => ({
  AIProviderForm: () => <div data-testid="ai-provider-form" />,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <div />,
}))

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => <div />,
}))

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}))

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/ui/command", () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: () => <input />,
  CommandItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

function createProject(): Project {
  return {
    id: "project-1",
    user_id: "user-1",
    title: "测试项目",
    description: null,
    genre: null,
    cover_image_url: null,
    word_count_goal: null,
    preferred_model: null,
    series_id: null,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  }
}

function createDocument(): Document {
  return {
    id: "doc-1",
    project_id: "project-1",
    user_id: "user-1",
    title: "第 1 章",
    content: null,
    content_text: "测试内容",
    word_count: 2,
    sort_order: 0,
    document_type: "chapter",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  }
}

function renderEditorShell() {
  const project = createProject()
  const documents = [createDocument()]
  const characters: Character[] = []

  render(
    <EditorShell
      project={project}
      documents={documents}
      storyBible={null}
      characters={characters}
      plugins={[]}
      entryContext={null}
    />
  )

  return { project }
}

describe("EditorShell focus mode", () => {
  beforeEach(() => {
    writingEditorMock.retryRequestCount = 0

    const storageData: Record<string, string> = {}
    const localStorageMock: Storage = {
      length: 0,
      clear: () => {
        Object.keys(storageData).forEach((key) => {
          delete storageData[key]
        })
      },
      getItem: (key: string) => storageData[key] ?? null,
      key: (index: number) => Object.keys(storageData)[index] ?? null,
      removeItem: (key: string) => {
        delete storageData[key]
      },
      setItem: (key: string, value: string) => {
        storageData[key] = value
      },
    }

    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("toggles focus mode and persists the state", async () => {
    const user = userEvent.setup()
    const { project } = renderEditorShell()

    expect(screen.getByTestId("editor-focus-mode").getAttribute("data-active")).toBe("false")
    expect(screen.queryByText("文档")).not.toBeNull()

    await user.click(screen.getByRole("button", { name: "专注模式" }))

    expect(screen.getByTestId("editor-focus-mode").getAttribute("data-active")).toBe("true")
    expect(screen.queryByText("文档")).toBeNull()
    expect(readEditorSessionState(project.id).focusMode).toBe(true)

    await user.click(screen.getByRole("button", { name: "专注模式" }))

    expect(screen.getByTestId("editor-focus-mode").getAttribute("data-active")).toBe("false")
    expect(screen.queryByText("文档")).not.toBeNull()
    expect(readEditorSessionState(project.id).focusMode).toBe(false)
  })

  it("restores focus mode from session storage on mount", () => {
    window.localStorage.setItem(
      "writeteam:editor-session:project-1",
      JSON.stringify({
        focusMode: true,
        sidebarCollapsed: false,
        activeDocId: "doc-1",
        lastQuickEditInstruction: "",
      })
    )

    renderEditorShell()

    expect(screen.getByTestId("editor-focus-mode").getAttribute("data-active")).toBe("true")
    expect(screen.queryByText("文档")).toBeNull()
  })

  it("wires top banner retry to editor retry path once", async () => {
    const user = userEvent.setup()

    renderEditorShell()

    const retryButtons = screen.getAllByRole("button", { name: "立即重试" })
    expect(retryButtons).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "立即重试" }))

    expect(screen.getByText("正在重试保存...")).not.toBeNull()
    expect(screen.queryByRole("button", { name: "立即重试" })).toBeNull()
    expect(writingEditorMock.retryRequestCount).toBe(1)
  })
})
