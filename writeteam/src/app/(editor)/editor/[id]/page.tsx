import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { EditorShell } from "@/components/editor/editor-shell"

export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    from?: string
    canvasNodeId?: string
    canvasNodeLabel?: string
    canvasNodeType?: string
    canvasNodeSummary?: string
  }>
}) {
  const { id: projectId } = await params
  const entrySearch = await searchParams
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

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  const { data: storyBible } = await supabase
    .from("story_bibles")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .single()

  const { data: characters } = await supabase
    .from("characters")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  const { data: plugins } = await supabase
    .from("plugins")
    .select("*")
    .eq("user_id", user.id)
    .or(`project_id.eq.${projectId},project_id.is.null`)
    .order("sort_order", { ascending: true })

  return (
    <EditorShell
      project={project}
      documents={documents || []}
      storyBible={storyBible}
      characters={characters || []}
      plugins={plugins || []}
      entryContext={entrySearch.from === "canvas"
        ? {
            source: "canvas",
            nodeId: typeof entrySearch.canvasNodeId === "string" ? entrySearch.canvasNodeId : "",
            nodeLabel: typeof entrySearch.canvasNodeLabel === "string" ? entrySearch.canvasNodeLabel : "",
            nodeType: typeof entrySearch.canvasNodeType === "string" ? entrySearch.canvasNodeType : "",
            nodeSummary: typeof entrySearch.canvasNodeSummary === "string" ? entrySearch.canvasNodeSummary : "",
          }
        : null}
    />
  )
}
