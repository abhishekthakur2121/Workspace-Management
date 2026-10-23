"use client";

import { startTransition, useRef, useState } from "react";
import { Loader2, MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { addComment, deleteComment, editComment, type TaskThread, type ThreadComment } from "@/server/actions/comments";
import { fullDate, timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useBoard } from "../board-context";
import { focusAfterMenu } from "@/lib/focus";

// The task's comment thread: post, edit and delete updates.
export function Updates({
  taskId,
  thread,
  setThread,
}: {
  taskId: string;
  thread: TaskThread;
  setThread: React.Dispatch<React.SetStateAction<TaskThread | null>>;
}) {
  const { board, currentUserId } = useBoard();
  const me = board.users.find((u) => u.id === currentUserId);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

  function post() {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    const temp: ThreadComment = {
      id: `temp-${crypto.randomUUID()}`,
      body,
      createdAt: new Date().toISOString(),
      editedAt: null,
      author: { id: currentUserId, name: me?.name ?? null, email: me?.email ?? "", image: me?.image ?? null, active: true },
    };
    setThread((t) => t && { ...t, comments: [temp, ...t.comments] });
    setDraft("");
    startTransition(async () => {
      try {
        const saved = await addComment({ taskId, body });
        setThread((t) => t && { ...t, comments: t.comments.map((c) => (c.id === temp.id ? saved : c)) });
      } catch {
        setThread((t) => t && { ...t, comments: t.comments.filter((c) => c.id !== temp.id) });
        setDraft(body);
        toast.error("Couldn't post your update. Please try again.");
      } finally {
        setPosting(false);
        textarea.current?.focus();
      }
    });
  }

  return (
    <div className="space-y-4 p-6">
      <div className="card-shadow rounded-xl border border-grid bg-surface transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        <textarea
          ref={textarea}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post();
          }}
          rows={3}
          maxLength={5000}
          placeholder="Write an update…"
          aria-label="Write an update"
          className="block w-full resize-y rounded-t-xl bg-transparent px-4 pt-3 text-sm outline-none placeholder:text-muted"
        />
        <div className="flex items-center justify-between px-3 pb-2.5">
          <span className="text-xs text-muted">Ctrl + Enter to post</span>
          <Button size="sm" onClick={post} disabled={!draft.trim() || posting}>
            {posting && <Loader2 className="size-3.5 animate-spin" />} Update
          </Button>
        </div>
      </div>

      {thread.comments.length === 0 ? (
        <div className="grid place-items-center py-10 text-center">
          <MessageSquare className="size-8 text-muted/50" />
          <p className="mt-3 text-sm font-medium">No updates yet</p>
          <p className="mt-1 text-xs text-muted">Share progress, ask a question, or leave a note for the team.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {thread.comments.map((c) => (
            <CommentItem key={c.id} comment={c} setThread={setThread} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentItem({ comment, setThread }: { comment: ThreadComment; setThread: React.Dispatch<React.SetStateAction<TaskThread | null>> }) {
  const { currentUserId, isAdmin } = useBoard();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [confirming, setConfirming] = useState(false);
  // Author is null once that person was permanently deleted.
  const author = comment.author;
  const mine = author?.id === currentUserId;
  const pending = comment.id.startsWith("temp-");
  const name = author ? (author.name ?? author.email) : "Deleted user";

  function save() {
    const body = draft.trim();
    setEditing(false);
    if (!body || body === comment.body) return setDraft(comment.body);
    setThread((t) => t && { ...t, comments: t.comments.map((c) => (c.id === comment.id ? { ...c, body, editedAt: new Date().toISOString() } : c)) });
    startTransition(async () => {
      try {
        await editComment({ id: comment.id, body });
      } catch {
        toast.error("Couldn't save your edit.");
      }
    });
  }

  function remove() {
    setThread((t) => t && { ...t, comments: t.comments.filter((c) => c.id !== comment.id) });
    startTransition(async () => {
      try {
        await deleteComment({ id: comment.id });
      } catch {
        toast.error("Couldn't delete that update.");
      }
    });
  }

  return (
    <li className={cn("anim-page card-shadow group/comment rounded-xl border border-grid bg-surface p-4", pending && "opacity-70")}>
      <div className="flex items-center gap-2.5">
        <Avatar name={name} image={author?.image} className={cn("size-8 text-xs", !author?.active && "opacity-50 grayscale")} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="text-xs text-muted" title={fullDate(comment.createdAt)}>
            {pending ? "Posting…" : timeAgo(comment.createdAt)}
            {comment.editedAt && " · edited"}
          </p>
        </div>
        {!pending && (mine || isAdmin) && (
          <Menu modal={false}>
            <MenuTrigger asChild>
              <button
                aria-label="Update options"
                className="rounded-md p-1 text-muted opacity-0 transition group-hover/comment:opacity-100 hover:bg-hover focus:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </MenuTrigger>
            <MenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
              {mine && (
                <MenuItem icon={<Pencil />} onSelect={() => setEditing(true)}>
                  Edit update
                </MenuItem>
              )}
              <MenuItem danger icon={<Trash2 />} onSelect={() => setConfirming(true)}>
                Delete update
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </div>

      {editing ? (
        <div className="mt-3">
          <textarea
            ref={focusAfterMenu}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
              if (e.key === "Escape") {
                e.stopPropagation(); // don't close the panel
                setDraft(comment.body);
                setEditing(false);
              }
            }}
            rows={3}
            maxLength={5000}
            aria-label="Edit update"
            className="block w-full resize-y rounded-lg border border-primary bg-surface px-3 py-2 text-sm outline-none ring-2 ring-primary/15"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => (setDraft(comment.body), setEditing(false))}>
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
          <Linkified text={comment.body} />
        </p>
      )}

      {confirming && (
        <div className="anim-page mt-3 flex items-center justify-between gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm">
          <span className="text-danger">Delete this update?</span>
          <span className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Keep
            </Button>
            <Button size="sm" variant="danger" onClick={remove}>
              Delete
            </Button>
          </span>
        </div>
      )}
    </li>
  );
}

// Turns plain URLs into links; everything else stays text (no HTML is rendered).
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
