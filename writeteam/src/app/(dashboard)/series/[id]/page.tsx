import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { SeriesDetailContent } from "@/components/series/series-detail-content"

interface SeriesDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function SeriesDetailPage({
  params,
}: SeriesDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: series } = await supabase
    .from("series")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (!series) {
    notFound()
  }

  const { data: seriesProjects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .eq("series_id", id)
    .order("updated_at", { ascending: false })

  const { data: allProjects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .is("series_id", null)
    .order("title", { ascending: true })

  const { data: seriesBible } = await supabase
    .from("series_bibles")
    .select("*")
    .eq("series_id", id)
    .eq("user_id", user.id)
    .single()

  return (
    <SeriesDetailContent
      series={series}
      seriesProjects={seriesProjects || []}
      availableProjects={allProjects || []}
      seriesBible={seriesBible}
    />
  )
}
