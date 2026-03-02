/* @vitest-environment jsdom */

import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { WritingEditor } from "./writing-editor"
import type { AutosaveStatus } from "./autosave-status"
import type { Document } from "@/types/database"

const tiptapMock = vi.hoisted(() => {
  const chainApi = {
    focus: () => chainApi,
    toggleBold: () => chainApi,
    toggleItalic: () => chainApi,
    toggleStrike: () => chainApi,
    toggleHeading: () => chainApi,
    toggleBulletList: () => chainApi,
    toggleOrderedList: () => chainApi,
    toggleBlockquote: () => chainApi,
    setHorizontalRule: () => chainApi,
    undo: () => chainApi,
    redo: () => chainApi,
    insertContent: () => chainApi,
    insertContentAt: () => chainApi,
    deleteRange: () => chainApi,
    run: () => true,
  }

  const editor = {
    getText: () => "测试内容",
    getJSON: () => ({ type: "doc", content: [] }),
    isActive: () => false,
    chain: () => chainApi,
    state: {
      selection: { from: 0, to: 0 },
      doc: { textBetween: () => "" },
    },
  }

  return {
    latestConfig: null as null | {
      onUpdate?: (payload: { editor: typeof editor }) => void
      onSelectionUpdate?: (payload: { editor: typeof editor }) => void
    },
    editor,
  }
})

vi.mock("@tiptap/react", () => ({
  useEditor: (config: typeof tiptapMock.latestConfig) => {
    tiptapMock.latestConfig = config
    return tiptapMock.editor
  },
  EditorContent: () => <div data-testid="editor-content" />,
}))

vi.mock("@tiptap/starter-kit", () => ({
  default: { configure: () => ({}) },
}))

vi.mock("@tiptap/extension-placeholder", () => ({
  default: { configure: () => ({}) },
}))

vi.mock("@tiptap/extension-character-count", () => ({
  default: {},
}))

vi.mock("@tiptap/extension-highlight", () => ({
  default: {},
}))

vi.mock("@tiptap/extension-typography", () => ({
  default: {},
}))

vi.mock("lucide-react", () => {
  const Icon = () => <svg aria-hidden="true" />
  return {
    Bold: Icon,
    Italic: Icon,
    Strikethrough: Icon,
    Heading1: Icon,
    Heading2: Icon,
    Heading3: Icon,
    List: Icon,
    ListOrdered: Icon,
    Quote: Icon,
    Undo: Icon,
    Redo: Icon,
    Minus: Icon,
    Loader2: Icon,
  }
})

vi.mock("@/components/editor/selection-ai-menu", () => ({
  SelectionAIMenu: () => null,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <div />,
}))

function createDocument(id = "doc-1"): Document {
  return {
    id,
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

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function renderEditor(options?: {
  document?: Document
  onUpdate?: (docId: string, updates: { content?: unknown; content_text?: string; word_count?: number }) => Promise<{
    success?: boolean
    error?: string
  }>
  onAutosaveStatusChange?: (status: AutosaveStatus) => void
}) {
  return render(
    <WritingEditor
      document={options?.document ?? createDocument()}
      projectId="project-1"
      onUpdate={
        options?.onUpdate ??
        (async () => ({
          success: true,
        }))
      }
      onSelectionChange={() => {}}
      onAutosaveStatusChange={options?.onAutosaveStatusChange}
    />
  )
}

async function triggerAutosave() {
  await act(async () => {
    tiptapMock.latestConfig?.onUpdate?.({ editor: tiptapMock.editor })
    await vi.advanceTimersByTimeAsync(1000)
  })
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe("WritingEditor autosave status", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("emits idle, saving, and saved statuses on successful autosave", async () => {
    const onAutosaveStatusChange = vi.fn<(status: AutosaveStatus) => void>()

    renderEditor({ onAutosaveStatusChange })
    await flushAsyncWork()
    await triggerAutosave()
    await flushAsyncWork()

    expect(onAutosaveStatusChange.mock.calls.map(([status]) => status)).toEqual(["idle", "saving", "saved"])
  })

  it("emits retrying status before retry save", async () => {
    const onAutosaveStatusChange = vi.fn<(status: AutosaveStatus) => void>()
    const onUpdate = vi
      .fn<(docId: string, updates: { content?: unknown; content_text?: string; word_count?: number }) => Promise<{
        success?: boolean
        error?: string
      }>>()
      .mockResolvedValueOnce({ error: "保存失败" })
      .mockResolvedValueOnce({ success: true })

    renderEditor({ onUpdate, onAutosaveStatusChange })
    await flushAsyncWork()
    await triggerAutosave()
    await flushAsyncWork()

    expect(screen.getByRole("button", { name: "立即重试" })).not.toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "立即重试" }))
    })
    await flushAsyncWork()

    expect(onAutosaveStatusChange.mock.calls.map(([status]) => status)).toEqual([
      "idle",
      "saving",
      "error",
      "retrying",
      "saving",
      "saved",
    ])
  })

  it("ignores stale save completion when older request resolves last", async () => {
    const onAutosaveStatusChange = vi.fn<(status: AutosaveStatus) => void>()
    const firstSave = createDeferred<{ success?: boolean; error?: string }>()
    const secondSave = createDeferred<{ success?: boolean; error?: string }>()
    const onUpdate = vi
      .fn<(docId: string, updates: { content?: unknown; content_text?: string; word_count?: number }) => Promise<{
        success?: boolean
        error?: string
      }>>()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise)

    renderEditor({ onUpdate, onAutosaveStatusChange })
    await flushAsyncWork()

    await triggerAutosave()
    await triggerAutosave()

    await act(async () => {
      secondSave.resolve({ success: true })
      await Promise.resolve()
    })

    await act(async () => {
      firstSave.resolve({ success: true })
      await Promise.resolve()
    })

    expect(onAutosaveStatusChange.mock.calls.map(([status]) => status)).toEqual(["idle", "saving", "saving", "saved"])
  })

  it("falls back to generic error when onUpdate throws and shows retry path", async () => {
    const onAutosaveStatusChange = vi.fn<(status: AutosaveStatus) => void>()
    const onUpdate = vi
      .fn<(docId: string, updates: { content?: unknown; content_text?: string; word_count?: number }) => Promise<{
        success?: boolean
        error?: string
      }>>()
      .mockRejectedValueOnce(new Error("network down"))

    renderEditor({ onUpdate, onAutosaveStatusChange })
    await flushAsyncWork()
    await triggerAutosave()
    await flushAsyncWork()

    expect(onAutosaveStatusChange.mock.calls.map(([status]) => status)).toEqual(["idle", "saving", "error"])
    expect(screen.getByText("保存文档失败，请检查网络后重试")).not.toBeNull()
    expect(screen.getByRole("button", { name: "立即重试" })).not.toBeNull()
  })

  it("resets autosave state and invalidates pending save when switching documents", async () => {
    const onAutosaveStatusChange = vi.fn<(status: AutosaveStatus) => void>()
    const firstSave = createDeferred<{ success?: boolean; error?: string }>()
    const onUpdate = vi
      .fn<(docId: string, updates: { content?: unknown; content_text?: string; word_count?: number }) => Promise<{
        success?: boolean
        error?: string
      }>>()
      .mockImplementationOnce(() => firstSave.promise)

    const view = renderEditor({
      document: createDocument("doc-1"),
      onUpdate,
      onAutosaveStatusChange,
    })
    await flushAsyncWork()

    await triggerAutosave()

    view.rerender(
      <WritingEditor
        document={createDocument("doc-2")}
        projectId="project-1"
        onUpdate={onUpdate}
        onSelectionChange={() => {}}
        onAutosaveStatusChange={onAutosaveStatusChange}
      />
    )
    await flushAsyncWork()

    await act(async () => {
      firstSave.resolve({ success: true })
      await Promise.resolve()
    })

    expect(onAutosaveStatusChange.mock.calls.map(([status]) => status)).toEqual(["idle", "saving", "idle"])
  })
})
