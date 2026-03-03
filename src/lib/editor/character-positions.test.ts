import { describe, it, expect } from "vitest"
import { findCharacterMentions, type CharacterMention } from "./character-positions"

describe("findCharacterMentions", () => {
  it("finds a single character name", () => {
    const result = findCharacterMentions("陈安走进了房间", ["陈安"])
    expect(result).toEqual([{ name: "陈安", from: 0, to: 2 }])
  })

  it("finds multiple occurrences of the same name", () => {
    const result = findCharacterMentions("陈安说：陈安来了", ["陈安"])
    expect(result).toEqual([
      { name: "陈安", from: 0, to: 2 },
      { name: "陈安", from: 4, to: 6 },
    ])
  })

  it("finds multiple different characters", () => {
    const result = findCharacterMentions("陈安和林月走在路上", ["陈安", "林月"])
    expect(result).toEqual([
      { name: "陈安", from: 0, to: 2 },
      { name: "林月", from: 3, to: 5 },
    ])
  })

  it("returns empty array when no matches", () => {
    const result = findCharacterMentions("一片寂静", ["陈安"])
    expect(result).toEqual([])
  })

  it("returns empty array for empty character list", () => {
    const result = findCharacterMentions("陈安走了", [])
    expect(result).toEqual([])
  })

  it("handles overlapping names — longer name wins", () => {
    const result = findCharacterMentions("陈安然来了", ["陈安", "陈安然"])
    expect(result).toEqual([{ name: "陈安然", from: 0, to: 3 }])
  })
})
