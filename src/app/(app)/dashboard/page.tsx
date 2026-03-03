import { redirect } from "next/navigation"
import { DashboardTaskConsole } from "@/components/dashboard/dashboard-task-console"
import { deriveShellUXState, type ShellUXDocument, type ShellUXProjectWithDocuments } from "@/lib/dashboard/shell-ux-state"
import { createClient } from "@/lib/supabase/server"

interface DashboardProjectRow {
  id: string
}

interface DashboardDocumentRow {
  id: string
  project_id: string
  title: string
  updated_at: string
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: projectsData } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  const projects: DashboardProjectRow[] = projectsData ?? []
  const projectIds = projects.map((project) => project.id)

  const { data: documentsData } = await supabase
    .from("documents")
    .select("id, project_id, title, updated_at")
    .in("project_id", projectIds.length > 0 ? projectIds : ["__none__"])
    .order("updated_at", { ascending: false })

  const documents: DashboardDocumentRow[] = documentsData ?? []
  const documentsByProject = new Map<string, ShellUXDocument[]>()

  for (const document of documents) {
    const existing = documentsByProject.get(document.project_id)
    const shellDocument: ShellUXDocument = {
      id: document.id,
      title: document.title,
      updatedAt: document.updated_at,
    }

    if (!existing) {
      documentsByProject.set(document.project_id, [shellDocument])
      continue
    }

    existing.push(shellDocument)
  }

  const shellProjects: ShellUXProjectWithDocuments[] = projects.map((project) => ({
    projectId: project.id,
    documents: documentsByProject.get(project.id) ?? [],
  }))

  const recentDocuments = documents
    .map((document) => ({
      id: document.id,
      title: document.title,
      updatedAt: document.updated_at,
    }))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))

  const state = deriveShellUXState(shellProjects)

  async function handleResumeLastDoc() {
    "use server"

    if (state.lastEditedDocument) {
      redirect(`/editor/${state.lastEditedDocument.id}`)
    }

    redirect("/dashboard")
  }

  async function handleCreateProject() {
    "use server"

    redirect("/dashboard")
  }

  async function handleCreateFirstDoc() {
    "use server"

    redirect("/dashboard")
  }

  return (
    <DashboardTaskConsole
      state={state}
      recentDocuments={recentDocuments}
      onResumeLastDoc={handleResumeLastDoc}
      onCreateProject={handleCreateProject}
      onCreateFirstDoc={handleCreateFirstDoc}
    />
  )
}
