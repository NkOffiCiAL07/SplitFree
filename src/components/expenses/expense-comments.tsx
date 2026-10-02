"use client";

import type { ExpenseComment } from "@/types";
import { useState, useRef, useEffect } from "react";
import { Send, Trash2, MessageCircle } from "lucide-react";
import { useComments, useAddComment, useDeleteComment } from "@/hooks/use-comments";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials, cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export function ExpenseComments({ expenseId }: { expenseId: string }) {
  const { user } = useAuth();
  const { data: comments, isLoading } = useComments(expenseId);
  const addComment = useAddComment(expenseId);
  const deleteComment = useDeleteComment(expenseId);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await addComment.mutateAsync(text.trim());
    setText("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">Comments</h4>
        {comments && comments.length > 0 && (
          <span className="text-xs text-muted-foreground">({comments.length})</span>
        )}
      </div>

      {/* Thread */}
      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-3/4 rounded-lg" />
          </>
        ) : !comments || comments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">No comments yet. Be first!</p>
        ) : (
          comments.map((c: ExpenseComment) => {
            const isOwn = c.userId === user?.id;
            return (
              <div
                key={c.id}
                className={cn("flex gap-2 items-start group", isOwn && "flex-row-reverse")}
              >
                <Avatar className="size-6 shrink-0 mt-0.5">
                  <AvatarImage src={c.user?.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-[9px]">{getInitials(c.user?.name ?? "?")}</AvatarFallback>
                </Avatar>
                <div className={cn("flex-1 min-w-0 space-y-0.5", isOwn && "items-end flex flex-col")}>
                  <div className={cn(
                    "px-3 py-2 rounded-2xl text-sm max-w-[85%]",
                    isOwn
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  )}>
                    {c.text}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      {!isOwn && `${c.user?.name?.split(" ")[0]} · `}
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </span>
                    {isOwn && (
                      <button
                        onClick={() => deleteComment.mutate(c.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          className="h-8 text-sm"
          disabled={addComment.isPending}
        />
        <Button
          type="submit"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={!text.trim() || addComment.isPending}
          loading={addComment.isPending}
        >
          <Send className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}
