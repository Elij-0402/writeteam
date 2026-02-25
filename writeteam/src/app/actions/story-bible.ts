"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getStoryBible(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated", data: null }

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
  updates: Record<string, unknown>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("story_bibles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }
  revalidatePath(`/editor/${projectId}`)
  return { success: true }
}

export async function getCharacters(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated", data: [] }

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
  if (!user) return { error: "Not authenticated" }

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
  if (!user) return { error: "Not authenticated" }

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
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("characters")
    .delete()
    .eq("id", characterId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }
  revalidatePath(`/editor/${projectId}`)
  return { success: true }
}
