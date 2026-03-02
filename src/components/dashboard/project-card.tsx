import Link from "next/link"
import type { Project } from "@/types/database"
import { getGenreGradient } from "@/lib/genre-colors"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical, FileEdit, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

interface ProjectCardProps {
  project: Project
  documentCount: number
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
  loading: boolean
}

export function ProjectCard({
  project,
  documentCount,
  onEdit,
  onDelete,
  loading,
}: ProjectCardProps) {
  const gradient = getGenreGradient(project.genre)

  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`/editor/${project.id}`} className="absolute inset-0 z-10" />

      {/* Cover gradient area */}
      <div
        data-testid="card-cover"
        className={`h-24 bg-gradient-to-br ${gradient}`}
        style={
          project.cover_image_url
            ? {
                backgroundImage: `url(${project.cover_image_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      />

      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg leading-tight">
            {project.title}
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative z-20 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={loading}
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(project)
                }}
              >
                <FileEdit className="mr-2 h-4 w-4" />
                编辑信息
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={loading}
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(project)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-sm text-muted-foreground">
          {[project.genre, `${documentCount} 章`].filter(Boolean).join(" · ")}
        </p>
      </CardHeader>

      <CardContent className="pb-2">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {project.description || "暂无简介"}
        </p>
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground">
        更新于{" "}
        {formatDistanceToNow(new Date(project.updated_at), {
          addSuffix: true,
          locale: zhCN,
        })}
      </CardFooter>
    </Card>
  )
}
