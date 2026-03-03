import { describe, it, expect } from "vitest"
import {
  parseWorldbuildingSections,
  serializeWorldbuildingSections,
  type WorldbuildingSection,
} from "./worldbuilding-sections"

describe("parseWorldbuildingSections", () => {
  it("parses structured worldbuilding text into sections", () => {
    const text = `[地理环境]\n山脉和河流纵横交错\n气候四季分明\n\n[势力与阵营]\n皇室和反叛军对峙\n\n[能力体系]\n内力修炼体系，分九重境界`

    const sections = parseWorldbuildingSections(text)
    expect(sections).toHaveLength(3)
    expect(sections[0].title).toBe("地理环境")
    expect(sections[0].content).toBe("山脉和河流纵横交错\n气候四季分明")
    expect(sections[1].title).toBe("势力与阵营")
    expect(sections[2].title).toBe("能力体系")
  })

  it("handles legacy plain text (no sections)", () => {
    const text = "这是一个奇幻世界，有魔法和龙"
    const sections = parseWorldbuildingSections(text)
    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe("通用")
    expect(sections[0].content).toBe("这是一个奇幻世界，有魔法和龙")
  })

  it("handles empty input", () => {
    expect(parseWorldbuildingSections("")).toEqual([])
    expect(parseWorldbuildingSections(null)).toEqual([])
  })
})

describe("serializeWorldbuildingSections", () => {
  it("serializes sections back to text", () => {
    const sections: WorldbuildingSection[] = [
      { title: "地理环境", content: "山脉和河流" },
      { title: "能力体系", content: "内力修炼" },
    ]
    const text = serializeWorldbuildingSections(sections)
    expect(text).toBe("[地理环境]\n山脉和河流\n\n[能力体系]\n内力修炼")
  })

  it("omits empty sections", () => {
    const sections: WorldbuildingSection[] = [
      { title: "地理环境", content: "山脉" },
      { title: "势力与阵营", content: "" },
    ]
    const text = serializeWorldbuildingSections(sections)
    expect(text).toBe("[地理环境]\n山脉")
  })

  it("serializes single general section without header", () => {
    const sections: WorldbuildingSection[] = [
      { title: "通用", content: "奇幻世界" },
    ]
    const text = serializeWorldbuildingSections(sections)
    expect(text).toBe("奇幻世界")
  })
})
