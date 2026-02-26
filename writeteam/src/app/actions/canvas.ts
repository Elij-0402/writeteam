"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Json } from "@/types/database"

export async function getCanvasNodes(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录", data: [] }

  const { data, error } = await supabase
    .from("canvas_nodes")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function getCanvasEdges(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录", data: [] }

  const { data, error } = await supabase
    .from("canvas_edges")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createCanvasNode(
  projectId: string,
  nodeData: {
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
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const { data, error } = await supabase
    .from("canvas_nodes")
    .insert({
      project_id: projectId,
      user_id: user.id,
      node_type: nodeData.node_type,
      label: nodeData.label,
      content: nodeData.content ?? null,
      position_x: nodeData.position_x ?? 0,
      position_y: nodeData.position_y ?? 0,
      width: nodeData.width ?? 200,
      height: nodeData.height ?? 100,
      color: nodeData.color ?? null,
      metadata: nodeData.metadata ?? null,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/canvas/${projectId}`)
  return { data }
}

export async function updateCanvasNode(
  nodeId: string,
  updates: Record<string, unknown>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const { error } = await supabase
    .from("canvas_nodes")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", nodeId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteCanvasNode(nodeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const { error } = await supabase
    .from("canvas_nodes")
    .delete()
    .eq("id", nodeId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function createCanvasEdge(
  projectId: string,
  edgeData: {
    source_node_id: string
    target_node_id: string
    label?: string | null
    edge_type?: string | null
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const { data, error } = await supabase
    .from("canvas_edges")
    .insert({
      project_id: projectId,
      user_id: user.id,
      source_node_id: edgeData.source_node_id,
      target_node_id: edgeData.target_node_id,
      label: edgeData.label ?? null,
      edge_type: edgeData.edge_type ?? null,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/canvas/${projectId}`)
  return { data }
}

export async function deleteCanvasEdge(edgeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const { error } = await supabase
    .from("canvas_edges")
    .delete()
    .eq("id", edgeId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateNodePositions(
  nodes: Array<{ id: string; position_x: number; position_y: number }>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const results = await Promise.all(
    nodes.map((node) =>
      supabase
        .from("canvas_nodes")
        .update({
          position_x: node.position_x,
          position_y: node.position_y,
          updated_at: new Date().toISOString(),
        })
        .eq("id", node.id)
        .eq("user_id", user.id)
    )
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) return { error: failed.error.message }
  return { success: true }
}
