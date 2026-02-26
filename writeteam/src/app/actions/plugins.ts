"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getPlugins(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录", data: [] }

  const { data, error } = await supabase
    .from("plugins")
    .select("*")
    .eq("user_id", user.id)
    .or(`project_id.eq.${projectId},project_id.is.null`)
    .order("sort_order", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createPlugin(data: {
  projectId: string | null
  name: string
  description: string
  systemPrompt: string
  userPromptTemplate: string
  requiresSelection: boolean
  maxTokens: number
  temperature: number
  icon: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const { data: plugin, error } = await supabase
    .from("plugins")
    .insert({
      user_id: user.id,
      project_id: data.projectId,
      name: data.name,
      description: data.description || null,
      system_prompt: data.systemPrompt,
      user_prompt_template: data.userPromptTemplate,
      requires_selection: data.requiresSelection,
      max_tokens: data.maxTokens,
      temperature: data.temperature,
      icon: data.icon || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  if (data.projectId) {
    revalidatePath(`/editor/${data.projectId}`)
  }
  return { data: plugin }
}

export async function updatePlugin(
  id: string,
  updates: {
    name?: string
    description?: string
    systemPrompt?: string
    userPromptTemplate?: string
    requiresSelection?: boolean
    maxTokens?: number
    temperature?: number
    icon?: string
    sortOrder?: number
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const dbUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.description !== undefined) dbUpdates.description = updates.description
  if (updates.systemPrompt !== undefined) dbUpdates.system_prompt = updates.systemPrompt
  if (updates.userPromptTemplate !== undefined) dbUpdates.user_prompt_template = updates.userPromptTemplate
  if (updates.requiresSelection !== undefined) dbUpdates.requires_selection = updates.requiresSelection
  if (updates.maxTokens !== undefined) dbUpdates.max_tokens = updates.maxTokens
  if (updates.temperature !== undefined) dbUpdates.temperature = updates.temperature
  if (updates.icon !== undefined) dbUpdates.icon = updates.icon
  if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder

  const { error } = await supabase
    .from("plugins")
    .update(dbUpdates)
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deletePlugin(id: string, projectId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const { error } = await supabase
    .from("plugins")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return { error: error.message }
  if (projectId) {
    revalidatePath(`/editor/${projectId}`)
  }
  return { success: true }
}
