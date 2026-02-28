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
  NodeDetailPanel: ({
    node,
    onGoToEditor,
  }: {
    node: { id: string; label: string; nodeType: string; content: string | null }
    onGoToEditor?: (node: { id: string; label: string; nodeType: string; content: string | null }) => void
  }) => (
    <div>
      <div>详情:{node.id}:{node.label}</div>
      {onGoToEditor && (
        <button
          type="button"
          onClick={() => onGoToEditor(node)}
        >
          去写作
        </button>
      )}
    </div>
  ),
}))

vi.mock("@/components/canvas/canvas-toolbar", () => ({
  CanvasToolbar: ({
    onAddNode,
    onAIGenerate,
    onApplyPreview,
    onDiscardPreview,
    hasPreview,
    previewCount,
  }: {
    onAddNode: (type: string) => void
    onAIGenerate: (outline: string) => Promise<void>
    onApplyPreview: () => Promise<void>
    onDiscardPreview: () => void
    hasPreview: boolean
    previewCount: number
  }) => (
    <div>
      <button type="button" onClick={() => onAddNode("beat")}>
        添加节点
      </button>
      <button
        type="button"
        onClick={() => {
          void onAIGenerate("这是一个足够长的大纲内容，包含冲突与转折。")
        }}
      >
        触发AI生成
      </button>
      <button
        type="button"
        onClick={() => {
          void onApplyPreview()
        }}
      >
        采纳预览
      </button>
      <button type="button" onClick={onDiscardPreview}>
        丢弃预览
      </button>
      <span>预览数:{hasPreview ? previewCount : 0}</span>
    </div>
  ),
}))

const mockCreateCanvasNode = vi.fn()
const mockCreateCanvasEdge = vi.fn()
const mockDeleteCanvasNode = vi.fn()
const mockUpdateCanvasEdge = vi.fn()
const mockDeleteCanvasEdge = vi.fn()
const mockUpdateNodePositions = vi.fn()
const mockCleanupDanglingCanvasEdges = vi.fn()

vi.mock("@/app/actions/canvas", () => ({
  createCanvasNode: (...args: unknown[]) => mockCreateCanvasNode(...args),
  updateCanvasNode: vi.fn(async () => ({ success: true })),
  deleteCanvasNode: (...args: unknown[]) => mockDeleteCanvasNode(...args),
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
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({
      beats: [
        { label: "开场", content: "主角收到神秘来信", type: "beat" },
        { label: "冲突", content: "主角被迫做出选择", type: "beat" },
      ],
    }),
  })))
  mockCreateCanvasNode.mockResolvedValue({ data: { ...initialNodes[0], id: "node-new" } })
  mockCreateCanvasEdge.mockResolvedValue({ data: { id: "edge-1" } })
  mockDeleteCanvasNode.mockResolvedValue({ success: true })
  mockUpdateCanvasEdge.mockResolvedValue({ success: true })
  mockDeleteCanvasEdge.mockResolvedValue({ success: true })
  mockUpdateNodePositions.mockResolvedValue({ success: true })
  mockCleanupDanglingCanvasEdges.mockResolvedValue({ deleted: 1 })
})

afterEach(() => {
  vi.unstubAllGlobals()
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

  it("keeps AI beats in preview before applying", async () => {
    const user = userEvent.setup()
    mockCreateCanvasNode
      .mockResolvedValueOnce({ data: { ...initialNodes[0], id: "node-ai-1" } })
      .mockResolvedValueOnce({ data: { ...initialNodes[1], id: "node-ai-2" } })

    render(
      <CanvasEditor
        projectId="project-1"
        initialNodes={initialNodes}
        initialEdges={[]}
      />
    )

    await user.click(screen.getByRole("button", { name: "触发AI生成" }))
    expect(screen.getByText("预览数:2")).toBeTruthy()
    expect(mockCreateCanvasNode).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "采纳预览" }))

    expect(mockCreateCanvasNode).toHaveBeenCalledTimes(2)
    expect(mockCreateCanvasEdge).toHaveBeenCalledWith("project-1", {
      source_node_id: "node-ai-1",
      target_node_id: "node-ai-2",
    })
  })

  it("falls back unsupported AI node type to beat", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        beats: [{ label: "异常类型", content: "测试内容", type: "unsupported" }],
      }),
    })))

    render(
      <CanvasEditor
        projectId="project-1"
        initialNodes={initialNodes}
        initialEdges={[]}
      />
    )

    await user.click(screen.getByRole("button", { name: "触发AI生成" }))
    await user.click(screen.getByRole("button", { name: "采纳预览" }))

    expect(mockCreateCanvasNode).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({ node_type: "beat" })
    )
  })

  it("rolls back created nodes when apply preview fails midway", async () => {
    const user = userEvent.setup()
    mockCreateCanvasNode
      .mockResolvedValueOnce({ data: { ...initialNodes[0], id: "node-ai-1" } })
      .mockRejectedValueOnce(new Error("落库失败"))

    render(
      <CanvasEditor
        projectId="project-1"
        initialNodes={initialNodes}
        initialEdges={[]}
      />
    )

    await user.click(screen.getByRole("button", { name: "触发AI生成" }))
    await user.click(screen.getByRole("button", { name: "采纳预览" }))

    expect(mockDeleteCanvasNode).toHaveBeenCalledWith("project-1", "node-ai-1")
  })

  it("shows recovery actions when AI generation fails", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: "AI 服务暂时不可用" }),
    })))

    render(
      <CanvasEditor
        projectId="project-1"
        initialNodes={initialNodes}
        initialEdges={[]}
      />
    )

    await user.click(screen.getByRole("button", { name: "触发AI生成" }))
    expect(screen.getByText(/AI 生成失败：AI 服务暂时不可用/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "重试" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "切换模型" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "继续手动编辑" })).toBeTruthy()
  })

  it("restores focused node from canvas-editor context", () => {
    render(
      <CanvasEditor
        projectId="project-1"
        initialNodes={initialNodes}
        initialEdges={[]}
        initialFocusNodeId="node-2"
      />
    )

    expect(screen.getByText("详情:node-2:节点2")).toBeTruthy()
  })

})
