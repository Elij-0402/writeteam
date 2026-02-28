import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { redirect } from "next/navigation"
import { CanvasEditor } from "@/components/canvas/canvas-editor"
import { getCanvasNodes, getCanvasEdges } from "@/app/actions/canvas"

export default async function CanvasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ focusNodeId?: string }>
}) {
  const { id: projectId } = await params
  const { focusNodeId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single()

  if (!project) {
    redirect("/dashboard")
  }

  const { data: nodes, error: nodesError } = await getCanvasNodes(projectId)
  const { data: edges, error: edgesError, warning: edgesWarning } = await getCanvasEdges(projectId)
  const initialLoadError = nodesError || edgesError || null

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href={`/editor/${projectId}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; 返回编辑器
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <h1 className="text-sm font-semibold">{project.title} - 故事画布</h1>
        </div>
      </div>
      <div className="flex-1">
        {initialLoadError && (
          <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
            画布加载部分失败：{initialLoadError}。你仍可继续编辑并手动重试保存。
          </div>
        )}
        <CanvasEditor
          projectId={projectId}
          initialNodes={nodes || []}
          initialEdges={edges || []}
          initialEdgesWarning={edgesWarning || null}
          initialFocusNodeId={typeof focusNodeId === "string" ? focusNodeId : null}
        />
      </div>
    </div>
  )
}
