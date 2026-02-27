"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import {
  buildCharacterCreateInput,
  hasConcurrentStoryBibleUpdate,
  mapCharacterMutationError,
  sanitizeCharacterUpdates,
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

  const payload = buildCharacterCreateInput(formData)
  if (!payload) {
    return { error: "创建失败：请填写角色姓名（必填）并补全必要信息后重试。" }
  }

  const { data: existingNameConflict } = await supabase
    .from("characters")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("name", payload.name)
    .maybeSingle()

  if (existingNameConflict) {
    return { error: "创建失败：存在同名角色，请调整名称后再保存。" }
  }

  const { data, error } = await supabase
    .from("characters")
    .insert({
      project_id: projectId,
      user_id: user.id,
      ...payload,
    })
    .select()
    .single()

  if (error) return { error: mapCharacterMutationError(error.message) }
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

  const sanitizedUpdates = sanitizeCharacterUpdates(updates)
  if (Object.keys(sanitizedUpdates).length === 0) {
    return { error: "保存失败：没有可更新的角色字段。" }
  }

  if (typeof sanitizedUpdates.name === "string") {
    const trimmedName = sanitizedUpdates.name.trim()
    if (!trimmedName) {
      return { error: "保存失败：角色姓名不能为空。" }
    }
    sanitizedUpdates.name = trimmedName
  }

  if (typeof sanitizedUpdates.role === "string") {
    const trimmedRole = sanitizedUpdates.role.trim()
    sanitizedUpdates.role = trimmedRole.length > 0 ? trimmedRole : null
  }

  const { data: existingCharacter, error: existingCharacterError } = await supabase
    .from("characters")
    .select("project_id")
    .eq("id", characterId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (existingCharacterError) {
    return { error: mapCharacterMutationError(existingCharacterError.message) }
  }

  if (!existingCharacter?.project_id) {
    return { error: "保存失败：未找到可更新的角色，请刷新后重试。" }
  }

  if (typeof sanitizedUpdates.name === "string") {
    const { data: duplicatedName, error: duplicateCheckError } = await supabase
      .from("characters")
      .select("id")
      .eq("project_id", existingCharacter.project_id)
      .eq("user_id", user.id)
      .eq("name", sanitizedUpdates.name)
      .neq("id", characterId)
      .maybeSingle()

    if (duplicateCheckError) {
      return { error: mapCharacterMutationError(duplicateCheckError.message) }
    }

    if (duplicatedName) {
      return { error: "保存失败：存在同名角色，请修改角色名称后重试。" }
    }
  }

  const { data, error } = await supabase
    .from("characters")
    .update({ ...sanitizedUpdates, updated_at: new Date().toISOString() })
    .eq("id", characterId)
    .eq("user_id", user.id)
    .select("project_id")
    .maybeSingle()

  if (error) return { error: mapCharacterMutationError(error.message) }
  if (!data?.project_id) {
    return { error: "保存失败：未找到可更新的角色，请刷新后重试。" }
  }

  revalidatePath(`/editor/${data.project_id}`)
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

  if (error) return { error: mapCharacterMutationError(error.message) }
  revalidatePath(`/editor/${projectId}`)
  return { success: true }
}
