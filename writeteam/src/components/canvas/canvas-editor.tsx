"use client"

import { useState, useCallback, useRef, useMemo } from "react"
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
  type Connection,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { toast } from "sonner"
import type { CanvasNode as CanvasNodeType, CanvasEdge as CanvasEdgeType } from "@/types/database"
import { useAIConfigContext } from "@/components/providers/ai-config-provider"
import {
  createCanvasNode,
  updateCanvasNode,
  deleteCanvasNode,
  createCanvasEdge,
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

export function CanvasEditor({ projectId, initialNodes, initialEdges }: CanvasEditorProps) {
  const { getHeaders } = useAIConfigContext()
  const nodeTypes: NodeTypes = useMemo(() => ({ canvasNode: CanvasNode }), [])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes.map(toFlowNode))
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges.map(toFlowEdge))
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

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
    updateNodePositions(payload).then((result) => {
      if (result.error) {
        console.error("Failed to save positions:", result.error)
      }
    })
  }, [])

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
        toast.error(`连接失败: ${result.error}`)
        return
      }

      if (result.data) {
        setEdges((eds) =>
          addEdge(
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
        toast.error(`添加节点失败: ${result.error}`)
        return
      }

      if (result.data) {
        nodeCountRef.current += 1
        const newNode = toFlowNode(result.data)
        setNodes((nds) => [...nds, newNode])
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

        const { beats } = await response.json()

        if (!Array.isArray(beats) || beats.length === 0) {
          toast.error("AI 未生成任何节拍")
          return
        }

        // Create nodes in sequence to avoid race conditions, auto-layout in grid
        const newNodes: Node[] = []
        for (let i = 0; i < beats.length; i++) {
          const beat = beats[i]
          const col = i % 4
          const row = Math.floor(i / 4)
          const posX = 100 + col * 280
          const posY = 100 + row * 200

          const result = await createCanvasNode(projectId, {
            node_type: beat.type || "beat",
            label: beat.label,
            content: beat.content || null,
            position_x: posX,
            position_y: posY,
          })

          if (result.data) {
            nodeCountRef.current += 1
            newNodes.push(toFlowNode(result.data))
          }
        }

        setNodes((nds) => [...nds, ...newNodes])

        // Auto-connect beats sequentially
        for (let i = 0; i < newNodes.length - 1; i++) {
          const result = await createCanvasEdge(projectId, {
            source_node_id: newNodes[i].id,
            target_node_id: newNodes[i + 1].id,
          })
          if (result.data) {
            setEdges((eds) => [
              ...eds,
              toFlowEdge(result.data!),
            ])
          }
        }

        toast.success(`已生成 ${newNodes.length} 个节拍节点`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "AI 生成失败")
      } finally {
        setGenerating(false)
      }
    },
    [projectId, setNodes, setEdges, getHeaders]
  )

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id)
  }, [])

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [])

  const handleUpdateNode = useCallback(
    async (nodeId: string, data: Record<string, unknown>) => {
      const result = await updateCanvasNode(nodeId, data)
      if (result.error) {
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
      toast.success("节点已更新")
    },
    [setNodes]
  )

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      const result = await deleteCanvasNode(nodeId)
      if (result.error) {
        toast.error(`删除失败: ${result.error}`)
        return
      }

      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      )
      setSelectedNodeId(null)
      toast.success("节点已删除")
    },
    [setNodes, setEdges]
  )

  const handleEdgesDelete = useCallback(
    async (deletedEdges: Edge[]) => {
      for (const edge of deletedEdges) {
        await deleteCanvasEdge(edge.id)
      }
    },
    []
  )

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null

  return (
    <div className="relative h-full w-full">
      <CanvasToolbar
        onAddNode={handleAddNode}
        onAIGenerate={handleAIGenerate}
        generating={generating}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onEdgesDelete={handleEdgesDelete}
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
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  )
}
