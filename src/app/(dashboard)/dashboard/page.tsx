import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardContent } from "@/components/dashboard/dashboard-content"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  // Query document counts per project
  const projectIds = (projects || []).map((p) => p.id)
  const documentCounts: Record<string, number> = {}

  if (projectIds.length > 0) {
    const { data: documents } = await supabase
      .from("documents")
      .select("project_id")
      .in("project_id", projectIds)

    documents?.forEach((d) => {
      documentCounts[d.project_id] = (documentCounts[d.project_id] || 0) + 1
    })
  }

  return (
    <DashboardContent
      projects={projects || []}
      user={user}
      profile={profile}
      documentCounts={documentCounts}
    />
  )
}
