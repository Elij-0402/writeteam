"use client"

import { useState } from "react"
import Link from "next/link"
import type { Series } from "@/types/database"
import { deleteSeries } from "@/app/actions/series"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  PenLine,
  Plus,
  MoreVertical,
  Trash2,
  Library,
  Loader2,
  ArrowLeft,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { toast } from "sonner"
import { SeriesManager } from "@/components/series/series-manager"

interface SeriesListContentProps {
  seriesList: Series[]
  projectCountMap: Record<string, number>
}

export function SeriesListContent({
  seriesList: initialList,
  projectCountMap,
}: SeriesListContentProps) {
  const [seriesList, setSeriesList] = useState(initialList)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [seriesToDelete, setSeriesToDelete] = useState<Series | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleDeleteSeries() {
    if (!seriesToDelete) return
    setLoading(true)
    const result = await deleteSeries(seriesToDelete.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      setSeriesList(seriesList.filter((s) => s.id !== seriesToDelete.id))
      toast.success("系列已删除")
    }
    setSeriesToDelete(null)
    setDeleteDialogOpen(false)
    setLoading(false)
  }

  function handleSeriesCreated(newSeries: Series) {
    setSeriesList([newSeries, ...seriesList])
    setCreateOpen(false)
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
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回项目
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-5 py-10">
        <div className="mb-10 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">我的系列</h1>
            <p className="mt-1 text-muted-foreground">
              {seriesList.length} 个系列
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新建系列
          </Button>
        </div>

        {/* Series Grid */}
        {seriesList.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed">
            <Library className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-semibold">还没有系列</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              创建系列来管理多本相关的作品
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              新建系列
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {seriesList.map((series) => (
              <Card
                key={series.id}
                className="group relative transition-shadow hover:shadow-md"
              >
                <Link
                  href={`/series/${series.id}`}
                  className="absolute inset-0 z-10"
                />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg leading-tight">
                      {series.title}
                    </CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="relative z-20 h-8 w-8 opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSeriesToDelete(series)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardDescription>
                    {projectCountMap[series.id] || 0} 个项目
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {series.description || "暂无简介"}
                  </p>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground">
                  更新于{" "}
                  {formatDistanceToNow(new Date(series.updated_at), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Series Dialog */}
      <SeriesManager
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleSeriesCreated}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除系列？</AlertDialogTitle>
            <AlertDialogDescription>
              这将永久删除&ldquo;{seriesToDelete?.title}&rdquo;及其系列圣经，且无法撤销。系列中的项目不会被删除，但会被移出该系列。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSeries}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
