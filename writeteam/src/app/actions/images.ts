"use server"

import { createClient } from "@/lib/supabase/server"

export async function getImages(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录", data: [] }

  const { data, error } = await supabase
    .from("images")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function deleteImage(imageId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "未登录" }

  const { error } = await supabase
    .from("images")
    .delete()
    .eq("id", imageId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }
  return { success: true }
}
