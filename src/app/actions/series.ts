"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const ALLOWED_SERIES_UPDATE_FIELDS = ["title", "description"] as const
const ALLOWED_SERIES_BIBLE_UPDATE_FIELDS = [
  "genre",
  "style",
  "themes",
  "setting",
  "worldbuilding",
  "notes",
] as const

type SeriesUpdateField = (typeof ALLOWED_SERIES_UPDATE_FIELDS)[number]
type SeriesBibleUpdateField = (typeof ALLOWED_SERIES_BIBLE_UPDATE_FIELDS)[number]

function isSeriesUpdateField(key: string): key is SeriesUpdateField {
  return (ALLOWED_SERIES_UPDATE_FIELDS as readonly string[]).includes(key)
}

function isSeriesBibleUpdateField(key: string): key is SeriesBibleUpdateField {
  return (ALLOWED_SERIES_BIBLE_UPDATE_FIELDS as readonly string[]).includes(key)
}

function sanitizeSeriesUpdates(updates: Record<string, unknown>) {
  const filteredEntries = Object.entries(updates).filter(([key]) => isSeriesUpdateField(key))
  return Object.fromEntries(filteredEntries)
}

function sanitizeSeriesBibleUpdates(updates: Record<string, unknown>) {
  const filteredEntries = Object.entries(updates).filter(([key]) => isSeriesBibleUpdateField(key))
  return Object.fromEntries(filteredEntries)
}

async function hasSeriesAccess(
  seriesId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const { data, error } = await supabase
    .from("series")
    .select("id")
    .eq("id", seriesId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    return false
  }

  return Boolean(data?.id)
}

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

  const sanitizedUpdates = sanitizeSeriesUpdates(updates)
  if (Object.keys(sanitizedUpdates).length === 0) {
    return { error: "保存失败：没有可更新的系列字段。" }
  }

  const { error } = await supabase
    .from("series")
    .update({ ...sanitizedUpdates, updated_at: new Date().toISOString() })
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

  const hasAccess = await hasSeriesAccess(seriesId, user.id, supabase)
  if (!hasAccess) {
    return { error: "操作失败：该系列不存在或无权限访问，请刷新后重试。" }
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

  const hasAccess = await hasSeriesAccess(seriesId, user.id, supabase)
  if (!hasAccess) {
    return { error: "操作失败：该系列不存在或无权限访问，请刷新后重试。", data: null }
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

  const sanitizedUpdates = sanitizeSeriesBibleUpdates(updates)
  if (Object.keys(sanitizedUpdates).length === 0) {
    return { error: "保存失败：没有可更新的系列设定字段。" }
  }

  const hasAccess = await hasSeriesAccess(seriesId, user.id, supabase)
  if (!hasAccess) {
    return { error: "操作失败：该系列不存在或无权限访问，请刷新后重试。" }
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
      .update({ ...sanitizedUpdates, updated_at: new Date().toISOString() })
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
        ...sanitizedUpdates,
      })

    if (error) {
      return { error: error.message }
    }
  }

  revalidatePath(`/series/${seriesId}`)
  return { success: true }
}
