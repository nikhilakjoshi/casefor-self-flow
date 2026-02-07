"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, ArrowUp, Paperclip, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatInputProps {
  onSend: (text: string) => void;
  onFileSelect?: (file: File) => void;
  isLoading?: boolean;
  placeholder?: string;
  showEvidenceAction?: boolean;
  onStartEvidence?: () => void;
}

export function ChatInput({
  onSend,
  onFileSelect,
  isLoading = false,
  placeholder = "Reply...",
  showEvidenceAction = false,
  onStartEvidence,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maxHeight = 320;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, [message]);

  const handleSend = useCallback(() => {
    if (!message.trim() || isLoading) return;
    onSend(message.trim());
    setMessage("");
  }, [message, isLoading, onSend]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFileClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onFileSelect) {
      onFileSelect(file);
    }
    // Reset so same file can be selected again
    e.target.value = "";
  }

  return (
    <div className="w-full">
      <div className="rounded-2xl bg-muted p-4">
        {/* Input area */}
        <div className="mb-3">
          <ScrollArea className="max-h-[320px]">
            <textarea
              ref={textareaRef}
              placeholder={placeholder}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
              className="w-full bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-base resize-none min-h-[24px] overflow-hidden disabled:opacity-50"
            />
          </ScrollArea>
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between">
          {/* Left side */}
          <div className="flex items-center gap-1">
            {onFileSelect && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:bg-accent rounded-lg"
                    disabled={isLoading}
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 rounded-xl">
                  <DropdownMenuItem
                    onClick={handleFileClick}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
                  >
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Attach file</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Evidence phase action button */}
            {showEvidenceAction && onStartEvidence && (
              <button
                onClick={onStartEvidence}
                className="group relative h-8 px-3 flex items-center gap-2 rounded-lg text-sm font-medium transition-all duration-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200/60 dark:border-amber-700/40 text-amber-700 dark:text-amber-300 hover:border-amber-300 dark:hover:border-amber-600 hover:shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:scale-[1.02]"
              >
                {/* Subtle glow backdrop */}
                <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-amber-400/0 via-amber-400/10 to-orange-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Animated ring */}
                <span className="absolute inset-0 rounded-lg animate-[ping_2s_ease-in-out_infinite] bg-amber-400/20 opacity-75" style={{ animationDuration: '2.5s' }} />

                <Rocket className="h-4 w-4 relative z-10 transition-transform duration-300 group-hover:rotate-[-15deg] group-hover:translate-x-[1px] group-hover:-translate-y-[1px]" />
                <span className="relative z-10">Start Evidence</span>
              </button>
            )}
          </div>

          {/* Right side - send */}
          <Button
            size="icon"
            className="h-8 w-8 rounded-full"
            disabled={!message.trim() || isLoading}
            onClick={handleSend}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.txt"
        onChange={handleFileChange}
      />
    </div>
  );
}
