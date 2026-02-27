"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import {
  hasConcurrentStoryBibleUpdate,
  sanitizeStoryBibleUpdates,
} from "@/app/actions/story-bible-guards"

export async function getStoryBible(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录", data: null }

  const { data, error } = await supabase
    .from("story_bibles")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .single()

  if (error) return { error: error.message, data: null }
  return { data }
}

export async function updateStoryBible(
  projectId: string,
  updates: Record<string, unknown>,
  expectedUpdatedAt?: string | null
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const sanitizedUpdates = sanitizeStoryBibleUpdates(updates)
  if (Object.keys(sanitizedUpdates).length === 0) {
    return { error: "没有可保存的字段" }
  }

  if (expectedUpdatedAt) {
    const { data: current, error: currentError } = await supabase
      .from("story_bibles")
      .select("updated_at")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (currentError) {
      return { error: currentError.message }
    }

    const currentUpdatedAt = current?.updated_at ?? null
    if (hasConcurrentStoryBibleUpdate(currentUpdatedAt, expectedUpdatedAt)) {
      return {
        error: "保存失败：检测到他处已更新故事圣经，请刷新后重试。",
        conflict: true,
        latestUpdatedAt: currentUpdatedAt,
      }
    }
  }

  const nextUpdatedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from("story_bibles")
    .update({ ...sanitizedUpdates, updated_at: nextUpdatedAt })
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .select("updated_at")
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/editor/${projectId}`)
  return { success: true, updatedAt: data?.updated_at ?? nextUpdatedAt }
}

export async function getCharacters(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录", data: [] }

  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createCharacter(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const name = formData.get("name") as string
  const role = formData.get("role") as string

  const { data, error } = await supabase
    .from("characters")
    .insert({
      project_id: projectId,
      user_id: user.id,
      name,
      role: role || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/editor/${projectId}`)
  return { data }
}

export async function updateCharacter(
  characterId: string,
  updates: Record<string, unknown>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const { error } = await supabase
    .from("characters")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", characterId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteCharacter(characterId: string, projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const { error } = await supabase
    .from("characters")
    .delete()
    .eq("id", characterId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }
  revalidatePath(`/editor/${projectId}`)
  return { success: true }
}
