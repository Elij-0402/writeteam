import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Maximize, MessageSquare, LayoutGrid } from "lucide-react"

interface SiteHeaderProps {
  projectTitle?: string
  projectId?: string
  documentTitle?: string
  contextStatus?: "unselected" | "resumable"
  contextStatusLabel?: string
  wordCount?: number
  focusMode?: boolean
  onToggleFocusMode?: () => void
  aiSidebarOpen?: boolean
  onToggleAISidebar?: () => void
}

export function SiteHeader({
  projectTitle,
  projectId,
  documentTitle,
  contextStatus,
  contextStatusLabel,
  wordCount,
  focusMode,
  onToggleFocusMode,
  aiSidebarOpen,
  onToggleAISidebar,
}: SiteHeaderProps) {
  const resolvedContextStatusLabel =
    contextStatusLabel ??
    (contextStatus === "unselected"
      ? "未选择文档"
      : contextStatus === "resumable"
        ? "可继续"
        : documentTitle
          ? "可继续"
          : "未选择文档")

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-4" />

      <Breadcrumb>
        <BreadcrumbList>
          {projectTitle ? (
            <>
              <BreadcrumbItem>
                {documentTitle ? (
                  <BreadcrumbLink asChild>
                    <Link href={projectId ? `/editor/${projectId}` : "#"}>
                      {projectTitle}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{projectTitle}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {documentTitle && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{documentTitle}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </>
          ) : (
            <BreadcrumbItem>
              <BreadcrumbPage>WriteTeam</BreadcrumbPage>
            </BreadcrumbItem>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] leading-4 text-muted-foreground">
          {resolvedContextStatusLabel}
        </span>

        {wordCount != null && (
          <span className="text-xs text-muted-foreground">
            {wordCount.toLocaleString()} 字
          </span>
        )}

        {projectId && (
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/canvas/${projectId}`} aria-label="故事画布">
              <LayoutGrid className="h-4 w-4" />
            </Link>
          </Button>
        )}

        {onToggleFocusMode && (
          <Button
            variant={focusMode ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={onToggleFocusMode}
            aria-label="专注模式"
          >
            <Maximize className="h-4 w-4" />
          </Button>
        )}

        {onToggleAISidebar && (
          <Button
            variant={aiSidebarOpen ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={onToggleAISidebar}
            aria-label="切换 AI 助手"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  )
}
