"use client"

import Link from "next/link"
import { PenLine, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AIProviderForm } from "@/components/settings/ai-provider-form"

export function SettingsContent() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <PenLine className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">WriteTeam</span>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-5 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">设置</h1>
          <p className="mt-1 text-muted-foreground">管理你的 AI 服务配置</p>
        </div>

        <AIProviderForm />
      </main>
    </div>
  )
}
