"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Json } from "@/types/database"

export async function getDocuments(projectId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "未登录", data: [] }
  }

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    return { error: "读取文档失败，请稍后重试", data: [] }
  }

  return { data: data || [] }
}

export async function getDocument(documentId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "未登录", data: null }
  }

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .single()

  if (error) {
    return { error: "读取文档失败，请稍后重试", data: null }
  }

  return { data }
}

export async function createDocument(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "未登录" }
  }

  const title = formData.get("title") as string
  const documentType = (formData.get("documentType") as string) || "chapter"

  // Get the next sort order
  const { data: existing } = await supabase
    .from("documents")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

  const { data, error } = await supabase
    .from("documents")
    .insert({
      project_id: projectId,
      user_id: user.id,
      title,
      document_type: documentType as 'chapter' | 'scene' | 'note' | 'draft',
      sort_order: nextOrder,
    })
    .select()
    .single()

  if (error) {
    return { error: "创建文档失败，请检查网络后重试" }
  }

  revalidatePath(`/editor/${projectId}`)
  return { data }
}

export async function updateDocument(
  documentId: string,
  updates: {
    title?: string
    content?: Json | null
    content_text?: string
    word_count?: number
  }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "未登录" }
  }

  const { error } = await supabase
    .from("documents")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .eq("user_id", user.id)

  if (error) {
    return { error: "保存文档失败，请检查网络后重试" }
  }

  return { success: true }
}

export async function deleteDocument(documentId: string, projectId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "未登录" }
  }

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", user.id)

  if (error) {
    return { error: "删除文档失败，请检查网络后重试" }
  }

  revalidatePath(`/editor/${projectId}`)
  return { success: true }
}

export async function reorderDocuments(projectId: string, orderedDocumentIds: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "未登录" }
  }

  if (!projectId || !Array.isArray(orderedDocumentIds) || orderedDocumentIds.length === 0) {
    return { error: "排序参数无效，请刷新后重试" }
  }

  const uniqueOrderedIds = new Set(orderedDocumentIds)
  if (uniqueOrderedIds.size !== orderedDocumentIds.length) {
    return { error: "排序参数包含重复项，请刷新后重试" }
  }

  const { data: docs, error: docsError } = await supabase
    .from("documents")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)

  if (docsError) {
    return { error: "读取文档列表失败，请稍后重试" }
  }

  const ownedIds = new Set((docs || []).map((doc) => doc.id))

  if (ownedIds.size !== orderedDocumentIds.length || orderedDocumentIds.some((id) => !ownedIds.has(id))) {
    return { error: "排序范围无效，请刷新后重试" }
  }

  const { error: reorderError } = await supabase.rpc("reorder_documents", {
    p_project_id: projectId,
    p_user_id: user.id,
    p_ordered_document_ids: orderedDocumentIds,
  })

  if (reorderError) {
    return { error: "保存排序失败，请检查网络后重试" }
  }

  revalidatePath(`/editor/${projectId}`)
  return { success: true }
}
