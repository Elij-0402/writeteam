import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface DashboardHeaderProps {
  projectCount: number
  onNewProject: () => void
}

export function DashboardHeader({
  projectCount,
  onNewProject,
}: DashboardHeaderProps) {
  return (
    <div className="mb-10 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold">我的项目</h1>
        <p className="mt-1 text-muted-foreground">
          {projectCount} 个项目
        </p>
      </div>
      <Button onClick={onNewProject}>
        <Plus className="mr-2 h-4 w-4" />
        新建项目
      </Button>
    </div>
  )
}
