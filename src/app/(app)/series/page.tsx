import { createClient } from "@/lib/supabase/server"
import { SeriesListContent } from "@/components/series/series-list-content"

export default async function SeriesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Auth is already enforced by the (app) layout, but we need
  // the user ID to fetch series data. If somehow null, return empty.
  if (!user) return null

  const { data: seriesList } = await supabase
    .from("series")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  // Get project counts for each series
  const { data: projects } = await supabase
    .from("projects")
    .select("id, series_id")
    .eq("user_id", user.id)
    .not("series_id", "is", null)

  const projectCountMap: Record<string, number> = {}
  if (projects) {
    for (const project of projects) {
      if (project.series_id) {
        projectCountMap[project.series_id] =
          (projectCountMap[project.series_id] || 0) + 1
      }
    }
  }

  return (
    <SeriesListContent
      seriesList={seriesList || []}
      projectCountMap={projectCountMap}
    />
  )
}
