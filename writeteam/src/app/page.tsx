import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  PenLine,
  Sparkles,
  BookOpen,
  Brain,
  MessageSquare,
  Wand2,
} from "lucide-react"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <PenLine className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">WriteTeam</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">登录</Button>
            </Link>
            <Link href="/signup">
              <Button>立即开始</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            AI 创意写作助手
          </div>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            写下你的故事
            <br />
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              让 AI 与你并肩创作
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
            WriteTeam 是你的小说创作搭档。你可以头脑风暴、生成场景初稿、润色改写，
            并在同一编辑器中构建完整世界观。
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="h-12 px-8 text-base">
                免费开始创作
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                登录
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30 px-4 py-24">
        <div className="container mx-auto max-w-6xl">
          <h2 className="mb-16 text-center text-3xl font-bold">
            完整覆盖你的创作流程
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<PenLine className="h-8 w-8" />}
              title="智能续写"
              description="AI 基于上下文继续创作。可切换自动、引导和语气模式，贴合你的写作节奏。"
            />
            <FeatureCard
              icon={<Wand2 className="h-8 w-8" />}
              title="改写与润色"
              description="对任意段落进行重写、精简、扩展或语气调整，支持展示而非告知等高级改写。"
            />
            <FeatureCard
              icon={<Brain className="h-8 w-8" />}
              title="灵感头脑风暴"
              description="快速生成角色设定、剧情反转与世界细节，并通过反馈让 AI 更懂你的偏好。"
            />
            <FeatureCard
              icon={<BookOpen className="h-8 w-8" />}
              title="故事圣经"
              description="集中管理角色、世界规则、梗概和大纲，帮助 AI 在全书范围内保持一致性。"
            />
            <FeatureCard
              icon={<Sparkles className="h-8 w-8" />}
              title="首稿生成"
              description="把大纲节拍快速扩展为完整场景，从结构到成文，大幅缩短写作周期。"
            />
            <FeatureCard
              icon={<MessageSquare className="h-8 w-8" />}
              title="AI 对话"
              description="与理解你故事上下文的 AI 实时交流，讨论角色、情节和下一步写作方向。"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-8">
        <div className="container mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <PenLine className="h-4 w-4" />
            <span>WriteTeam</span>
          </div>
          <p>AI 驱动的创意写作助手</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 text-primary">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
