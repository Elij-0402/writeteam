import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { createClient } from "@/lib/supabase/server"
import {
  cleanupDanglingCanvasEdges,
  createCanvasEdge,
  createCanvasNode,
  deleteCanvasEdge,
  deleteCanvasNode,
  updateNodePositions,
  updateCanvasEdge,
  updateCanvasNode,
} from "./canvas"

type User = { id: string }

function buildProjectsTable(accessible: boolean) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: accessible ? { id: "project-1" } : null, error: null })),
        })),
      })),
    })),
  }
}

function mockClient(user: User | null, handlers: Record<string, unknown>) {
  const from = vi.fn((table: string) => {
    const target = handlers[table]
    if (!target) {
      throw new Error(`unexpected table: ${table}`)
    }
    return target
  })

  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
    },
    from,
  } as never)
}

describe("canvas actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns auth error for unauthenticated create", async () => {
    mockClient(null, {
      projects: buildProjectsTable(true),
      canvas_nodes: {},
    })

    const result = await createCanvasNode("project-1", { node_type: "beat", label: "节点" })
    expect(result).toEqual({ error: "未登录" })
  })

  it("creates node successfully", async () => {
    const canvasNodesTable = {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { id: "node-1", label: "新节拍" }, error: null })),
        })),
      })),
    }

    mockClient(
      { id: "user-1" },
      {
        projects: buildProjectsTable(true),
        canvas_nodes: canvasNodesTable,
      }
    )

    const result = await createCanvasNode("project-1", { node_type: "beat", label: "新节拍" })

    expect(result.error).toBeUndefined()
    expect(result.data?.id).toBe("node-1")
    expect(canvasNodesTable.insert).toHaveBeenCalled()
  })

  it("updates and deletes node with project scope", async () => {
    const canvasNodesTable = {
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        })),
      })),
    }

    mockClient(
      { id: "user-1" },
      {
        projects: buildProjectsTable(true),
        canvas_nodes: canvasNodesTable,
      }
    )

    const updateResult = await updateCanvasNode("project-1", "node-1", { label: "改名" })
    const deleteResult = await deleteCanvasNode("project-1", "node-1")

    expect(updateResult).toEqual({ success: true })
    expect(deleteResult).toEqual({ success: true })
  })

  it("dedupes edge creation when edge already exists", async () => {
    const existingEdge = { id: "edge-1", source_node_id: "node-a", target_node_id: "node-b" }
    const canvasNodesTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(async () => ({ data: [{ id: "node-a" }, { id: "node-b" }], error: null })),
          })),
        })),
      })),
    }

    const canvasEdgesTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: existingEdge, error: null })),
              })),
            })),
          })),
        })),
      })),
      insert: vi.fn(),
    }

    mockClient(
      { id: "user-1" },
      {
        projects: buildProjectsTable(true),
        canvas_nodes: canvasNodesTable,
        canvas_edges: canvasEdgesTable,
      }
    )

    const result = await createCanvasEdge("project-1", {
      source_node_id: "node-a",
      target_node_id: "node-b",
    })

    expect(result.data?.id).toBe("edge-1")
    expect(result.deduped).toBe(true)
    expect(canvasEdgesTable.insert).not.toHaveBeenCalled()
  })

  it("updates and deletes edge successfully", async () => {
    const canvasNodesTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(async () => ({ data: [{ id: "node-a" }, { id: "node-c" }], error: null })),
          })),
        })),
      })),
    }

    const canvasEdgesTable = {
      select: vi
        .fn()
        .mockImplementationOnce(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: { source_node_id: "node-a", target_node_id: "node-b" }, error: null })),
              })),
            })),
          })),
        }))
        .mockImplementationOnce(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  })),
                })),
              })),
            })),
          })),
        })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        })),
      })),
    }

    mockClient(
      { id: "user-1" },
      {
        projects: buildProjectsTable(true),
        canvas_nodes: canvasNodesTable,
        canvas_edges: canvasEdgesTable,
      }
    )

    const updateResult = await updateCanvasEdge("project-1", "edge-1", {
      source_node_id: "node-a",
      target_node_id: "node-c",
    })
    const deleteResult = await deleteCanvasEdge("project-1", "edge-1")

    expect(updateResult).toEqual({ success: true })
    expect(deleteResult).toEqual({ success: true })
  })

  it("rolls back node positions when batch update partially fails", async () => {
    const canvasNodesTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                { id: "node-a", position_x: 0, position_y: 0 },
                { id: "node-b", position_x: 10, position_y: 10 },
              ],
              error: null,
            })),
          })),
        })),
      })),
      update: vi
        .fn()
        .mockImplementationOnce(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          })),
        }))
        .mockImplementationOnce(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: { message: "db fail" } })),
            })),
          })),
        }))
        .mockImplementation(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          })),
        })),
    }

    mockClient(
      { id: "user-1" },
      {
        projects: buildProjectsTable(true),
        canvas_nodes: canvasNodesTable,
      }
    )

    const result = await updateNodePositions("project-1", [
      { id: "node-a", position_x: 100, position_y: 200 },
      { id: "node-b", position_x: 300, position_y: 400 },
    ])

    expect(result.error).toBe("保存节点位置失败，已自动回滚，请重试")
    expect(canvasNodesTable.update).toHaveBeenCalledTimes(4)
  })

  it("cleans up dangling edges explicitly", async () => {
    const canvasNodesTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [{ id: "node-a" }], error: null })),
        })),
      })),
    }

    const canvasEdgesTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: [
              { id: "edge-ok", source_node_id: "node-a", target_node_id: "node-a" },
              { id: "edge-bad", source_node_id: "node-a", target_node_id: "node-missing" },
            ],
            error: null,
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(async () => ({ error: null })),
          })),
        })),
      })),
    }

    mockClient(
      { id: "user-1" },
      {
        projects: buildProjectsTable(true),
        canvas_nodes: canvasNodesTable,
        canvas_edges: canvasEdgesTable,
      }
    )

    const result = await cleanupDanglingCanvasEdges("project-1")
    expect(result).toEqual({ deleted: 1 })
    expect(canvasEdgesTable.delete).toHaveBeenCalled()
  })
})
