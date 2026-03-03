import { redirect } from "next/navigation"
import { createDocument } from "@/app/actions/documents"
import { createProject } from "@/app/actions/projects"
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

  const { data: projectsData, error: projectsError } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  const projects: DashboardProjectRow[] = projectsError ? [] : projectsData ?? []
  const projectIds = projects.map((project) => project.id)

  let documents: DashboardDocumentRow[] = []

  if (projectIds.length > 0) {
    const { data: documentsData, error: documentsError } = await supabase
      .from("documents")
      .select("id, project_id, title, updated_at")
      .in("project_id", projectIds)
      .order("updated_at", { ascending: false })

    documents = documentsError ? [] : documentsData ?? []
  }
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

    const formData = new FormData()
    formData.set("title", "未命名项目")
    formData.set("description", "")
    formData.set("genre", "")

    const result = await createProject(formData)

    if (result.data?.id) {
      redirect(`/editor/${result.data.id}`)
    }

    redirect("/dashboard")
  }

  async function handleCreateFirstDoc() {
    "use server"

    const fallbackProjectId = shellProjects[0]?.projectId
    let targetProjectId: string | undefined = shellProjects.find((project) => project.documents.length === 0)?.projectId ?? fallbackProjectId

    if (!targetProjectId) {
      const projectFormData = new FormData()
      projectFormData.set("title", "未命名项目")
      projectFormData.set("description", "")
      projectFormData.set("genre", "")

      const createdProject = await createProject(projectFormData)
      targetProjectId = createdProject.data?.id
    }

    if (targetProjectId) {
      const documentFormData = new FormData()
      documentFormData.set("title", "第 1 章")
      documentFormData.set("documentType", "chapter")

      const createdDocument = await createDocument(targetProjectId, documentFormData)

      if (createdDocument.data?.id) {
        redirect(`/editor/${targetProjectId}?doc=${createdDocument.data.id}`)
      }
    }

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
