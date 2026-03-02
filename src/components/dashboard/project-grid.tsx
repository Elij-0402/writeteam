import type { Project } from "@/types/database"
import { ProjectCard } from "./project-card"
import { Button } from "@/components/ui/button"
import { BookOpen, Plus } from "lucide-react"

interface ProjectGridProps {
  projects: Project[]
  documentCounts: Record<string, number>
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
  onNewProject: () => void
  loading: boolean
}

export function ProjectGrid({
  projects,
  documentCounts,
  onEdit,
  onDelete,
  onNewProject,
  loading,
}: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed">
        <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <h3 className="mb-2 text-lg font-semibold">还没有项目</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          创建你的第一个项目，开始写作
        </p>
        <Button onClick={onNewProject}>
          <Plus className="mr-2 h-4 w-4" />
          新建项目
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          documentCount={documentCounts[project.id] ?? 0}
          onEdit={onEdit}
          onDelete={onDelete}
          loading={loading}
        />
      ))}
    </div>
  )
}
