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
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            AI-Powered Creative Writing
          </div>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Write your story
            <br />
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              with AI by your side
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
            WriteTeam is your AI writing partner for fiction. Brainstorm ideas,
            draft scenes, rewrite prose, and build rich story worlds — all in one
            beautiful editor.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="h-12 px-8 text-base">
                Start Writing Free
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30 px-4 py-24">
        <div className="container mx-auto max-w-6xl">
          <h2 className="mb-16 text-center text-3xl font-bold">
            Everything you need to write your masterpiece
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<PenLine className="h-8 w-8" />}
              title="Smart Writing"
              description="AI continues your story with context-aware autocomplete. Choose Auto, Guided, or Tone Shift modes to match your creative flow."
            />
            <FeatureCard
              icon={<Wand2 className="h-8 w-8" />}
              title="Rewrite & Polish"
              description="Rephrase, shorten, expand, or change the tone of any passage. Show don't tell, make it more intense, or customize freely."
            />
            <FeatureCard
              icon={<Brain className="h-8 w-8" />}
              title="Brainstorm"
              description="Generate character names, plot twists, world details, and more. Thumbs-up your favorites to guide the AI toward your vision."
            />
            <FeatureCard
              icon={<BookOpen className="h-8 w-8" />}
              title="Story Bible"
              description="Keep your story's brain in one place — characters, world rules, synopsis, outline. The AI reads it all to stay consistent."
            />
            <FeatureCard
              icon={<Sparkles className="h-8 w-8" />}
              title="First Draft"
              description="Turn your outline beats into full prose scenes. Go from story structure to a complete first draft in hours, not months."
            />
            <FeatureCard
              icon={<MessageSquare className="h-8 w-8" />}
              title="AI Chat"
              description="Chat with an AI that knows your story. Ask about your characters, get suggestions, or brainstorm plot points in conversation."
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
          <p>AI-powered creative writing assistant</p>
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
