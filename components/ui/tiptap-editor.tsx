"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import LinkExtension from "@tiptap/extension-link";
import { Markdown as TiptapMarkdown } from "tiptap-markdown";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  Undo,
  Redo,
  Scissors,
  Copy,
  Clipboard,
  ChevronsLeft,
  ChevronsRight,
  X,
  PenLine,
  Clock,
  ChevronDown,
  Sparkles,
  Loader2,
  ArrowRight,
} from "lucide-react";

// ProseMirror plugin to persist selection highlight when editor loses focus
const aiHighlightKey = new PluginKey("aiHighlight");

const AiHighlight = Extension.create({
  name: "aiHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: aiHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, old) => {
            const meta = tr.getMeta(aiHighlightKey);
            if (meta !== undefined) return meta;
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations: (state) => aiHighlightKey.getState(state),
        },
      }),
    ];
  },
});

interface TiptapEditorProps {
  content: string;
  onUpdate?: (markdown: string) => void;
  editable?: boolean;
  streaming?: boolean;
  onSave?: (markdown: string) => void;
  onClose?: () => void;
  caseId?: string;
  documentId?: string;
  documentName?: string;
  inlineEditUrl?: string;
}

export function TiptapEditor({
  content,
  onUpdate,
  editable = true,
  streaming = false,
  onSave,
  onClose,
  caseId,
  documentName,
  inlineEditUrl,
}: TiptapEditorProps) {
  const isEditable = editable && !streaming;
  const lastContentRef = useRef(content);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing..." }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline cursor-pointer" },
      }),
      TiptapMarkdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      AiHighlight,
    ],
    content,
    editable: isEditable,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (ed.storage as any).markdown.getMarkdown() as string;
      lastContentRef.current = md;
      onUpdate?.(md);
    },
    // Re-render on every transaction so toolbar reflects cursor state
    onTransaction() {
      setTick((n) => n + 1);
    },
  });

  // Close block menu on outside click
  useEffect(() => {
    if (!blockMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        blockMenuRef.current &&
        !blockMenuRef.current.contains(e.target as Node)
      ) {
        setBlockMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [blockMenuOpen]);

  // Sync editable prop
  useEffect(() => {
    if (editor) editor.setEditable(isEditable);
  }, [editor, isEditable]);

  // Cmd+S save shortcut
  useEffect(() => {
    if (!onSave || !editor) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const md = (editor.storage as any).markdown.getMarkdown() as string;
        onSave(md);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [editor, onSave]);

  // Sync external content changes (e.g. switching documents, streaming)
  useEffect(() => {
    if (!editor) return;
    if (content !== lastContentRef.current) {
      lastContentRef.current = content;
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl || "");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  // --- AI inline edit state ---
  const [savedSelection, setSavedSelection] = useState<{
    from: number;
    to: number;
    text: string;
  } | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPanelPos, setAiPanelPos] = useState({ x: 0, y: 0 });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const aiInputRef = useRef<HTMLInputElement>(null);
  const aiPanelRef = useRef<HTMLDivElement>(null);

  const captureSelection = useCallback(() => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (!empty) {
      setSavedSelection({
        from,
        to,
        text: editor.state.doc.textBetween(from, to, " "),
      });
    } else {
      setSavedSelection(null);
    }
  }, [editor]);

  const executeAiEdit = useCallback(
    async (instruction: string) => {
      if (!savedSelection || !caseId || !editor) return;
      setAiLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const md = (editor.storage as any).markdown.getMarkdown() as string;
        const editUrl = inlineEditUrl || `/api/case/${caseId}/inline-edit`;
        const res = await fetch(editUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedText: savedSelection.text,
            instruction,
            fullDocument: md,
            documentName,
          }),
        });
        if (!res.ok) throw new Error("Inline edit failed");

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No reader");
        const decoder = new TextDecoder();
        let accumulated = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
        }

        if (accumulated.trim()) {
          editor
            .chain()
            .focus()
            .setTextSelection({
              from: savedSelection.from,
              to: savedSelection.to,
            })
            .deleteSelection()
            .insertContent(accumulated.trim())
            .run();
        }
      } catch (err) {
        console.error("Inline edit error:", err);
      } finally {
        setAiLoading(false);
        setAiPanelOpen(false);
        setAiInput("");
        setSavedSelection(null);
      }
    },
    [savedSelection, caseId, editor, documentName],
  );

  const startAiEdit = useCallback(
    (instruction: string, immediate: boolean) => {
      if (!editor || !savedSelection) return;
      const coords = editor.view.coordsAtPos(savedSelection.to);
      setAiPanelPos({ x: coords.left, y: coords.bottom + 8 });
      setAiInput(instruction);
      setAiPanelOpen(true);
      if (immediate) {
        executeAiEdit(instruction);
      } else {
        setTimeout(() => aiInputRef.current?.focus(), 50);
      }
    },
    [editor, savedSelection, executeAiEdit],
  );

  // Persist selection highlight via ProseMirror decorations when AI panel is open
  useEffect(() => {
    if (!editor) return;
    const { view } = editor;
    if (aiPanelOpen && savedSelection) {
      const deco = DecorationSet.create(view.state.doc, [
        Decoration.inline(savedSelection.from, savedSelection.to, {
          class: "ai-selection-highlight",
        }),
      ]);
      view.dispatch(view.state.tr.setMeta(aiHighlightKey, deco));
    } else {
      view.dispatch(
        view.state.tr.setMeta(aiHighlightKey, DecorationSet.empty),
      );
    }
  }, [editor, aiPanelOpen, savedSelection]);

  // Close AI panel on outside click
  useEffect(() => {
    if (!aiPanelOpen || aiLoading) return;
    const handler = (e: MouseEvent) => {
      if (
        aiPanelRef.current &&
        !aiPanelRef.current.contains(e.target as Node)
      ) {
        setAiPanelOpen(false);
        setAiInput("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [aiPanelOpen, aiLoading]);

  if (!editor) return null;

  const currentBlockType = editor.isActive("heading", { level: 1 })
    ? "Heading 1"
    : editor.isActive("heading", { level: 2 })
      ? "Heading 2"
      : editor.isActive("heading", { level: 3 })
        ? "Heading 3"
        : "Paragraph";

  const blockTypes = [
    {
      label: "Paragraph",
      action: () => editor.chain().focus().setParagraph().run(),
    },
    {
      label: "Heading 1",
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: "Heading 2",
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Heading 3",
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {isEditable && (
        <div className="shrink-0 flex items-center px-2 py-1.5 border-b border-border bg-background">
          {/* Left: collapse + formatting */}
          <div className="flex items-center gap-0.5 flex-1 min-w-0">
            <ToolbarButton
              active={false}
              onClick={() => setToolbarCollapsed(!toolbarCollapsed)}
              title={toolbarCollapsed ? "Expand toolbar" : "Collapse toolbar"}
            >
              {toolbarCollapsed ? (
                <ChevronsRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronsLeft className="w-3.5 h-3.5" />
              )}
            </ToolbarButton>

            {!toolbarCollapsed && (
              <>
                <Separator />

                {/* Block type dropdown */}
                <div className="relative" ref={blockMenuRef}>
                  <button
                    type="button"
                    onClick={() => setBlockMenuOpen(!blockMenuOpen)}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md hover:bg-muted transition-colors text-foreground min-w-[90px]"
                  >
                    {currentBlockType}
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </button>
                  {blockMenuOpen && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[140px]">
                      {blockTypes.map((bt) => (
                        <button
                          key={bt.label}
                          type="button"
                          onClick={() => {
                            bt.action();
                            setBlockMenuOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors",
                            currentBlockType === bt.label &&
                              "bg-muted font-medium",
                          )}
                        >
                          {bt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Text formatting */}
                <ToolbarButton
                  active={editor.isActive("bold")}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </ToolbarButton>
                <ToolbarButton
                  active={editor.isActive("italic")}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </ToolbarButton>
                <ToolbarButton
                  active={editor.isActive("underline")}
                  onClick={() =>
                    editor.chain().focus().toggleUnderline().run()
                  }
                  title="Underline"
                >
                  <UnderlineIcon className="w-3.5 h-3.5" />
                </ToolbarButton>
                <ToolbarButton
                  active={editor.isActive("strike")}
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  title="Strikethrough"
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                </ToolbarButton>

                <Separator />

                {/* Lists */}
                <ToolbarButton
                  active={editor.isActive("bulletList")}
                  onClick={() =>
                    editor.chain().focus().toggleBulletList().run()
                  }
                  title="Bullet list"
                >
                  <List className="w-3.5 h-3.5" />
                </ToolbarButton>
                <ToolbarButton
                  active={editor.isActive("orderedList")}
                  onClick={() =>
                    editor.chain().focus().toggleOrderedList().run()
                  }
                  title="Ordered list"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </ToolbarButton>

                <Separator />

                {/* Alignment */}
                <ToolbarButton
                  active={editor.isActive({ textAlign: "left" })}
                  onClick={() =>
                    editor.chain().focus().setTextAlign("left").run()
                  }
                  title="Align left"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </ToolbarButton>
                <ToolbarButton
                  active={editor.isActive({ textAlign: "center" })}
                  onClick={() =>
                    editor.chain().focus().setTextAlign("center").run()
                  }
                  title="Align center"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </ToolbarButton>
                <ToolbarButton
                  active={editor.isActive({ textAlign: "right" })}
                  onClick={() =>
                    editor.chain().focus().setTextAlign("right").run()
                  }
                  title="Align right"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </ToolbarButton>
                <ToolbarButton
                  active={editor.isActive({ textAlign: "justify" })}
                  onClick={() =>
                    editor.chain().focus().setTextAlign("justify").run()
                  }
                  title="Justify"
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                </ToolbarButton>

                <Separator />

                {/* Clear formatting */}
                <ToolbarButton
                  active={false}
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .unsetAllMarks()
                      .clearNodes()
                      .run()
                  }
                  title="Clear formatting"
                >
                  <span className="text-[11px] font-serif font-medium leading-none">
                    Aa
                  </span>
                </ToolbarButton>

                {/* Link */}
                <ToolbarButton
                  active={editor.isActive("link")}
                  onClick={setLink}
                  title="Link"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                </ToolbarButton>

                <Separator />

                {/* Clipboard */}
                <ToolbarButton
                  active={false}
                  onClick={() => document.execCommand("cut")}
                  title="Cut"
                >
                  <Scissors className="w-3.5 h-3.5" />
                </ToolbarButton>
                <ToolbarButton
                  active={false}
                  onClick={() => document.execCommand("copy")}
                  title="Copy"
                >
                  <Copy className="w-3.5 h-3.5" />
                </ToolbarButton>
                <ToolbarButton
                  active={false}
                  onClick={() => {
                    navigator.clipboard
                      .readText()
                      .then((text) => {
                        editor.chain().focus().insertContent(text).run();
                      })
                      .catch(() => document.execCommand("paste"));
                  }}
                  title="Paste"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                </ToolbarButton>

                <Separator />

                {/* Undo / Redo */}
                <ToolbarButton
                  active={false}
                  onClick={() => editor.chain().focus().undo().run()}
                  disabled={!editor.can().undo()}
                  title="Undo"
                >
                  <Undo className="w-3.5 h-3.5" />
                </ToolbarButton>
                <ToolbarButton
                  active={false}
                  onClick={() => editor.chain().focus().redo().run()}
                  disabled={!editor.can().redo()}
                  title="Redo"
                >
                  <Redo className="w-3.5 h-3.5" />
                </ToolbarButton>
              </>
            )}
          </div>

          {/* Right: Show edits, Version, Close */}
          <div className="flex items-center gap-0.5 shrink-0 ml-2">
            <button
              type="button"
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              title="Show edits (coming soon)"
            >
              <PenLine className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Show edits</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              title="Version history (coming soon)"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Version 1</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Editor body - paper page on gray background */}
      <div className="flex-1 min-h-0 overflow-auto bg-[#f1f3f4] dark:bg-neutral-900 relative">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className="max-w-[816px] mx-auto my-8 bg-white dark:bg-card shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_8px_rgba(0,0,0,0.08)]"
              onContextMenu={captureSelection}
            >
              <EditorContent
                editor={editor}
                className="prose prose-stone dark:prose-invert max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[800px] [&_.ProseMirror]:px-24 [&_.ProseMirror]:py-16 markdown-body"
              />
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            <ContextMenuItem
              onSelect={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="w-3.5 h-3.5 mr-2" />
              Bold
              <ContextMenuShortcut>Cmd+B</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="w-3.5 h-3.5 mr-2" />
              Italic
              <ContextMenuShortcut>Cmd+I</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => editor.chain().focus().toggleUnderline().run()}
            >
              <UnderlineIcon className="w-3.5 h-3.5 mr-2" />
              Underline
              <ContextMenuShortcut>Cmd+U</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => editor.chain().focus().toggleStrike().run()}
            >
              <Strikethrough className="w-3.5 h-3.5 mr-2" />
              Strikethrough
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => document.execCommand("copy")}>
              <Copy className="w-3.5 h-3.5 mr-2" />
              Copy
              <ContextMenuShortcut>Cmd+C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => document.execCommand("cut")}>
              <Scissors className="w-3.5 h-3.5 mr-2" />
              Cut
              <ContextMenuShortcut>Cmd+X</ContextMenuShortcut>
            </ContextMenuItem>

            {savedSelection && caseId && (
              <>
                <ContextMenuSeparator />
                <ContextMenuLabel className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                  <Sparkles className="w-3 h-3" />
                  AI Edit
                </ContextMenuLabel>
                <ContextMenuItem
                  onSelect={() =>
                    startAiEdit(
                      "Improve the writing quality and clarity",
                      true,
                    )
                  }
                >
                  Improve writing
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() =>
                    startAiEdit(
                      "Make this more concise while keeping key points",
                      true,
                    )
                  }
                >
                  Make concise
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() =>
                    startAiEdit(
                      "Make this more formal and professional",
                      true,
                    )
                  }
                >
                  Make formal
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => startAiEdit("", false)}>
                  <Sparkles className="w-3.5 h-3.5 mr-2 text-primary" />
                  Custom instruction...
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>

        {/* Floating AI edit panel */}
        {aiPanelOpen && savedSelection && (
          <div
            ref={aiPanelRef}
            className="fixed z-50 w-[340px] bg-popover border border-border rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] p-3 animate-in fade-in-0 zoom-in-95 duration-150"
            style={{
              top: aiPanelPos.y,
              left: Math.min(aiPanelPos.x, window.innerWidth - 360),
            }}
          >
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2.5 border transition-colors",
                aiLoading
                  ? "bg-muted/30 border-border"
                  : "bg-muted/50 border-transparent focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10",
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                ref={aiInputRef}
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && aiInput.trim() && !aiLoading) {
                    executeAiEdit(aiInput.trim());
                  }
                  if (e.key === "Escape" && !aiLoading) {
                    setAiPanelOpen(false);
                    setAiInput("");
                  }
                }}
                placeholder="Ask AI to edit selection..."
                disabled={aiLoading}
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
              />
              {aiLoading ? (
                <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    aiInput.trim() && executeAiEdit(aiInput.trim())
                  }
                  disabled={!aiInput.trim()}
                  className="p-0.5 rounded text-muted-foreground hover:text-primary disabled:opacity-30 transition-colors shrink-0"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {!aiLoading && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {[
                  {
                    label: "Improve",
                    instruction:
                      "Improve the writing quality and clarity",
                  },
                  {
                    label: "Shorten",
                    instruction:
                      "Make this more concise while keeping key points",
                  },
                  {
                    label: "Formalize",
                    instruction:
                      "Make this more formal and professional",
                  },
                  {
                    label: "Expand",
                    instruction:
                      "Expand this with more detail and supporting evidence",
                  },
                ].map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => {
                      setAiInput(action.instruction);
                      executeAiEdit(action.instruction);
                    }}
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {aiLoading && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Rewriting selection...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  disabled,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "p-1.5 rounded-md transition-colors text-muted-foreground hover:bg-muted hover:text-foreground",
        active && "bg-primary/12 text-primary shadow-[inset_0_0_0_1px_rgba(var(--color-primary)/0.15)]",
        disabled && "opacity-30 pointer-events-none",
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-border mx-1" />;
}
