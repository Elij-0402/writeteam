"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  PenLine,
  Wand2,
  Eye,
  Brain,
  Expand,
  FileText,
  ListTree,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AIToolbarProps {
  selectedText: string
  documentContent: string
  projectId: string
  documentId: string
  onInsertText: (text: string) => void
}

type AIFeature =
  | "write"
  | "rewrite"
  | "describe"
  | "brainstorm"
  | "expand"
  | "first-draft"
  | "scene-plan"
  | "continuity-check"

const WRITE_MODES = [
  { value: "auto", label: "Auto - AI decides" },
  { value: "guided", label: "Guided - You direct" },
  { value: "tone-ominous", label: "Tone: Ominous" },
  { value: "tone-romantic", label: "Tone: Romantic" },
  { value: "tone-fast", label: "Tone: Fast-Paced" },
  { value: "tone-humorous", label: "Tone: Humorous" },
]

const REWRITE_MODES = [
  { value: "rephrase", label: "Rephrase" },
  { value: "shorter", label: "Make Shorter" },
  { value: "longer", label: "Make Longer" },
  { value: "show-not-tell", label: "Show, Don't Tell" },
  { value: "more-intense", label: "More Intense" },
  { value: "more-lyrical", label: "More Lyrical" },
  { value: "custom", label: "Custom Instructions" },
]

const PROSE_MODES = [
  { value: "default", label: "Use Story Bible mode" },
  { value: "balanced", label: "Balanced" },
  { value: "cinematic", label: "Cinematic" },
  { value: "lyrical", label: "Lyrical" },
  { value: "minimal", label: "Minimal" },
  { value: "match-style", label: "Match Style" },
]

export function AIToolbar({
  selectedText,
  documentContent,
  projectId,
  documentId,
  onInsertText,
}: AIToolbarProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState("")
  const [activeFeature, setActiveFeature] = useState<AIFeature | null>(null)
  const [writeMode, setWriteMode] = useState("auto")
  const [rewriteMode, setRewriteMode] = useState("rephrase")
  const [customPrompt, setCustomPrompt] = useState("")
  const [guidedPrompt, setGuidedPrompt] = useState("")
  const [brainstormTopic, setBrainstormTopic] = useState("")
  const [firstDraftOutline, setFirstDraftOutline] = useState("")
  const [scenePlanGoal, setScenePlanGoal] = useState("")
  const [continuityPassage, setContinuityPassage] = useState("")
  const [proseModeOverride, setProseModeOverride] = useState("default")
  const [copied, setCopied] = useState(false)
  const [responseFingerprint, setResponseFingerprint] = useState("")
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState<0 | 1 | -1>(0)

  async function hashText(text: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  }

  async function callAI(feature: AIFeature) {
    setLoading(true)
    setActiveFeature(feature)
    setResult("")
    setCopied(false)
    setResponseFingerprint("")
    setFeedbackGiven(0)

    try {
      const body: Record<string, string> = {
        projectId,
        documentId,
        context: documentContent.slice(-5000),
      }

      if (proseModeOverride !== "default") {
        body.proseMode = proseModeOverride
      }

      switch (feature) {
        case "write":
          body.mode = writeMode
          body.guidance = guidedPrompt
          break
        case "rewrite":
          body.text = selectedText
          body.mode = rewriteMode
          body.customInstructions = customPrompt
          break
        case "describe":
          body.text = selectedText || "the scene"
          break
        case "brainstorm":
          body.topic = brainstormTopic
          break
        case "expand":
          body.text = selectedText || documentContent.slice(-2000)
          break
        case "first-draft":
          body.outline = firstDraftOutline
          break
        case "scene-plan":
          body.goal = scenePlanGoal
          break
        case "continuity-check":
          body.passage = continuityPassage || selectedText || documentContent.slice(-2000)
          break
      }

      const response = await fetch(`/api/ai/${feature}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "AI request failed")
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          fullText += chunk
          setResult(fullText)
        }
      }

      if (fullText) {
        const fingerprint = await hashText(fullText)
        setResponseFingerprint(fingerprint)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI request failed")
    } finally {
      setLoading(false)
    }
  }

  function handleInsert() {
    if (result) {
      onInsertText(result)
      setResult("")
      setActiveFeature(null)
      toast.success("Text inserted into editor")
    }
  }

  function handleUseScenePlanAsDraft() {
    if (!result) {
      return
    }

    setFirstDraftOutline(result)
    setResult("")
    setActiveFeature("first-draft")
    toast.success("Scene plan moved to First Draft input")
  }

  function handleCopy() {
    navigator.clipboard.writeText(result)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  async function submitFeedback(rating: 1 | -1) {
    if (!activeFeature || !responseFingerprint || feedbackLoading || feedbackGiven !== 0) {
      return
    }

    setFeedbackLoading(true)
    try {
      const response = await fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          feature: activeFeature,
          responseFingerprint,
          rating,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to submit feedback")
      }

      setFeedbackGiven(rating)
      toast.success(rating === 1 ? "Marked as helpful" : "Marked as not helpful")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit feedback")
    } finally {
      setFeedbackLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1 border-b bg-muted/30 px-2 py-1">
      {/* Write */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <PenLine className="h-3.5 w-3.5" />
                Write
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Continue writing with AI</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">AI Write</h4>
            <p className="text-xs text-muted-foreground">
              AI will continue your story from where you left off.
            </p>
            <Select value={writeMode} onValueChange={setWriteMode}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WRITE_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value} className="text-xs">
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {writeMode === "guided" && (
              <Textarea
                placeholder="What should happen next? e.g., 'They discover a hidden door behind the bookshelf'"
                value={guidedPrompt}
                onChange={(e) => setGuidedPrompt(e.target.value)}
                rows={3}
                className="text-xs"
              />
            )}
            <Select value={proseModeOverride} onValueChange={setProseModeOverride}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Prose mode override" />
              </SelectTrigger>
              <SelectContent>
                {PROSE_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value} className="text-xs">
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="w-full"
              onClick={() => callAI("write")}
              disabled={loading}
            >
              {loading && activeFeature === "write" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-3.5 w-3.5" />
              )}
              Generate
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <ListTree className="h-3.5 w-3.5" />
                Scene Plan
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Plan chapter scenes and beats</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-96" align="start">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Scene Plan</h4>
            <Textarea
              placeholder="Chapter goal and target outcome..."
              value={scenePlanGoal}
              onChange={(e) => setScenePlanGoal(e.target.value)}
              rows={4}
              className="text-xs"
            />
            <Select value={proseModeOverride} onValueChange={setProseModeOverride}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Prose mode override" />
              </SelectTrigger>
              <SelectContent>
                {PROSE_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value} className="text-xs">
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="w-full"
              onClick={() => callAI("scene-plan")}
              disabled={loading || !scenePlanGoal}
            >
              {loading && activeFeature === "scene-plan" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ListTree className="mr-2 h-3.5 w-3.5" />
              )}
              Generate Scene Plan
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <ShieldAlert className="h-3.5 w-3.5" />
                Continuity
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Check logic and continuity</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-96" align="start">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Continuity Check</h4>
            <Textarea
              placeholder="Paste passage to audit. Leave empty to use selection/recent context."
              value={continuityPassage}
              onChange={(e) => setContinuityPassage(e.target.value)}
              rows={4}
              className="text-xs"
            />
            <Button
              size="sm"
              className="w-full"
              onClick={() => callAI("continuity-check")}
              disabled={loading || (!continuityPassage && !selectedText && !documentContent)}
            >
              {loading && activeFeature === "continuity-check" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldAlert className="mr-2 h-3.5 w-3.5" />
              )}
              Run Continuity Check
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Rewrite */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={!selectedText}
              >
                <Wand2 className="h-3.5 w-3.5" />
                Rewrite
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {selectedText ? "Rewrite selected text" : "Select text first"}
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Rewrite</h4>
            <p className="text-xs text-muted-foreground">
              Selected: {selectedText.slice(0, 100)}
              {selectedText.length > 100 ? "..." : ""}
            </p>
            <Select value={rewriteMode} onValueChange={setRewriteMode}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REWRITE_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value} className="text-xs">
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {rewriteMode === "custom" && (
              <Textarea
                placeholder="Custom rewrite instructions..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={2}
                className="text-xs"
              />
            )}
            <Button
              size="sm"
              className="w-full"
              onClick={() => callAI("rewrite")}
              disabled={loading}
            >
              {loading && activeFeature === "rewrite" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-3.5 w-3.5" />
              )}
              Rewrite
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Describe */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => callAI("describe")}
            disabled={loading || !selectedText}
          >
            {loading && activeFeature === "describe" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            Describe
          </Button>
        </TooltipTrigger>
        <TooltipContent>Generate sensory descriptions</TooltipContent>
      </Tooltip>

      {/* Brainstorm */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <Brain className="h-3.5 w-3.5" />
                Brainstorm
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Generate ideas</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Brainstorm</h4>
            <Textarea
              placeholder="What do you want ideas for? e.g., 'Fantasy city names', 'Plot twists for a murder mystery'"
              value={brainstormTopic}
              onChange={(e) => setBrainstormTopic(e.target.value)}
              rows={3}
              className="text-xs"
            />
            <Button
              size="sm"
              className="w-full"
              onClick={() => callAI("brainstorm")}
              disabled={loading || !brainstormTopic}
            >
              {loading && activeFeature === "brainstorm" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Brain className="mr-2 h-3.5 w-3.5" />
              )}
              Generate Ideas
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Expand */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => callAI("expand")}
            disabled={loading}
          >
            {loading && activeFeature === "expand" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Expand className="h-3.5 w-3.5" />
            )}
            Expand
          </Button>
        </TooltipTrigger>
        <TooltipContent>Expand and add detail to text</TooltipContent>
      </Tooltip>

      {/* First Draft */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                First Draft
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Generate a full scene from outline</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-96" align="start">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">First Draft</h4>
            <p className="text-xs text-muted-foreground">
              Provide an outline or beats and the AI will write a full scene.
            </p>
            <Select value={proseModeOverride} onValueChange={setProseModeOverride}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Prose mode override" />
              </SelectTrigger>
              <SelectContent>
                {PROSE_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value} className="text-xs">
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Scene beats:&#10;- Character arrives at the abandoned mansion&#10;- Explores the foyer, notices strange paintings&#10;- Hears a noise from upstairs..."
              value={firstDraftOutline}
              onChange={(e) => setFirstDraftOutline(e.target.value)}
              rows={6}
              className="text-xs"
            />
            <Button
              size="sm"
              className="w-full"
              onClick={() => callAI("first-draft")}
              disabled={loading || !firstDraftOutline}
            >
              {loading && activeFeature === "first-draft" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="mr-2 h-3.5 w-3.5" />
              )}
              Generate Draft
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Result Panel */}
      {result && (
        <Popover open={!!result} onOpenChange={(open) => !open && setResult("")}>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" className="ml-auto h-8 gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              View Result
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[500px]" align="end" side="bottom">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">AI Result</h4>
              <ScrollArea className="max-h-[300px]">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {result}
                </div>
              </ScrollArea>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={handleInsert}>
                  Insert into Editor
                </Button>
                {activeFeature === "scene-plan" && (
                  <Button size="sm" variant="outline" onClick={handleUseScenePlanAsDraft}>
                    Use as Draft Input
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant={feedbackGiven === 1 ? "default" : "outline"}
                  onClick={() => submitFeedback(1)}
                  disabled={feedbackLoading || feedbackGiven !== 0 || !responseFingerprint}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant={feedbackGiven === -1 ? "default" : "outline"}
                  onClick={() => submitFeedback(-1)}
                  disabled={feedbackLoading || feedbackGiven !== 0 || !responseFingerprint}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
