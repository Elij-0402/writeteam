import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

type FeedbackErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_PAYLOAD"
  | "NOT_FOUND"
  | "ALREADY_RATED"
  | "INTERNAL_ERROR"

function errorResponse(status: number, code: FeedbackErrorCode, message: string) {
  return Response.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status }
  )
}

function parseRating(value: unknown): 1 | -1 | null {
  return value === 1 || value === -1 ? value : null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "未登录")
  }

  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch {
    return errorResponse(400, "INVALID_PAYLOAD", "请求体不是有效的 JSON")
  }

  const body =
    requestBody && typeof requestBody === "object" ? (requestBody as Record<string, unknown>) : null

  const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : ""
  const feature = typeof body?.feature === "string" ? body.feature.trim() : ""
  const responseFingerprint =
    typeof body?.responseFingerprint === "string" ? body.responseFingerprint.trim() : ""
  const rating = parseRating(body?.rating)

  if (!projectId || !feature || !responseFingerprint || rating === null) {
    return errorResponse(400, "INVALID_PAYLOAD", "反馈参数无效，仅支持 -1 或 1")
  }

  const { data: matchedRows, error: lookupError } = await supabase
    .from("ai_history")
    .select("id,user_rating")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .eq("feature", feature)
    .eq("response_fingerprint", responseFingerprint)
    .order("created_at", { ascending: false })
    .limit(1)

  if (lookupError) {
    return errorResponse(500, "INTERNAL_ERROR", "反馈状态查询失败，请稍后重试")
  }

  if (!matchedRows || matchedRows.length === 0) {
    return errorResponse(404, "NOT_FOUND", "未找到对应的 AI 响应")
  }

  const matched = matchedRows[0]
  if (!matched) {
    return errorResponse(404, "NOT_FOUND", "未找到对应的 AI 响应")
  }

  if (matched.user_rating === 1 || matched.user_rating === -1) {
    return Response.json(
      {
        success: false,
        error: {
          code: "ALREADY_RATED",
          message: "该 AI 响应已反馈过，不能重复提交",
        },
        existingRating: matched.user_rating,
      },
      { status: 409 }
    )
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("ai_history")
    .update({
      user_rating: rating,
      rated_at: new Date().toISOString(),
    })
    .eq("id", matched.id)
    .eq("user_id", user.id)
    .is("user_rating", null)
    .select("id")

  if (updateError) {
    return errorResponse(500, "INTERNAL_ERROR", "反馈写入失败，请稍后重试")
  }

  if (!updatedRows || updatedRows.length === 0) {
    return errorResponse(409, "ALREADY_RATED", "该 AI 响应已反馈过，不能重复提交")
  }

  return Response.json({ success: true })
}
