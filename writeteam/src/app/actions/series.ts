"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getSeries() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "未登录", data: [] }
  }

  const { data, error } = await supabase
    .from("series")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) {
    return { error: error.message, data: [] }
  }

  return { data: data || [] }
}

export async function createSeries(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "未登录" }
  }

  const title = formData.get("title") as string
  const description = formData.get("description") as string

  const { data: series, error } = await supabase
    .from("series")
    .insert({
      user_id: user.id,
      title,
      description: description || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Create a default series bible
  await supabase.from("series_bibles").insert({
    series_id: series.id,
    user_id: user.id,
  })

  revalidatePath("/series")
  return { data: series }
}

export async function updateSeries(
  id: string,
  updates: Record<string, unknown>
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "未登录" }
  }

  const { error } = await supabase
    .from("series")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/series")
  revalidatePath(`/series/${id}`)
  return { success: true }
}

export async function deleteSeries(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "未登录" }
  }

  const { error } = await supabase
    .from("series")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/series")
  return { success: true }
}

export async function addProjectToSeries(
  projectId: string,
  seriesId: string
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "未登录" }
  }

  const { error } = await supabase
    .from("projects")
    .update({
      series_id: seriesId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("user_id", user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/series")
  revalidatePath(`/series/${seriesId}`)
  revalidatePath("/dashboard")
  return { success: true }
}

export async function removeProjectFromSeries(projectId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "未登录" }
  }

  const { error } = await supabase
    .from("projects")
    .update({
      series_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("user_id", user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/series")
  revalidatePath("/dashboard")
  return { success: true }
}

export async function getSeriesBible(seriesId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "未登录", data: null }
  }

  const { data, error } = await supabase
    .from("series_bibles")
    .select("*")
    .eq("series_id", seriesId)
    .eq("user_id", user.id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data }
}

export async function updateSeriesBible(
  seriesId: string,
  updates: Record<string, unknown>
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "未登录" }
  }

  // Try update first
  const { data: existing } = await supabase
    .from("series_bibles")
    .select("id")
    .eq("series_id", seriesId)
    .eq("user_id", user.id)
    .single()

  if (existing) {
    const { error } = await supabase
      .from("series_bibles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("series_id", seriesId)
      .eq("user_id", user.id)

    if (error) {
      return { error: error.message }
    }
  } else {
    const { error } = await supabase
      .from("series_bibles")
      .insert({
        series_id: seriesId,
        user_id: user.id,
        ...updates,
      })

    if (error) {
      return { error: error.message }
    }
  }

  revalidatePath(`/series/${seriesId}`)
  return { success: true }
}
