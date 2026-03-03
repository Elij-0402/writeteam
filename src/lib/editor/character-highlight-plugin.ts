import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { Extension } from "@tiptap/react"
import { findCharacterMentions } from "./character-positions"

const characterHighlightKey = new PluginKey("characterHighlight")

interface HighlightState {
  characters: string[]
  decorations: DecorationSet
}

function buildDecorations(
  doc: ProseMirrorNode,
  characterNames: string[]
): DecorationSet {
  if (!characterNames.length) return DecorationSet.empty

  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return

    const mentions = findCharacterMentions(node.text, characterNames)
    for (const m of mentions) {
      decorations.push(
        Decoration.inline(pos + m.from, pos + m.to, {
          class: "character-mention",
          "data-character-name": m.name,
        })
      )
    }
  })

  return DecorationSet.create(doc, decorations)
}

function createCharacterHighlightPlugin(): Plugin {
  return new Plugin({
    key: characterHighlightKey,
    state: {
      init: (): HighlightState => ({
        characters: [],
        decorations: DecorationSet.empty,
      }),
      apply: (
        tr,
        value: HighlightState,
        _oldState,
        newState
      ): HighlightState => {
        const meta = tr.getMeta(characterHighlightKey)
        if (meta?.characters !== undefined) {
          return {
            characters: meta.characters,
            decorations: buildDecorations(newState.doc, meta.characters),
          }
        }
        if (tr.docChanged) {
          return {
            characters: value.characters,
            decorations: buildDecorations(newState.doc, value.characters),
          }
        }
        return value
      },
    },
    props: {
      decorations: (state) => {
        return (
          characterHighlightKey.getState(state)?.decorations ??
          DecorationSet.empty
        )
      },
    },
  })
}

/** TipTap Extension wrapper */
export const CharacterHighlightExtension = Extension.create({
  name: "characterHighlight",

  addProseMirrorPlugins() {
    return [createCharacterHighlightPlugin()]
  },
})

/** Call this to update the character names used for highlighting. */
export function setHighlightCharacters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any,
  characters: string[]
) {
  const tr = editor.view.state.tr.setMeta(characterHighlightKey, {
    characters,
  })
  editor.view.dispatch(tr)
}
