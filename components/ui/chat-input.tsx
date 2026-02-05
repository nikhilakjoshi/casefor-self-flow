"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, ArrowUp, Paperclip } from "lucide-react";
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
}

export function ChatInput({
  onSend,
  onFileSelect,
  isLoading = false,
  placeholder = "Reply...",
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
