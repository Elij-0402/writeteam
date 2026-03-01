"use client"

import mammoth from "mammoth"

const SUPPORTED_IMPORT_EXTENSIONS = ["txt", "docx"] as const
const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024

function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".")
  if (dotIndex < 0 || dotIndex === filename.length - 1) {
    return ""
  }

  return filename.slice(dotIndex + 1).toLowerCase()
}

function getFileBasename(filename: string): string {
  const dotIndex = filename.lastIndexOf(".")
  if (dotIndex <= 0) {
    return filename.trim() || "未命名文档"
  }

  return filename.slice(0, dotIndex).trim() || "未命名文档"
}

function sanitizeImportedText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
}

function validateImportFile(file: File): { ext: string } {
  const ext = getFileExtension(file.name)

  if (!SUPPORTED_IMPORT_EXTENSIONS.includes(ext as (typeof SUPPORTED_IMPORT_EXTENSIONS)[number])) {
    throw new Error("仅支持 .txt 或 .docx 文件。请更换文件后重试。")
  }

  if (file.size <= 0) {
    throw new Error("文件内容为空，请检查文件后重试。")
  }

  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    throw new Error("文件过大（超过 5MB）。请拆分后再导入。")
  }

  return { ext }
}

export async function parseImportedFile(
  file: File
): Promise<{ title: string; content: string }> {
  const { ext } = validateImportFile(file)
  const title = getFileBasename(file.name)

  if (ext === "txt") {
    const content = await file.text()
    return { title, content: sanitizeImportedText(content) }
  }

  if (ext === "docx") {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return { title, content: sanitizeImportedText(result.value) }
  }

  throw new Error("文件格式无效，请改用 .txt 或 .docx 文件。")
}
