import { Extension, type Range } from "@tiptap/core"
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion"
import { ReactRenderer } from "@tiptap/react"
import type { Editor } from "@tiptap/core"
import type { SlashCommand } from "@/lib/slash-commands"
import { SlashCommandMenu, type SlashMenuHandle } from "./slash-command-menu"

export interface SlashTriggerProps {
  query: string
  editor: Editor
  range: Range
  items: SlashCommand[]
  clientRect?: (() => DOMRect | null) | null
  command: (item: SlashMenuSelection) => void
}

export interface SlashMenuSelection {
  command: SlashCommand
  argValue?: string
}

export interface SlashCommandExtensionOptions {
  /** Fetcher that returns the current command list for the editor's context. */
  getCommands: () => SlashCommand[]
  /** Called when user picks a command + arg. Extension deletes the `/query` range before this fires. */
  onSelect: (selection: SlashMenuSelection, range: Range) => void
}

/**
 * Tiptap Extension wiring `@tiptap/suggestion` to a React-rendered slash menu.
 * The host (TiptapEditor) supplies a current command list and a select callback.
 */
export const SlashCommandExtension = Extension.create<SlashCommandExtensionOptions>({
  name: "slashCommand",

  addOptions() {
    return {
      getCommands: () => [],
      onSelect: () => {},
    }
  },

  addProseMirrorPlugins() {
    const extension = this

    const suggestionConfig: Omit<SuggestionOptions<SlashCommand>, "editor"> = {
      char: "/",
      startOfLine: false,
      allowSpaces: false,
      // We intercept selection ourselves via the menu component — the built-in
      // `command` field just needs to delete the typed `/foo` range.
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run()
      },
      items: ({ query }) => {
        const commands = extension.options.getCommands()
        if (!query) return commands
        const q = query.toLowerCase()
        return commands.filter(
          (c) =>
            c.label.toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q),
        )
      },
      render: () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let renderer: ReactRenderer<SlashMenuHandle, any> | null = null
        let popup: HTMLDivElement | null = null

        const position = (clientRect?: (() => DOMRect | null) | null) => {
          if (!popup) return
          const rect = clientRect?.()
          if (!rect) return
          const menuRect = popup.getBoundingClientRect()
          const viewport = { w: window.innerWidth, h: window.innerHeight }
          const margin = 8
          let top = rect.bottom + margin
          if (top + menuRect.height > viewport.h - margin) {
            top = Math.max(margin, rect.top - menuRect.height - margin)
          }
          let left = rect.left
          if (left + menuRect.width > viewport.w - margin) {
            left = Math.max(margin, viewport.w - menuRect.width - margin)
          }
          popup.style.top = `${top}px`
          popup.style.left = `${left}px`
        }

        return {
          onStart: (props) => {
            popup = document.createElement("div")
            popup.style.position = "fixed"
            popup.style.zIndex = "70"
            document.body.appendChild(popup)

            renderer = new ReactRenderer(SlashCommandMenu, {
              editor: props.editor,
              props: {
                ...props,
                command: (selection: SlashMenuSelection) => {
                  extension.options.onSelect(selection, props.range)
                  // After onSelect, the host is responsible for inserting content.
                  // We still delete the typed `/query` range here.
                  props.editor.chain().focus().deleteRange(props.range).run()
                },
              },
            })
            popup.appendChild(renderer.element)
            requestAnimationFrame(() => position(props.clientRect))
          },
          onUpdate: (props) => {
            if (!renderer) return
            renderer.updateProps({
              ...props,
              command: (selection: SlashMenuSelection) => {
                extension.options.onSelect(selection, props.range)
                props.editor.chain().focus().deleteRange(props.range).run()
              },
            })
            requestAnimationFrame(() => position(props.clientRect))
          },
          onKeyDown: (props) => {
            if (props.event.key === "Escape") {
              renderer?.destroy()
              popup?.remove()
              renderer = null
              popup = null
              return true
            }
            return renderer?.ref?.onKeyDown?.(props) ?? false
          },
          onExit: () => {
            renderer?.destroy()
            popup?.remove()
            renderer = null
            popup = null
          },
        }
      },
    }

    return [
      Suggestion({
        editor: this.editor,
        ...suggestionConfig,
      }),
    ]
  },
})
