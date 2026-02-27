"use client"

import { Document, Packer, Paragraph, HeadingLevel } from "docx"
import { saveAs } from "file-saver"

function formatDateForFilename(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}${month}${day}`
}

function sanitizeFileSegment(value: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()

  return cleaned.length > 0 ? cleaned.slice(0, 80) : "未命名"
}

function buildExportFilename(base: string, ext: "txt" | "docx"): string {
  const safeBase = sanitizeFileSegment(base)
  const date = formatDateForFilename(new Date())
  return `${safeBase}-${date}.${ext}`
}

export function exportAsText(title: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  saveAs(blob, buildExportFilename(title, "txt"))
}

export async function exportAsDocx(title: string, content: string): Promise<void> {
  const lines = content.split("\n")
  const children: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
    }),
  ]

  for (const line of lines) {
    children.push(
      new Paragraph({
        text: line,
      })
    )
  }

  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, buildExportFilename(title, "docx"))
}

export async function exportProjectAsDocx(
  projectTitle: string,
  chapters: { title: string; content: string }[]
): Promise<void> {
  const children: Paragraph[] = []

  for (const chapter of chapters) {
    children.push(
      new Paragraph({
        text: chapter.title,
        heading: HeadingLevel.HEADING_1,
      })
    )
    const lines = chapter.content.split("\n")
    for (const line of lines) {
      children.push(
        new Paragraph({
          text: line,
        })
      )
    }
    // Add a page break between chapters (except after the last one)
    if (chapter !== chapters[chapters.length - 1]) {
      children.push(
        new Paragraph({
          text: "",
          pageBreakBefore: true,
        })
      )
    }
  }

  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, buildExportFilename(projectTitle, "docx"))
}
