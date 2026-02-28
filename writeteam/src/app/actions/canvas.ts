"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Database, Json } from "@/types/database"

type CanvasNodeRow = Database["public"]["Tables"]["canvas_nodes"]["Row"]
type CanvasNodeInsert = Database["public"]["Tables"]["canvas_nodes"]["Insert"]
type CanvasNodeUpdate = Database["public"]["Tables"]["canvas_nodes"]["Update"]
type CanvasEdgeRow = Database["public"]["Tables"]["canvas_edges"]["Row"]
type CanvasEdgeInsert = Database["public"]["Tables"]["canvas_edges"]["Insert"]
type CanvasEdgeUpdate = Database["public"]["Tables"]["canvas_edges"]["Update"]

type CanvasNodeInput = {
  node_type: string
  label: string
  content?: string | null
  position_x?: number
  position_y?: number
  width?: number
  height?: number
  color?: string | null
  metadata?: Json | null
}

type CanvasNodeUpdateInput = {
  node_type?: string
  label?: string
  content?: string | null
  position_x?: number
  position_y?: number
  width?: number
  height?: number
  color?: string | null
  metadata?: Json | null
}

type CanvasEdgeInput = {
  source_node_id: string
  target_node_id: string
  label?: string | null
  edge_type?: string | null
}

type CanvasEdgeUpdateInput = {
  source_node_id?: string
  target_node_id?: string
  label?: string | null
  edge_type?: string | null
}

const ALLOWED_NODE_TYPES = new Set(["beat", "scene", "character", "location", "note"])

function normalizeText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeNodeType(value: string): string | null {
  const trimmed = value.trim()
  if (!ALLOWED_NODE_TYPES.has(trimmed)) return null
  return trimmed
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function sanitizeCanvasNodeUpdate(updates: CanvasNodeUpdateInput): { payload: CanvasNodeUpdate; error?: string } {
  const payload: CanvasNodeUpdate = { updated_at: new Date().toISOString() }

  if (updates.label !== undefined) {
    const label = normalizeText(updates.label)
    if (!label) {
      return { payload: {}, error: "参数错误：节点标题不能为空" }
    }
    payload.label = label
  }

  if (updates.content !== undefined) {
    payload.content = normalizeText(updates.content)
  }

  if (updates.node_type !== undefined) {
    const nodeType = normalizeNodeType(updates.node_type)
    if (!nodeType) {
      return { payload: {}, error: "参数错误：无效的节点类型" }
    }
    payload.node_type = nodeType
  }

  if (updates.position_x !== undefined) {
    if (!isFiniteNumber(updates.position_x)) {
      return { payload: {}, error: "参数错误：节点 X 坐标无效" }
    }
    payload.position_x = updates.position_x
  }

  if (updates.position_y !== undefined) {
    if (!isFiniteNumber(updates.position_y)) {
      return { payload: {}, error: "参数错误：节点 Y 坐标无效" }
    }
    payload.position_y = updates.position_y
  }

  if (updates.width !== undefined) {
    if (!isFiniteNumber(updates.width) || updates.width <= 0) {
      return { payload: {}, error: "参数错误：节点宽度无效" }
    }
    payload.width = updates.width
  }

  if (updates.height !== undefined) {
    if (!isFiniteNumber(updates.height) || updates.height <= 0) {
      return { payload: {}, error: "参数错误：节点高度无效" }
    }
    payload.height = updates.height
  }

  if (updates.color !== undefined) {
    payload.color = normalizeText(updates.color)
  }

  if (updates.metadata !== undefined) {
    payload.metadata = updates.metadata
  }

  const keys = Object.keys(payload)
  if (keys.length === 1 && payload.updated_at) {
    return { payload: {}, error: "没有可更新的字段" }
  }

  return { payload }
}

function sanitizeCanvasEdgeUpdate(updates: CanvasEdgeUpdateInput): { payload: CanvasEdgeUpdate; error?: string } {
  const payload: CanvasEdgeUpdate = {}

  if (updates.source_node_id !== undefined) {
    const sourceNodeId = updates.source_node_id.trim()
    if (!sourceNodeId) {
      return { payload: {}, error: "参数错误：source_node_id 不能为空" }
    }
    payload.source_node_id = sourceNodeId
  }

  if (updates.target_node_id !== undefined) {
    const targetNodeId = updates.target_node_id.trim()
    if (!targetNodeId) {
      return { payload: {}, error: "参数错误：target_node_id 不能为空" }
    }
    payload.target_node_id = targetNodeId
  }

  if (updates.label !== undefined) {
    payload.label = normalizeText(updates.label)
  }

  if (updates.edge_type !== undefined) {
    payload.edge_type = normalizeText(updates.edge_type)
  }

  if (Object.keys(payload).length === 0) {
    return { payload: {}, error: "没有可更新的字段" }
  }

  return { payload }
}

async function ensureProjectAccess(projectId: string, userId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    return { error: "读取项目失败，请稍后重试" }
  }

  if (!data) {
    return { error: "未找到项目或无权限访问" }
  }

  return {}
}

async function resolveNodePairOwnership(projectId: string, userId: string, sourceNodeId: string, targetNodeId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("canvas_nodes")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .in("id", [sourceNodeId, targetNodeId])

  if (error) {
    return { error: "读取节点失败，请稍后重试" }
  }

  const idSet = new Set((data ?? []).map((node) => node.id))
  if (!idSet.has(sourceNodeId) || !idSet.has(targetNodeId)) {
    return { error: "连接失败：存在无效节点或跨项目节点引用" }
  }

  return { error: undefined }
}

export async function getCanvasNodes(projectId: string) {
  if (!projectId.trim()) return { error: "参数错误：projectId 不能为空", data: [] as CanvasNodeRow[] }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录", data: [] as CanvasNodeRow[] }

  const access = await ensureProjectAccess(projectId, user.id)
  if (access.error) return { error: access.error, data: [] as CanvasNodeRow[] }

  const { data, error } = await supabase
    .from("canvas_nodes")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  if (error) return { error: "加载画布节点失败，请稍后重试", data: [] as CanvasNodeRow[] }
  return { data: data || ([] as CanvasNodeRow[]) }
}

export async function getCanvasEdges(projectId: string) {
  if (!projectId.trim()) return { error: "参数错误：projectId 不能为空", data: [] as CanvasEdgeRow[] }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录", data: [] as CanvasEdgeRow[] }

  const access = await ensureProjectAccess(projectId, user.id)
  if (access.error) return { error: access.error, data: [] as CanvasEdgeRow[] }

  const { data: nodeRows, error: nodeError } = await supabase
    .from("canvas_nodes")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)

  if (nodeError) {
    return { error: "加载画布连接失败，请稍后重试", data: [] as CanvasEdgeRow[] }
  }

  const nodeIdSet = new Set((nodeRows ?? []).map((node) => node.id))

  const { data, error } = await supabase
    .from("canvas_edges")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  if (error) return { error: "加载画布连接失败，请稍后重试", data: [] as CanvasEdgeRow[] }

  const validEdges: CanvasEdgeRow[] = []
  const danglingEdgeIds: string[] = []

  for (const edge of data ?? []) {
    if (nodeIdSet.has(edge.source_node_id) && nodeIdSet.has(edge.target_node_id)) {
      validEdges.push(edge)
    } else {
      danglingEdgeIds.push(edge.id)
    }
  }

  const warning =
    danglingEdgeIds.length > 0
      ? `检测到 ${danglingEdgeIds.length} 条失效连接，已在界面中忽略，请手动执行修复。`
      : undefined

  return { data: validEdges, warning }
}

export async function cleanupDanglingCanvasEdges(projectId: string) {
  if (!projectId.trim()) return { error: "参数错误：projectId 不能为空" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const access = await ensureProjectAccess(projectId, user.id)
  if (access.error) return { error: access.error }

  const { data: nodeRows, error: nodeError } = await supabase
    .from("canvas_nodes")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)

  if (nodeError) {
    return { error: "修复失败：无法读取节点" }
  }

  const nodeIdSet = new Set((nodeRows ?? []).map((node) => node.id))

  const { data: edgeRows, error: edgeError } = await supabase
    .from("canvas_edges")
    .select("id,source_node_id,target_node_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)

  if (edgeError) {
    return { error: "修复失败：无法读取连接" }
  }

  const danglingEdgeIds = (edgeRows ?? [])
    .filter((edge) => !nodeIdSet.has(edge.source_node_id) || !nodeIdSet.has(edge.target_node_id))
    .map((edge) => edge.id)

  if (danglingEdgeIds.length === 0) {
    return { deleted: 0 }
  }

  const { error: deleteError } = await supabase
    .from("canvas_edges")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .in("id", danglingEdgeIds)

  if (deleteError) {
    return { error: "修复失败：清理失效连接未成功" }
  }

  revalidatePath(`/canvas/${projectId}`)
  return { deleted: danglingEdgeIds.length }
}

export async function createCanvasNode(projectId: string, nodeData: CanvasNodeInput) {
  if (!projectId.trim()) return { error: "参数错误：projectId 不能为空" }

  const label = normalizeText(nodeData.label)
  if (!label) return { error: "参数错误：节点标题不能为空" }

  const nodeType = normalizeNodeType(nodeData.node_type)
  if (!nodeType) return { error: "参数错误：无效的节点类型" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const access = await ensureProjectAccess(projectId, user.id)
  if (access.error) return { error: access.error }

  const payload: CanvasNodeInsert = {
    project_id: projectId,
    user_id: user.id,
    node_type: nodeType,
    label,
    content: normalizeText(nodeData.content),
    position_x: isFiniteNumber(nodeData.position_x) ? nodeData.position_x : 0,
    position_y: isFiniteNumber(nodeData.position_y) ? nodeData.position_y : 0,
    width: isFiniteNumber(nodeData.width) && nodeData.width > 0 ? nodeData.width : 200,
    height: isFiniteNumber(nodeData.height) && nodeData.height > 0 ? nodeData.height : 100,
    color: normalizeText(nodeData.color),
    metadata: nodeData.metadata ?? null,
  }

  const { data, error } = await supabase
    .from("canvas_nodes")
    .insert(payload)
    .select()
    .single()

  if (error) return { error: "创建节点失败，请稍后重试" }
  revalidatePath(`/canvas/${projectId}`)
  return { data }
}

export async function updateCanvasNode(
  projectId: string,
  nodeId: string,
  updates: CanvasNodeUpdateInput
) {
  if (!projectId.trim()) return { error: "参数错误：projectId 不能为空" }
  if (!nodeId.trim()) return { error: "参数错误：nodeId 不能为空" }

  const sanitized = sanitizeCanvasNodeUpdate(updates)
  if (sanitized.error) return { error: sanitized.error }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const access = await ensureProjectAccess(projectId, user.id)
  if (access.error) return { error: access.error }

  const { error } = await supabase
    .from("canvas_nodes")
    .update(sanitized.payload)
    .eq("id", nodeId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)

  if (error) return { error: "更新节点失败，请稍后重试" }
  revalidatePath(`/canvas/${projectId}`)
  return { success: true }
}

export async function deleteCanvasNode(projectId: string, nodeId: string) {
  if (!projectId.trim()) return { error: "参数错误：projectId 不能为空" }
  if (!nodeId.trim()) return { error: "参数错误：nodeId 不能为空" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const access = await ensureProjectAccess(projectId, user.id)
  if (access.error) return { error: access.error }

  const { error } = await supabase
    .from("canvas_nodes")
    .delete()
    .eq("id", nodeId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)

  if (error) return { error: "删除节点失败，请稍后重试" }
  revalidatePath(`/canvas/${projectId}`)
  return { success: true }
}

export async function createCanvasEdge(projectId: string, edgeData: CanvasEdgeInput) {
  if (!projectId.trim()) return { error: "参数错误：projectId 不能为空" }

  const sourceNodeId = edgeData.source_node_id.trim()
  const targetNodeId = edgeData.target_node_id.trim()
  if (!sourceNodeId || !targetNodeId) {
    return { error: "参数错误：连接节点不能为空" }
  }
  if (sourceNodeId === targetNodeId) {
    return { error: "连接失败：不支持节点自连接" }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const access = await ensureProjectAccess(projectId, user.id)
  if (access.error) return { error: access.error }

  const ownershipCheck = await resolveNodePairOwnership(projectId, user.id, sourceNodeId, targetNodeId)
  if (ownershipCheck.error) return { error: ownershipCheck.error }

  const { data: existingEdge, error: existingEdgeError } = await supabase
    .from("canvas_edges")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("source_node_id", sourceNodeId)
    .eq("target_node_id", targetNodeId)
    .maybeSingle()

  if (existingEdgeError) {
    return { error: "连接失败：无法校验重复连接" }
  }

  if (existingEdge) {
    return { data: existingEdge, deduped: true }
  }

  const payload: CanvasEdgeInsert = {
    project_id: projectId,
    user_id: user.id,
    source_node_id: sourceNodeId,
    target_node_id: targetNodeId,
    label: normalizeText(edgeData.label),
    edge_type: normalizeText(edgeData.edge_type),
  }

  const { data, error } = await supabase
    .from("canvas_edges")
    .insert(payload)
    .select()
    .single()

  if (error) return { error: "创建连接失败，请稍后重试" }
  revalidatePath(`/canvas/${projectId}`)
  return { data }
}

export async function updateCanvasEdge(
  projectId: string,
  edgeId: string,
  updates: CanvasEdgeUpdateInput
) {
  if (!projectId.trim()) return { error: "参数错误：projectId 不能为空" }
  if (!edgeId.trim()) return { error: "参数错误：edgeId 不能为空" }

  const sanitized = sanitizeCanvasEdgeUpdate(updates)
  if (sanitized.error) return { error: sanitized.error }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const access = await ensureProjectAccess(projectId, user.id)
  if (access.error) return { error: access.error }

  const { data: currentEdge, error: edgeLoadError } = await supabase
    .from("canvas_edges")
    .select("source_node_id,target_node_id")
    .eq("id", edgeId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (edgeLoadError) {
    return { error: "更新连接失败，请稍后重试" }
  }

  if (!currentEdge) {
    return { error: "连接不存在或无权限访问" }
  }

  const nextSource = sanitized.payload.source_node_id ?? currentEdge.source_node_id
  const nextTarget = sanitized.payload.target_node_id ?? currentEdge.target_node_id

  if (nextSource === nextTarget) {
    return { error: "连接失败：不支持节点自连接" }
  }

  const ownershipCheck = await resolveNodePairOwnership(projectId, user.id, nextSource, nextTarget)
  if (ownershipCheck.error) return { error: ownershipCheck.error }

  const { data: duplicateEdge, error: duplicateCheckError } = await supabase
    .from("canvas_edges")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("source_node_id", nextSource)
    .eq("target_node_id", nextTarget)
    .neq("id", edgeId)
    .maybeSingle()

  if (duplicateCheckError) {
    return { error: "更新连接失败：无法校验重复连接" }
  }

  if (duplicateEdge) {
    return { error: "更新连接失败：已存在相同连接" }
  }

  const { error } = await supabase
    .from("canvas_edges")
    .update(sanitized.payload)
    .eq("id", edgeId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)

  if (error) return { error: "更新连接失败，请稍后重试" }
  revalidatePath(`/canvas/${projectId}`)
  return { success: true }
}

export async function deleteCanvasEdge(projectId: string, edgeId: string) {
  if (!projectId.trim()) return { error: "参数错误：projectId 不能为空" }
  if (!edgeId.trim()) return { error: "参数错误：edgeId 不能为空" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const access = await ensureProjectAccess(projectId, user.id)
  if (access.error) return { error: access.error }

  const { error } = await supabase
    .from("canvas_edges")
    .delete()
    .eq("id", edgeId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)

  if (error) return { error: "删除连接失败，请稍后重试" }
  revalidatePath(`/canvas/${projectId}`)
  return { success: true }
}

export async function updateNodePositions(
  projectId: string,
  nodes: Array<{ id: string; position_x: number; position_y: number }>
) {
  if (!projectId.trim()) return { error: "参数错误：projectId 不能为空" }
  if (nodes.length === 0) return { error: "参数错误：缺少需要保存的节点位置" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const access = await ensureProjectAccess(projectId, user.id)
  if (access.error) return { error: access.error }

  const dedupedMap = new Map<string, { position_x: number; position_y: number }>()
  for (const node of nodes) {
    if (!node.id.trim()) return { error: "参数错误：节点 id 不能为空" }
    if (!isFiniteNumber(node.position_x) || !isFiniteNumber(node.position_y)) {
      return { error: "参数错误：节点坐标无效" }
    }
    dedupedMap.set(node.id, { position_x: node.position_x, position_y: node.position_y })
  }

  const updates = Array.from(dedupedMap.entries()).map(([id, position]) => ({
    id,
    ...position,
  }))

  const nodeIds = updates.map((node) => node.id)
  const { data: existingNodes, error: existingNodesError } = await supabase
    .from("canvas_nodes")
    .select("id,position_x,position_y")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .in("id", nodeIds)

  if (existingNodesError) {
    return { error: "保存节点位置失败：无法读取当前节点状态" }
  }

  const existingById = new Map((existingNodes ?? []).map((node) => [node.id, node]))
  if (existingById.size !== nodeIds.length) {
    return { error: "保存节点位置失败：存在无效节点或跨项目节点" }
  }

  const results = await Promise.all(
    updates.map((node) =>
      supabase
        .from("canvas_nodes")
        .update({
          position_x: node.position_x,
          position_y: node.position_y,
          updated_at: new Date().toISOString(),
        })
        .eq("id", node.id)
        .eq("project_id", projectId)
        .eq("user_id", user.id)
    )
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) {
    const rollbackResults = await Promise.all(
      updates.map((node) => {
        const previous = existingById.get(node.id)
        return supabase
          .from("canvas_nodes")
          .update({
            position_x: previous?.position_x ?? node.position_x,
            position_y: previous?.position_y ?? node.position_y,
            updated_at: new Date().toISOString(),
          })
          .eq("id", node.id)
          .eq("project_id", projectId)
          .eq("user_id", user.id)
      })
    )

    const rollbackFailed = rollbackResults.find((r) => r.error)
    if (rollbackFailed?.error) {
      return { error: "保存节点位置失败，且自动回滚未完成，请刷新后重试" }
    }

    return { error: "保存节点位置失败，已自动回滚，请重试" }
  }

  revalidatePath(`/canvas/${projectId}`)
  return { success: true }
}
