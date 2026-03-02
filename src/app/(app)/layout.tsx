import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppShell } from "@/components/layout/app-shell"
import { EditorProvider } from "@/components/editor/editor-context"
import type { Document } from "@/types/database"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Fetch all projects
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  // Fetch all documents grouped by project
  const projectIds = (projects || []).map((p) => p.id)
  const { data: allDocuments } = await supabase
    .from("documents")
    .select("*")
    .in("project_id", projectIds.length > 0 ? projectIds : ["__none__"])
    .order("sort_order", { ascending: true })

  const documentsByProject: Record<string, Document[]> = {}
  for (const doc of allDocuments || []) {
    if (!documentsByProject[doc.project_id]) {
      documentsByProject[doc.project_id] = []
    }
    documentsByProject[doc.project_id]!.push(doc)
  }

  return (
    <EditorProvider>
      <AppShell
        projects={projects || []}
        documentsByProject={documentsByProject}
        userDisplayName={
          profile?.full_name || user.email?.split("@")[0] || "用户"
        }
        userEmail={user.email || ""}
      >
        {children}
      </AppShell>
    </EditorProvider>
  )
}
