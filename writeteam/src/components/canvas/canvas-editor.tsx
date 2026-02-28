"use client"

import { useState, useCallback, useRef, useMemo, useEffect } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type HandleType,
  type Connection,
  type FinalConnectionState,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { toast } from "sonner"
import type { CanvasNode as CanvasNodeType, CanvasEdge as CanvasEdgeType } from "@/types/database"
import { useAIConfigContext } from "@/components/providers/ai-config-provider"
import {
  createCanvasNode,
  cleanupDanglingCanvasEdges,
  updateCanvasNode,
  deleteCanvasNode,
  createCanvasEdge,
  updateCanvasEdge,
  deleteCanvasEdge,
  updateNodePositions,
} from "@/app/actions/canvas"
import { CanvasNode } from "@/components/canvas/canvas-node"
import { CanvasToolbar } from "@/components/canvas/canvas-toolbar"
import { NodeDetailPanel } from "@/components/canvas/node-detail-panel"

interface CanvasEditorProps {
  projectId: string
  initialNodes: CanvasNodeType[]
  initialEdges: CanvasEdgeType[]
  initialEdgesWarning?: string | null
  initialFocusNodeId?: string | null
}

interface GeneratedBeatPreview {
  label: string
  content: string
  type: string
}

const ALLOWED_CANVAS_NODE_TYPES = new Set(["beat", "scene", "character", "location", "note"])

function normalizeGeneratedBeat(value: unknown): GeneratedBeatPreview | null {
  if (!value || typeof value !== "object") return null
  const beat = value as { label?: unknown; content?: unknown; type?: unknown }
  const label = typeof beat.label === "string" ? beat.label.trim() : ""
  const content = typeof beat.content === "string" ? beat.content.trim() : ""
  const rawType = typeof beat.type === "string" ? beat.type.trim() : ""
  const type = rawType && ALLOWED_CANVAS_NODE_TYPES.has(rawType) ? rawType : "beat"

  if (!label || !content) return null
  return {
    label: label.slice(0, 60),
    content: content.slice(0, 500),
    type,
  }
}

function toFlowNode(n: CanvasNodeType): Node {
  return {
    id: n.id,
    type: "canvasNode",
    position: { x: n.position_x, y: n.position_y },
    data: {
      label: n.label,
      content: n.content,
      nodeType: n.node_type,
      color: n.color,
    },
    style: {
      width: n.width || undefined,
      height: n.height || undefined,
    },
  }
}

function toFlowEdge(e: CanvasEdgeType): Edge {
  return {
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    label: e.label || undefined,
    type: "default",
  }
}

export function CanvasEditor({ projectId, initialNodes, initialEdges, initialEdgesWarning, initialFocusNodeId }: CanvasEditorProps) {
  const { getHeaders } = useAIConfigContext()
  const nodeTypes: NodeTypes = useMemo(() => ({ canvasNode: CanvasNode }), [])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes.map(toFlowNode))
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges.map(toFlowEdge))
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialFocusNodeId ?? null)
  const [generating, setGenerating] = useState(false)
  const [aiPreviewBeats, setAiPreviewBeats] = useState<GeneratedBeatPreview[]>([])
  const [aiRecovery, setAiRecovery] = useState<{ message: string; outline: string } | null>(null)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [saveMessage, setSaveMessage] = useState("")
  const [pendingRetry, setPendingRetry] = useState<(() => Promise<void>) | null>(null)
  const [edgesWarning, setEdgesWarning] = useState(initialEdgesWarning ?? "")

  useEffect(() => {
    if (!initialFocusNodeId) {
      return
    }

    const exists = nodes.some((node) => node.id === initialFocusNodeId)
    if (exists) {
      setSelectedNodeId(initialFocusNodeId)
    }
  }, [initialFocusNodeId, nodes])

  // Track node counter for initial positioning of new nodes
  const nodeCountRef = useRef(initialNodes.length)

  // Debounced position save
  const positionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  const flushPositions = useCallback(() => {
    const entries = Array.from(pendingPositionsRef.current.entries())
    if (entries.length === 0) return
    const payload = entries.map(([id, pos]) => ({
      id,
      position_x: pos.x,
      position_y: pos.y,
    }))
    pendingPositionsRef.current.clear()
    setSaveStatus("saving")
    setSaveMessage("正在保存节点位置...")
    updateNodePositions(projectId, payload).then((result) => {
      if (result.error) {
        setSaveStatus("error")
        setSaveMessage(`保存失败：${result.error}`)
        setPendingRetry(() => async () => {
          flushPositions()
        })
      } else {
        setSaveStatus("saved")
        setSaveMessage("节点位置已保存")
        setPendingRetry(null)
      }
    })
  }, [projectId])

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes)

      // Collect position changes for debounced saving
      for (const change of changes) {
        if (change.type === "position" && change.position && !change.dragging) {
          pendingPositionsRef.current.set(change.id, {
            x: change.position.x,
            y: change.position.y,
          })
        }
      }

      // Check if any position change ended (dragging === false)
      const hasDragEnd = changes.some(
        (c) => c.type === "position" && c.dragging === false
      )
      if (hasDragEnd) {
        if (positionTimerRef.current) clearTimeout(positionTimerRef.current)
        positionTimerRef.current = setTimeout(flushPositions, 500)
      }
    },
    [onNodesChange, flushPositions]
  )

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return

      const result = await createCanvasEdge(projectId, {
        source_node_id: connection.source,
        target_node_id: connection.target,
      })

      if (result.error) {
        setSaveStatus("error")
        setSaveMessage(`连接失败：${result.error}`)
        setPendingRetry(() => async () => {
          await onConnect(connection)
        })
        toast.error(`连接失败: ${result.error}`)
        return
      }

      if (result.data) {
        setPendingRetry(null)
        setSaveStatus("saved")
        setSaveMessage(result.deduped ? "连接已存在，已复用" : "连接已保存")
        setEdges((eds) =>
          eds.some((edge) => edge.id === result.data!.id)
            ? eds
            : addEdge(
                {
                  ...connection,
                  id: result.data!.id,
                  type: "default",
                },
                eds
              )
        )
      }
    },
    [projectId, setEdges]
  )

  const handleAddNode = useCallback(
    async (type: string) => {
      const DEFAULT_LABELS: Record<string, string> = {
        beat: "新节拍",
        scene: "新场景",
        character: "新角色",
        location: "新地点",
        note: "新备注",
      }

      const offset = nodeCountRef.current
      const posX = 100 + (offset % 5) * 250
      const posY = 100 + Math.floor(offset / 5) * 180

      const result = await createCanvasNode(projectId, {
        node_type: type,
        label: DEFAULT_LABELS[type] || "新节点",
        position_x: posX,
        position_y: posY,
      })

      if (result.error) {
        setSaveStatus("error")
        setSaveMessage(`添加节点失败：${result.error}`)
        setPendingRetry(() => async () => {
          await handleAddNode(type)
        })
        toast.error(`添加节点失败: ${result.error}`)
        return
      }

      if (result.data) {
        nodeCountRef.current += 1
        const newNode = toFlowNode(result.data)
        setNodes((nds) => [...nds, newNode])
        setPendingRetry(null)
        setSaveStatus("saved")
        setSaveMessage("节点已保存")
        toast.success("节点已添加")
      }
    },
    [projectId, setNodes]
  )

  const handleAIGenerate = useCallback(
    async (outline: string) => {
      setGenerating(true)
      try {
        const response = await fetch("/api/ai/canvas-generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getHeaders() },
          body: JSON.stringify({ projectId, outline }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "AI 生成失败")
        }

        const data = await response.json() as { beats?: unknown }
        const normalizedBeats = Array.isArray(data.beats)
          ? data.beats.map(normalizeGeneratedBeat).filter((beat): beat is GeneratedBeatPreview => beat !== null)
          : []

        if (normalizedBeats.length === 0) {
          throw new Error("AI 未生成可采纳的节拍，请重试或调整大纲")
        }

        setAiPreviewBeats(normalizedBeats)
        setAiRecovery(null)
        toast.success(`已生成 ${normalizedBeats.length} 个节拍预览，请确认后采纳`)
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI 生成失败"
        setAiRecovery({ message, outline })
        toast.error(`${message}，可重试或切换模型后继续`) 
      } finally {
        setGenerating(false)
      }
    },
    [projectId, getHeaders]
  )

  const handleApplyPreview = useCallback(async () => {
    if (aiPreviewBeats.length === 0) {
      return
    }

    setGenerating(true)
    const createdNodeIds: string[] = []
    const createdEdgeIds: string[] = []
    try {
      const newNodes: Node[] = []
      for (let i = 0; i < aiPreviewBeats.length; i++) {
        const beat = aiPreviewBeats[i]
        const col = i % 4
        const row = Math.floor(i / 4)
        const posX = 100 + col * 280
        const posY = 100 + row * 200

        const result = await createCanvasNode(projectId, {
          node_type: beat.type,
          label: beat.label,
          content: beat.content,
          position_x: posX,
          position_y: posY,
        })

        if (result.error) {
          throw new Error(result.error)
        }

        if (result.data) {
          nodeCountRef.current += 1
          createdNodeIds.push(result.data.id)
          newNodes.push(toFlowNode(result.data))
        }
      }

      setNodes((nds) => [...nds, ...newNodes])

      const newEdges: Edge[] = []
      for (let i = 0; i < newNodes.length - 1; i++) {
        const result = await createCanvasEdge(projectId, {
          source_node_id: newNodes[i].id,
          target_node_id: newNodes[i + 1].id,
        })

        if (result.error) {
          throw new Error(result.error)
        }

        if (result.data) {
          createdEdgeIds.push(result.data.id)
          newEdges.push(toFlowEdge(result.data))
        }
      }

      if (newEdges.length > 0) {
        setEdges((eds) => {
          const existingIds = new Set(eds.map((edge) => edge.id))
          const append = newEdges.filter((edge) => !existingIds.has(edge.id))
          return [...eds, ...append]
        })
      }

      setAiPreviewBeats([])
      setAiRecovery(null)
      toast.success(`已采纳 ${newNodes.length} 个节拍节点`)
    } catch (error) {
      for (const edgeId of createdEdgeIds) {
        await deleteCanvasEdge(projectId, edgeId)
      }

      for (const nodeId of createdNodeIds) {
        await deleteCanvasNode(projectId, nodeId)
      }

      if (createdNodeIds.length > 0) {
        setNodes((nds) => nds.filter((node) => !createdNodeIds.includes(node.id)))
      }

      if (createdEdgeIds.length > 0) {
        setEdges((eds) => eds.filter((edge) => !createdEdgeIds.includes(edge.id)))
      }

      const message = error instanceof Error ? error.message : "采纳预览失败"
      setAiRecovery({ message, outline: "" })
      toast.error(`${message}，可重试采纳或继续手动编辑`)
    } finally {
      setGenerating(false)
    }
  }, [aiPreviewBeats, projectId, setNodes, setEdges])

  const handleGoToEditor = useCallback((node: { id: string; label: string; content: string | null; nodeType: string }) => {
    const params = new URLSearchParams({
      from: "canvas",
      canvasNodeId: node.id,
      canvasNodeLabel: node.label,
      canvasNodeType: node.nodeType,
    })

    if (node.content) {
      params.set("canvasNodeSummary", node.content)
    }

    window.location.assign(`/editor/${projectId}?${params.toString()}`)
  }, [projectId])

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id)
  }, [])

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [])

  const handleUpdateNode = useCallback(
    async (nodeId: string, data: Record<string, unknown>) => {
      const result = await updateCanvasNode(projectId, nodeId, data)
      if (result.error) {
        setSaveStatus("error")
        setSaveMessage(`更新失败：${result.error}`)
        setPendingRetry(() => async () => {
          await handleUpdateNode(nodeId, data)
        })
        toast.error(`更新失败: ${result.error}`)
        return
      }

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          return {
            ...n,
            data: {
              ...n.data,
              label: (data.label as string) ?? n.data.label,
              content: data.content !== undefined ? data.content : n.data.content,
              nodeType: (data.node_type as string) ?? n.data.nodeType,
              color: data.color !== undefined ? data.color : n.data.color,
            },
          }
        })
      )
      setPendingRetry(null)
      setSaveStatus("saved")
      setSaveMessage("节点已更新")
      toast.success("节点已更新")
    },
    [projectId, setNodes]
  )

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      const result = await deleteCanvasNode(projectId, nodeId)
      if (result.error) {
        setSaveStatus("error")
        setSaveMessage(`删除失败：${result.error}`)
        setPendingRetry(() => async () => {
          await handleDeleteNode(nodeId)
        })
        toast.error(`删除失败: ${result.error}`)
        return
      }

      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      )
      setSelectedNodeId(null)
      setPendingRetry(null)
      setSaveStatus("saved")
      setSaveMessage("节点已删除")
      toast.success("节点已删除")
    },
    [projectId, setNodes, setEdges]
  )

  const handleEdgesDelete = useCallback(
    async (deletedEdges: Edge[]) => {
      for (const edge of deletedEdges) {
        const result = await deleteCanvasEdge(projectId, edge.id)
        if (result.error) {
          setSaveStatus("error")
          setSaveMessage(`删除连接失败：${result.error}`)
          setPendingRetry(() => async () => {
            await handleEdgesDelete(deletedEdges)
          })
          toast.error(`删除连接失败: ${result.error}`)
          return
        }
      }
      setPendingRetry(null)
      setSaveStatus("saved")
      setSaveMessage("连接已删除")
    },
    [projectId]
  )

  const handleReconnect = useCallback(
    async (oldEdge: Edge, newConnection: Connection) => {
      if (!newConnection.source || !newConnection.target) {
        return
      }

      const result = await updateCanvasEdge(projectId, oldEdge.id, {
        source_node_id: newConnection.source,
        target_node_id: newConnection.target,
      })

      if (result.error) {
        setSaveStatus("error")
        setSaveMessage(`重连失败：${result.error}`)
        setPendingRetry(() => async () => {
          await handleReconnect(oldEdge, newConnection)
        })
        toast.error(`重连失败: ${result.error}`)
        return
      }

      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === oldEdge.id
            ? {
                ...edge,
                source: newConnection.source!,
                target: newConnection.target!,
              }
            : edge
        )
      )
      setPendingRetry(null)
      setSaveStatus("saved")
      setSaveMessage("连接已更新")
    },
    [projectId, setEdges]
  )

  const handleReconnectEnd = useCallback(
    async (
      _event: MouseEvent | TouchEvent,
      edge: Edge,
      _handleType: HandleType,
      state: FinalConnectionState
    ) => {
      if (state.isValid) return
      const result = await deleteCanvasEdge(projectId, edge.id)
      if (result.error) {
        setSaveStatus("error")
        setSaveMessage(`清理无效连接失败：${result.error}`)
        setPendingRetry(() => async () => {
          await handleReconnectEnd(_event, edge, _handleType, state)
        })
        toast.error(`清理无效连接失败: ${result.error}`)
        return
      }

      setEdges((eds) => eds.filter((current) => current.id !== edge.id))
      setPendingRetry(null)
      setSaveStatus("saved")
      setSaveMessage("无效连接已清理")
    },
    [projectId, setEdges]
  )

  const handleRetry = useCallback(async () => {
    if (!pendingRetry) return
    setSaveStatus("saving")
    setSaveMessage("正在重试...")
    await pendingRetry()
  }, [pendingRetry])

  const handleCleanupDanglingEdges = useCallback(async () => {
    setSaveStatus("saving")
    setSaveMessage("正在修复失效连接...")
    const result = await cleanupDanglingCanvasEdges(projectId)
    if (result.error) {
      setSaveStatus("error")
      setSaveMessage(`修复失败：${result.error}`)
      setPendingRetry(() => async () => {
        await handleCleanupDanglingEdges()
      })
      toast.error(`修复失败: ${result.error}`)
      return
    }

    setEdgesWarning("")
    setPendingRetry(null)
    setSaveStatus("saved")
    setSaveMessage(result.deleted && result.deleted > 0 ? `已清理 ${result.deleted} 条失效连接` : "无需修复，连接状态正常")
    if (result.deleted && result.deleted > 0) {
      setEdges((eds) =>
        eds.filter((edge) => {
          const sourceExists = nodes.some((n) => n.id === edge.source)
          const targetExists = nodes.some((n) => n.id === edge.target)
          return sourceExists && targetExists
        })
      )
    }
  }, [projectId, setEdges, nodes])

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null

  return (
    <div className="relative h-full w-full">
      <CanvasToolbar
        onAddNode={handleAddNode}
        onAIGenerate={handleAIGenerate}
        onApplyPreview={handleApplyPreview}
        onDiscardPreview={() => setAiPreviewBeats([])}
        generating={generating}
        hasPreview={aiPreviewBeats.length > 0}
        previewCount={aiPreviewBeats.length}
      />

      {aiPreviewBeats.length > 0 && (
        <div className="absolute top-14 right-3 z-10 max-w-[min(92vw,460px)] rounded-md border border-blue-200 bg-blue-50/95 p-3 text-xs text-blue-900 shadow-sm backdrop-blur-sm">
          <p className="font-medium">AI 已生成 {aiPreviewBeats.length} 个节拍预览，确认后才会写入画布。</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
            {aiPreviewBeats.map((beat, index) => (
              <li key={`${beat.label}-${index}`} className="rounded border border-blue-100 bg-white/70 px-2 py-1">
                <span className="font-medium">{index + 1}. {beat.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {aiRecovery && (
        <div className="absolute top-14 left-3 z-10 flex max-w-[min(92vw,560px)] flex-wrap items-center gap-2 rounded-md border border-rose-300 bg-rose-50/95 px-3 py-2 text-xs text-rose-900 shadow-sm backdrop-blur-sm">
          <span>AI 生成失败：{aiRecovery.message}</span>
          <button
            type="button"
            className="rounded border border-rose-400 px-2 py-0.5 hover:bg-rose-100"
            onClick={() => {
              if (aiRecovery.outline) {
                void handleAIGenerate(aiRecovery.outline)
              } else {
                void handleApplyPreview()
              }
            }}
          >
            重试
          </button>
          <button
            type="button"
            className="rounded border border-rose-400 px-2 py-0.5 hover:bg-rose-100"
            onClick={() => {
              window.location.assign("/settings")
            }}
          >
            切换模型
          </button>
          <button
            type="button"
            className="rounded border border-rose-400 px-2 py-0.5 hover:bg-rose-100"
            onClick={() => setAiRecovery(null)}
          >
            继续手动编辑
          </button>
        </div>
      )}

      {edgesWarning && (
        <div className="absolute top-14 left-3 z-10 flex max-w-[min(90vw,520px)] items-center gap-2 rounded-md border border-amber-300 bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-sm backdrop-blur-sm">
          <span>{edgesWarning}</span>
          <button
            type="button"
            className="rounded border border-amber-400 px-2 py-0.5 text-amber-900 hover:bg-amber-100"
            onClick={() => {
              void handleCleanupDanglingEdges()
            }}
          >
            立即修复
          </button>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onEdgesDelete={handleEdgesDelete}
        onReconnect={handleReconnect}
        onReconnectEnd={handleReconnectEnd}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode={["Backspace", "Delete"]}
        className="bg-background"
      >
        <Background gap={20} size={1} />
        <Controls
          showInteractive={false}
          className="!bg-background !border !shadow-sm"
        />
        <MiniMap
          nodeStrokeWidth={2}
          className="!bg-muted/50 !border !shadow-sm"
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>

      {(saveStatus === "saving" || saveStatus === "saved" || saveStatus === "error") && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm backdrop-blur-sm">
          <span
            className={
              saveStatus === "error"
                ? "text-destructive"
                : saveStatus === "saved"
                  ? "text-emerald-600"
                  : "text-muted-foreground"
            }
          >
            {saveMessage}
          </span>
          {saveStatus === "error" && pendingRetry && (
            <button
              type="button"
              className="rounded border px-2 py-0.5 text-foreground hover:bg-muted"
              onClick={() => {
                void handleRetry()
              }}
            >
              重试保存
            </button>
          )}
          {saveStatus === "error" && (
            <button
              type="button"
              className="rounded border px-2 py-0.5 text-foreground hover:bg-muted"
              onClick={() => window.location.reload()}
            >
              刷新重载
            </button>
          )}
        </div>
      )}

      {selectedNode && (
        <NodeDetailPanel
          node={{
            id: selectedNode.id,
            label: selectedNode.data.label as string,
            content: (selectedNode.data.content as string | null) || null,
            nodeType: (selectedNode.data.nodeType as string) || "note",
            color: (selectedNode.data.color as string | null) || null,
          }}
          onUpdate={handleUpdateNode}
          onDelete={handleDeleteNode}
          onGoToEditor={handleGoToEditor}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  )
}
