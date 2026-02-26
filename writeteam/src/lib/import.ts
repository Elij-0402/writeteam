"use client"

import mammoth from "mammoth"

export async function parseImportedFile(
  file: File
): Promise<{ title: string; content: string }> {
  const title = file.name.replace(/\.(txt|docx)$/i, "")

  if (file.name.endsWith(".txt")) {
    const content = await file.text()
    return { title, content }
  }

  if (file.name.endsWith(".docx")) {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return { title, content: result.value }
  }

  throw new Error("不支持的文件格式，请上传 .txt 或 .docx 文件")
}
