"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"

const NODE_COLORS: Record<string, string> = {
  beat: "bg-blue-100 border-blue-300 dark:bg-blue-950 dark:border-blue-800",
  scene: "bg-green-100 border-green-300 dark:bg-green-950 dark:border-green-800",
  character: "bg-purple-100 border-purple-300 dark:bg-purple-950 dark:border-purple-800",
  location: "bg-amber-100 border-amber-300 dark:bg-amber-950 dark:border-amber-800",
  note: "bg-gray-100 border-gray-300 dark:bg-gray-900 dark:border-gray-700",
}

const NODE_TYPE_LABELS: Record<string, string> = {
  beat: "节拍",
  scene: "场景",
  character: "角色",
  location: "地点",
  note: "备注",
}

interface CanvasNodeData {
  label: string
  content?: string | null
  nodeType: string
  color?: string | null
  [key: string]: unknown
}

function CanvasNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as CanvasNodeData
  const nodeType = nodeData.nodeType || "note"
  const colorClass = NODE_COLORS[nodeType] || NODE_COLORS.note
  const typeLabel = NODE_TYPE_LABELS[nodeType] || "备注"
  const content = nodeData.content || ""

  return (
    <div
      className={`rounded-lg border-2 px-3 py-2 shadow-sm transition-shadow min-w-[160px] max-w-[280px] ${colorClass} ${
        selected ? "ring-2 ring-primary ring-offset-1 shadow-md" : ""
      }`}
      style={nodeData.color ? { borderColor: nodeData.color } : undefined}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-11 !h-11 md:!w-2.5 md:!h-2.5 !bg-transparent md:!bg-muted-foreground/50 !border-0 md:!border !border-background"
      />
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {typeLabel}
        </span>
      </div>
      <div className="text-sm font-semibold leading-tight mb-1">
        {nodeData.label}
      </div>
      {content && (
        <div className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {content}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-11 !h-11 md:!w-2.5 md:!h-2.5 !bg-transparent md:!bg-muted-foreground/50 !border-0 md:!border !border-background"
      />
    </div>
  )
}

export const CanvasNode = memo(CanvasNodeComponent)
