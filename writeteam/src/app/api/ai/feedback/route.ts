import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { projectId, feature, responseFingerprint, rating } = await request.json()

  if (!projectId || !feature || !responseFingerprint || ![1, -1].includes(rating)) {
    return Response.json({ error: "Invalid feedback payload" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("ai_history")
    .update({
      user_rating: rating,
      rated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .eq("feature", feature)
    .eq("response_fingerprint", responseFingerprint)
    .is("user_rating", null)
    .select("id")
    .limit(1)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return Response.json({ error: "Matching AI response not found" }, { status: 404 })
  }

  return Response.json({ success: true })
}
