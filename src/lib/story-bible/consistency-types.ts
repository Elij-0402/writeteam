export interface CharacterConsistencyEntry {
  name: string
  facts: string[]
}

export interface LocationConsistencyEntry {
  name: string
  facts: string[]
}

export interface ItemConsistencyEntry {
  name: string
  facts: string[]
}

export interface ConsistencyRuleEntry {
  rule: string
}

export interface ConsistencyState {
  characters: CharacterConsistencyEntry[]
  locations: LocationConsistencyEntry[]
  items: ItemConsistencyEntry[]
  rules: ConsistencyRuleEntry[]
}

export function createEmptyConsistencyState(): ConsistencyState {
  return {
    characters: [],
    locations: [],
    items: [],
    rules: [],
  }
}
