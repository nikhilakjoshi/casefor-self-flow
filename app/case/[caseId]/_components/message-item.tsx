"use client";

import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import { Markdown } from "markdown-to-jsx";

interface MessageItemProps {
  role: "user" | "assistant";
  content: string;
  isFileUpload?: boolean;
}

export function MessageItem({ role, content, isFileUpload }: MessageItemProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {isFileUpload ? (
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 shrink-0" />
            <span>{content}</span>
          </div>
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="markdown-body">
            <Markdown>{content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
