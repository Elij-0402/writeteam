"use client"

import { useState } from "react"
import Link from "next/link"
import type { Series, Project, SeriesBible } from "@/types/database"
import {
  updateSeries,
  addProjectToSeries,
  removeProjectFromSeries,
} from "@/app/actions/series"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  PenLine,
  ArrowLeft,
  Plus,
  BookOpen,
  Library,
  Save,
  Loader2,
  X,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { toast } from "sonner"
import { SeriesBiblePanel } from "@/components/series/series-bible-panel"

interface SeriesDetailContentProps {
  series: Series
  seriesProjects: Project[]
  availableProjects: Project[]
  seriesBible: SeriesBible | null
}

export function SeriesDetailContent({
  series,
  seriesProjects: initialProjects,
  availableProjects: initialAvailable,
  seriesBible,
}: SeriesDetailContentProps) {
  const [seriesProjects, setSeriesProjects] = useState(initialProjects)
  const [availableProjects, setAvailableProjects] = useState(initialAvailable)
  const [addProjectOpen, setAddProjectOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [addingProject, setAddingProject] = useState(false)

  // Editable series fields
  const [title, setTitle] = useState(series.title)
  const [description, setDescription] = useState(series.description || "")
  const [savingInfo, setSavingInfo] = useState(false)

  async function handleSaveInfo() {
    setSavingInfo(true)
    const result = await updateSeries(series.id, { title, description })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("系列信息已保存")
    }
    setSavingInfo(false)
  }

  async function handleAddProject() {
    if (!selectedProjectId) return
    setAddingProject(true)
    const result = await addProjectToSeries(selectedProjectId, series.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      const project = availableProjects.find((p) => p.id === selectedProjectId)
      if (project) {
        setSeriesProjects([project, ...seriesProjects])
        setAvailableProjects(availableProjects.filter((p) => p.id !== selectedProjectId))
      }
      setAddProjectOpen(false)
      setSelectedProjectId("")
      toast.success("项目已添加到系列")
    }
    setAddingProject(false)
  }

  async function handleRemoveProject(projectId: string) {
    const result = await removeProjectFromSeries(projectId)
    if (result.error) {
      toast.error(result.error)
    } else {
      const project = seriesProjects.find((p) => p.id === projectId)
      if (project) {
        setAvailableProjects([project, ...availableProjects])
        setSeriesProjects(seriesProjects.filter((p) => p.id !== projectId))
      }
      toast.success("项目已移出系列")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <PenLine className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">WriteTeam</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/series">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回系列
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-5 py-10">
        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList>
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="projects">项目</TabsTrigger>
            <TabsTrigger value="bible">系列圣经</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="max-w-2xl space-y-6">
              <div className="flex items-center gap-3">
                <Library className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold">{series.title}</h1>
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="series-title">系列名称</Label>
                  <Input
                    id="series-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="系列名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="series-desc">系列简介</Label>
                  <Textarea
                    id="series-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="描述这个系列的概况..."
                    rows={4}
                  />
                </div>
                <Button onClick={handleSaveInfo} disabled={savingInfo}>
                  {savingInfo ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  保存信息
                </Button>
              </div>
              <Separator />
              <div className="text-sm text-muted-foreground">
                <p>
                  包含 {seriesProjects.length} 个项目 | 创建于{" "}
                  {formatDistanceToNow(new Date(series.created_at), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">系列项目</h2>
              <Button onClick={() => setAddProjectOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                添加项目
              </Button>
            </div>

            {seriesProjects.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed">
                <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-semibold">
                  还没有项目
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  将已有项目添加到此系列
                </p>
                <Button onClick={() => setAddProjectOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加项目
                </Button>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {seriesProjects.map((project) => (
                  <Card
                    key={project.id}
                    className="group relative transition-shadow hover:shadow-md"
                  >
                    <Link
                      href={`/editor/${project.id}`}
                      className="absolute inset-0 z-10"
                    />
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg leading-tight">
                          {project.title}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="relative z-20 h-8 w-8 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleRemoveProject(project.id)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {project.description || "暂无简介"}
                      </p>
                    </CardContent>
                    <CardFooter className="text-xs text-muted-foreground">
                      更新于{" "}
                      {formatDistanceToNow(new Date(project.updated_at), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}

            {/* Add Project Dialog */}
            <Dialog open={addProjectOpen} onOpenChange={setAddProjectOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>添加项目到系列</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  {availableProjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      没有可添加的项目。所有项目都已在某个系列中，或者你还没有创建项目。
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <Label>选择项目</Label>
                      <Select
                        value={selectedProjectId}
                        onValueChange={setSelectedProjectId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择要添加的项目" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableProjects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleAddProject}
                    disabled={!selectedProjectId || addingProject}
                  >
                    {addingProject && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    添加
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Series Bible Tab */}
          <TabsContent value="bible">
            <div className="mx-auto max-w-3xl rounded-lg border">
              <SeriesBiblePanel
                seriesId={series.id}
                seriesBible={seriesBible}
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
