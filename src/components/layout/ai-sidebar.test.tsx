/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AISidebar } from "./ai-sidebar"

// Capture props passed to AIChatPanel
const chatPanelProps = vi.fn()

// Mock sidebar components to avoid needing SidebarProvider context
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({
    children,
    side,
    collapsible,
    className,
  }: {
    children: React.ReactNode
    side?: string
    collapsible?: string
    className?: string
  }) => (
    <div
      data-testid="sidebar"
      data-side={side}
      data-collapsible={collapsible}
      className={className}
    >
      {children}
    </div>
  ),
  SidebarHeader: ({
    children,
    ...props
  }: {
    children: React.ReactNode
    className?: string
  }) => (
    <div data-testid="sidebar-header" {...props}>
      {children}
    </div>
  ),
  SidebarContent: ({
    children,
    ...props
  }: {
    children: React.ReactNode
    className?: string
  }) => (
    <div data-testid="sidebar-content" {...props}>
      {children}
    </div>
  ),
}))

// Mock AIChatPanel to capture props
vi.mock("@/components/ai/ai-chat-panel", () => ({
  AIChatPanel: (props: Record<string, unknown>) => {
    chatPanelProps(props)
    return <div data-testid="ai-chat-panel" />
  },
}))

afterEach(() => {
  cleanup()
  chatPanelProps.mockClear()
})

const defaultProps = {
  projectId: "proj-1",
  documentId: "doc-1",
  documentContent: "Some content here",
  onInsertToEditor: vi.fn(),
  hasStyleSample: true,
}

describe("AISidebar", () => {
  it("renders the 'AI 助手' title", () => {
    render(<AISidebar {...defaultProps} />)
    expect(screen.getByText("AI 助手")).toBeTruthy()
  })

  it("renders as a right sidebar", () => {
    render(<AISidebar {...defaultProps} />)
    const sidebar = screen.getByTestId("sidebar")
    expect(sidebar.getAttribute("data-side")).toBe("right")
  })

  it("uses offcanvas collapsible mode", () => {
    render(<AISidebar {...defaultProps} />)
    const sidebar = screen.getByTestId("sidebar")
    expect(sidebar.getAttribute("data-collapsible")).toBe("offcanvas")
  })

  it("passes all props through to AIChatPanel", () => {
    const onInsert = vi.fn()
    render(
      <AISidebar
        projectId="proj-abc"
        documentId="doc-xyz"
        documentContent="Hello world"
        onInsertToEditor={onInsert}
        hasStyleSample={false}
      />
    )
    expect(chatPanelProps).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-abc",
        documentId: "doc-xyz",
        documentContent: "Hello world",
        onInsertToEditor: onInsert,
        hasStyleSample: false,
      })
    )
  })

  it("renders AIChatPanel inside sidebar content", () => {
    render(<AISidebar {...defaultProps} />)
    const content = screen.getByTestId("sidebar-content")
    const chatPanel = screen.getByTestId("ai-chat-panel")
    expect(content.contains(chatPanel)).toBe(true)
  })

  it("passes null documentId correctly", () => {
    render(<AISidebar {...defaultProps} documentId={null} />)
    expect(chatPanelProps).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: null,
      })
    )
  })
})
