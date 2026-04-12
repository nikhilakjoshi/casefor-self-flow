"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  List,
  ListOrdered,
  User,
  UserCheck,
  Paperclip,
  FileSearch,
  Scale,
  ShieldAlert,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SlashArg, SlashCommand } from "@/lib/slash-commands"
import type { SlashMenuSelection } from "./slash-command-extension"

type SuggestionKeyDownProps = { event: KeyboardEvent }

export interface SlashMenuHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

interface Props {
  items: SlashCommand[]
  query: string
  command: (selection: SlashMenuSelection) => void
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "list-ordered": ListOrdered,
  list: List,
  user: User,
  "user-check": UserCheck,
  paperclip: Paperclip,
  "file-search": FileSearch,
  scale: Scale,
  "shield-alert": ShieldAlert,
  sparkles: Sparkles,
}

function renderIcon(name: string) {
  const C = ICONS[name] ?? Sparkles
  return <C className="w-4 h-4 shrink-0 text-muted-foreground" />
}

type Mode =
  | { kind: "commands" }
  | { kind: "args"; command: SlashCommand; filter: string }

export const SlashCommandMenu = forwardRef<SlashMenuHandle, Props>(function SlashCommandMenu(
  { items, query, command },
  ref,
) {
  const [mode, setMode] = useState<Mode>({ kind: "commands" })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const argInputRef = useRef<HTMLInputElement>(null)

  // Reset to command mode when the outer query changes
  useEffect(() => {
    setMode({ kind: "commands" })
    setSelectedIndex(0)
  }, [query])

  // Focus arg input when entering arg mode
  useEffect(() => {
    if (mode.kind === "args") {
      setTimeout(() => argInputRef.current?.focus(), 0)
    }
  }, [mode.kind])

  const filteredCommands = items

  const filteredArgs = useMemo<SlashArg[]>(() => {
    if (mode.kind !== "args") return []
    if (!mode.filter) return mode.command.args
    const q = mode.filter.toLowerCase()
    return mode.command.args.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.value.toLowerCase().includes(q),
    )
  }, [mode])

  // Keep selection in range
  useEffect(() => {
    const len =
      mode.kind === "commands" ? filteredCommands.length : filteredArgs.length
    if (selectedIndex >= len) setSelectedIndex(Math.max(0, len - 1))
  }, [mode.kind, filteredCommands.length, filteredArgs.length, selectedIndex])

  const pickCommand = (cmd: SlashCommand) => {
    if (cmd.argKind === "none") {
      command({ command: cmd })
      return
    }
    setMode({ kind: "args", command: cmd, filter: "" })
    setSelectedIndex(0)
  }

  const pickArg = (arg: SlashArg) => {
    if (mode.kind !== "args") return
    command({ command: mode.command, argValue: arg.value })
  }

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }) => {
        if (mode.kind === "commands") {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setSelectedIndex((i) =>
              filteredCommands.length ? (i + 1) % filteredCommands.length : 0,
            )
            return true
          }
          if (event.key === "ArrowUp") {
            event.preventDefault()
            setSelectedIndex((i) =>
              filteredCommands.length
                ? (i - 1 + filteredCommands.length) % filteredCommands.length
                : 0,
            )
            return true
          }
          if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault()
            const cmd = filteredCommands[selectedIndex]
            if (cmd) pickCommand(cmd)
            return true
          }
          return false
        }

        // mode.kind === "args"
        if (event.key === "ArrowDown") {
          event.preventDefault()
          setSelectedIndex((i) =>
            filteredArgs.length ? (i + 1) % filteredArgs.length : 0,
          )
          return true
        }
        if (event.key === "ArrowUp") {
          event.preventDefault()
          setSelectedIndex((i) =>
            filteredArgs.length
              ? (i - 1 + filteredArgs.length) % filteredArgs.length
              : 0,
          )
          return true
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault()
          const arg = filteredArgs[selectedIndex]
          if (arg) pickArg(arg)
          return true
        }
        if (event.key === "Backspace" && mode.filter === "") {
          event.preventDefault()
          setMode({ kind: "commands" })
          setSelectedIndex(0)
          return true
        }
        // Let the arg input handle other characters natively
        return false
      },
    }),
    [mode, filteredCommands, filteredArgs, selectedIndex],
  )

  return (
    <div
      className="w-[340px] max-h-[360px] overflow-hidden rounded-xl border border-border bg-popover shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex flex-col text-sm"
      onMouseDown={(e) => e.preventDefault()}
    >
      {mode.kind === "commands" ? (
        <>
          <div className="px-3 py-2 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground/70">
            AI Commands
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {filteredCommands.length === 0 ? (
              <div className="px-3 py-4 text-muted-foreground text-xs">
                No commands match.
              </div>
            ) : (
              filteredCommands.map((cmd, i) => (
                <button
                  type="button"
                  key={cmd.id}
                  onClick={() => pickCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                    i === selectedIndex
                      ? "bg-muted text-foreground"
                      : "text-foreground hover:bg-muted/60",
                  )}
                >
                  {renderIcon(cmd.icon)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate">{cmd.label}</span>
                      {cmd.needsLLM && (
                        <Sparkles className="w-3 h-3 text-primary shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {cmd.description}
                    </div>
                  </div>
                  {cmd.argKind !== "none" && (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
          <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground/70 flex items-center gap-3">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
          </div>
        </>
      ) : (
        <>
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setMode({ kind: "commands" })
                setSelectedIndex(0)
              }}
              className="p-1 rounded hover:bg-muted text-muted-foreground"
              title="Back"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70 flex-1">
              {mode.command.label}
            </div>
          </div>
          <div className="px-2 pt-2">
            <input
              ref={argInputRef}
              type="text"
              value={mode.filter}
              onChange={(e) => {
                setMode({ ...mode, filter: e.target.value })
                setSelectedIndex(0)
              }}
              placeholder={mode.command.placeholder ?? "Filter..."}
              className="w-full text-xs bg-muted/50 rounded-md px-2.5 py-1.5 outline-none border border-transparent focus:border-primary/30"
            />
          </div>
          <div className="flex-1 overflow-y-auto py-1 mt-1">
            {filteredArgs.length === 0 ? (
              <div className="px-3 py-4 text-muted-foreground text-xs">
                No options match.
              </div>
            ) : (
              filteredArgs.map((arg, i) => (
                <button
                  type="button"
                  key={arg.value}
                  onClick={() => pickArg(arg)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={cn(
                    "w-full flex flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors",
                    i === selectedIndex
                      ? "bg-muted text-foreground"
                      : "text-foreground hover:bg-muted/60",
                  )}
                >
                  <div className="font-medium text-xs truncate max-w-full">
                    {arg.label}
                  </div>
                  {arg.description && (
                    <div className="text-[10px] text-muted-foreground truncate max-w-full">
                      {arg.description}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
          <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground/70 flex items-center gap-3">
            <span>↵ insert</span>
            <span>⌫ back</span>
            <span>esc close</span>
          </div>
        </>
      )}
    </div>
  )
})
