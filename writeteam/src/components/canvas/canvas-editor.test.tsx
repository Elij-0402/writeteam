/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@xyflow/react/dist/style.css", () => ({}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock("@/components/providers/ai-config-provider", () => ({
  useAIConfigContext: () => ({
    getHeaders: () => ({}),
  }),
}))

vi.mock("@/components/canvas/canvas-node", () => ({
  CanvasNode: () => null,
}))

vi.mock("@/components/canvas/node-detail-panel", () => ({
  NodeDetailPanel: () => null,
}))

vi.mock("@/components/canvas/canvas-toolbar", () => ({
  CanvasToolbar: ({ onAddNode }: { onAddNode: (type: string) => void }) => (
    <button type="button" onClick={() => onAddNode("beat")}>
      添加节点
    </button>
  ),
}))

const mockCreateCanvasNode = vi.fn()
const mockCreateCanvasEdge = vi.fn()
const mockUpdateCanvasEdge = vi.fn()
const mockDeleteCanvasEdge = vi.fn()
const mockUpdateNodePositions = vi.fn()
const mockCleanupDanglingCanvasEdges = vi.fn()

vi.mock("@/app/actions/canvas", () => ({
  createCanvasNode: (...args: unknown[]) => mockCreateCanvasNode(...args),
  updateCanvasNode: vi.fn(async () => ({ success: true })),
  deleteCanvasNode: vi.fn(async () => ({ success: true })),
  createCanvasEdge: (...args: unknown[]) => mockCreateCanvasEdge(...args),
  updateCanvasEdge: (...args: unknown[]) => mockUpdateCanvasEdge(...args),
  deleteCanvasEdge: (...args: unknown[]) => mockDeleteCanvasEdge(...args),
  updateNodePositions: (...args: unknown[]) => mockUpdateNodePositions(...args),
  cleanupDanglingCanvasEdges: (...args: unknown[]) => mockCleanupDanglingCanvasEdges(...args),
}))

vi.mock("@xyflow/react", async () => {
  const React = await import("react")

  function useNodesState(initial: unknown[]) {
    const [nodes, setNodes] = React.useState(initial)
    const onNodesChange = vi.fn()
    return [nodes, setNodes, onNodesChange]
  }

  function useEdgesState(initial: unknown[]) {
    const [edges, setEdges] = React.useState(initial)
    const onEdgesChange = vi.fn()
    return [edges, setEdges, onEdgesChange]
  }

  function addEdge(edge: Record<string, unknown>, edges: Record<string, unknown>[]) {
    return [...edges, edge]
  }

  function ReactFlow(props: Record<string, (...args: unknown[]) => unknown>) {
    return (
      <div>
        <button
          type="button"
          onClick={() => props.onConnect?.({ source: "node-1", target: "node-2" })}
        >
          触发连接
        </button>
        <button
          type="button"
          onClick={() => props.onReconnect?.({ id: "edge-1", source: "node-1", target: "node-2" }, { source: "node-1", target: "node-3" })}
        >
          触发重连
        </button>
        <button
          type="button"
          onClick={() =>
            props.onReconnectEnd?.(
              new Event("mouseup"),
              { id: "edge-1", source: "node-1", target: "node-2" },
              "source",
              { isValid: false }
            )
          }
        >
          触发无效重连结束
        </button>
      </div>
    )
  }

  return {
    ReactFlow,
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
    useNodesState,
    useEdgesState,
    addEdge,
  }
})

import { CanvasEditor } from "./canvas-editor"

const initialNodes = [
  {
    id: "node-1",
    project_id: "project-1",
    user_id: "user-1",
    node_type: "beat",
    label: "节点1",
    content: null,
    position_x: 0,
    position_y: 0,
    width: 200,
    height: 100,
    color: null,
    metadata: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  },
  {
    id: "node-2",
    project_id: "project-1",
    user_id: "user-1",
    node_type: "beat",
    label: "节点2",
    content: null,
    position_x: 10,
    position_y: 10,
    width: 200,
    height: 100,
    color: null,
    metadata: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  },
]

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateCanvasNode.mockResolvedValue({ data: { ...initialNodes[0], id: "node-new" } })
  mockCreateCanvasEdge.mockResolvedValue({ data: { id: "edge-1" } })
  mockUpdateCanvasEdge.mockResolvedValue({ success: true })
  mockDeleteCanvasEdge.mockResolvedValue({ success: true })
  mockUpdateNodePositions.mockResolvedValue({ success: true })
  mockCleanupDanglingCanvasEdges.mockResolvedValue({ deleted: 1 })
})

describe("CanvasEditor", () => {
  it("shows error and retry action when connect fails", async () => {
    const user = userEvent.setup()
    mockCreateCanvasEdge.mockResolvedValueOnce({ error: "连接节点不能为空" })

    render(
      <CanvasEditor
        projectId="project-1"
        initialNodes={initialNodes}
        initialEdges={[]}
      />
    )

    await user.click(screen.getByRole("button", { name: "触发连接" }))

    expect(screen.getByText(/连接失败：连接节点不能为空/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "重试保存" })).toBeTruthy()
  })

  it("updates edge on reconnect and shows saved feedback", async () => {
    const user = userEvent.setup()

    render(
      <CanvasEditor
        projectId="project-1"
        initialNodes={initialNodes}
        initialEdges={[]}
      />
    )

    await user.click(screen.getByRole("button", { name: "触发重连" }))

    expect(mockUpdateCanvasEdge).toHaveBeenCalledWith("project-1", "edge-1", {
      source_node_id: "node-1",
      target_node_id: "node-3",
    })
    expect(screen.getByText("连接已更新")).toBeTruthy()
  })

  it("shows dangling-edge warning and allows manual cleanup", async () => {
    const user = userEvent.setup()

    render(
      <CanvasEditor
        projectId="project-1"
        initialNodes={initialNodes}
        initialEdges={[]}
        initialEdgesWarning="检测到 1 条失效连接，已在界面中忽略，请手动执行修复。"
      />
    )

    expect(screen.getByText(/检测到 1 条失效连接/)).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "立即修复" }))

    expect(mockCleanupDanglingCanvasEdges).toHaveBeenCalledWith("project-1")
    expect(screen.getByText("已清理 1 条失效连接")).toBeTruthy()
  })
})
