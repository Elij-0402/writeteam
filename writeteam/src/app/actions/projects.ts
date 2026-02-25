"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function createProject(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const genre = formData.get("genre") as string

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      title,
      description: description || null,
      genre: genre || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Create a default story bible
  await supabase.from("story_bibles").insert({
    project_id: project.id,
    user_id: user.id,
  })

  // Create a default first chapter
  await supabase.from("documents").insert({
    project_id: project.id,
    user_id: user.id,
    title: "Chapter 1",
    document_type: "chapter",
    sort_order: 0,
  })

  revalidatePath("/dashboard")
  return { data: project }
}

export async function updateProject(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const genre = formData.get("genre") as string

  const { error } = await supabase
    .from("projects")
    .update({
      title,
      description: description || null,
      genre: genre || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("user_id", user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard")
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard")
  return { success: true }
}

export async function getProjects() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: [] }
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) {
    return { error: error.message, data: [] }
  }

  return { data: data || [] }
}
