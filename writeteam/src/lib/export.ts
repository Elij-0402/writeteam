"use client"

import { Document, Packer, Paragraph, HeadingLevel } from "docx"
import { saveAs } from "file-saver"

export function exportAsText(title: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  saveAs(blob, `${title}.txt`)
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
  saveAs(blob, `${title}.docx`)
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
  saveAs(blob, `${projectTitle}.docx`)
}
