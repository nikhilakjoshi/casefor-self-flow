"use client";

import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import { Markdown } from "markdown-to-jsx";
import { IntakeFormCard } from "./intake-form-card";

interface IntakeFormMetadata {
  type: "intake_form";
  section: string;
  fields: Array<{
    key: string;
    label: string;
    type: "text" | "number" | "boolean" | "textarea";
    placeholder?: string;
  }>;
  prompt?: string;
}

interface MessageItemProps {
  role: "user" | "assistant";
  content: string;
  isFileUpload?: boolean;
  metadata?: Record<string, unknown> | null;
  caseId?: string;
}

export function MessageItem({
  role,
  content,
  isFileUpload,
  metadata,
  caseId,
}: MessageItemProps) {
  const isUser = role === "user";

  // Check if this message contains an intake form
  const intakeForm = metadata?.type === "intake_form" ? (metadata as unknown as IntakeFormMetadata) : null;

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3 text-sm",
          isUser ? "bg-muted text-foreground" : "text-foreground",
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
          <div className="space-y-3">
            {content && (
              <div className="markdown-body">
                <Markdown>{content}</Markdown>
              </div>
            )}
            {intakeForm && caseId && (
              <IntakeFormCard
                section={intakeForm.section}
                fields={intakeForm.fields}
                prompt={intakeForm.prompt}
                caseId={caseId}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
