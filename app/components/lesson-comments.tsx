import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import { toast } from "sonner";
import { Lock, MessageSquare, Pencil, Reply, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { UserAvatar } from "~/components/user-avatar";
import { cn, formatRelativeTime } from "~/lib/utils";
import {
  MAX_COMMENT_LENGTH,
  MAX_DELETE_REASON_LENGTH,
  type CommentAccess,
  type CommentNode,
  type CommentReply,
} from "~/lib/comments";

// ─── Lesson discussion thread ───
// Two-level threading: top-level comments with a flat list of replies. Bodies
// are rendered as plain text (never through dangerouslySetInnerHTML), because
// comment text is student-authored - unlike lesson content, which is markdown
// rendered server-side.
//
// Every mutation goes through one shared fetcher that posts to the lesson
// route's action. A successful action revalidates the loader, so the thread
// updates in place without a navigation.

type CommentFetcher = ReturnType<typeof useFetcher>;

export interface LessonCommentsProps {
  lessonId: number;
  /** Null when the viewer may not read this thread at all. */
  comments: CommentNode[] | null;
  access: CommentAccess;
  currentUserId: number | null;
  loggedIn: boolean;
  courseSlug: string;
}

function countComments(comments: CommentNode[]): number {
  return comments.reduce((total, node) => total + 1 + node.replies.length, 0);
}

export function LessonComments({
  lessonId,
  comments,
  access,
  currentUserId,
  loggedIn,
  courseSlug,
}: LessonCommentsProps) {
  const fetcher = useFetcher({ key: `comments-${lessonId}` });
  // Bumped after a successful post so every open composer/editor resets.
  const [resetToken, setResetToken] = useState(0);
  const handledData = useRef<unknown>(null);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    // Revalidation re-renders with the same action data; only react once.
    if (handledData.current === fetcher.data) return;
    handledData.current = fetcher.data;

    const payload = fetcher.data as {
      commentError?: string;
      commentSuccess?: boolean;
    };

    if (payload.commentError) {
      toast.error(payload.commentError);
    } else if (payload.commentSuccess) {
      setResetToken((token) => token + 1);
    }
  }, [fetcher.state, fetcher.data]);

  if (!access.canRead || comments === null) {
    return (
      <Card className="mb-8">
        <CardContent className="py-10 text-center">
          <Lock className="mx-auto mb-3 size-8 text-muted-foreground" />
          <h2 className="mb-1 text-lg font-semibold">Lesson discussion</h2>
          <p className="mx-auto mb-4 max-w-md text-sm text-muted-foreground">
            {loggedIn
              ? "Enroll in this course to join the discussion with your instructor and classmates."
              : "Sign in and enroll in this course to join the discussion with your instructor and classmates."}
          </p>
          {loggedIn ? (
            <Link to={`/courses/${courseSlug}/purchase`}>
              <Button>Enroll to join</Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button>Sign in</Button>
            </Link>
          )}
        </CardContent>
      </Card>
    );
  }

  const total = countComments(comments);

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <MessageSquare className="size-5 text-primary" />
          <h2 className="text-xl font-semibold">Discussion</h2>
          <span className="text-sm text-muted-foreground">
            {total} {total === 1 ? "comment" : "comments"}
          </span>
        </div>

        {access.canPost ? (
          <CommentComposer
            fetcher={fetcher}
            resetToken={resetToken}
            intent="create-comment"
            placeholder="Ask a question or share what you learned..."
            submitLabel="Post comment"
          />
        ) : (
          <p className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
            Only enrolled students and the instructor can post in this
            discussion.
          </p>
        )}

        <div className="mt-6 space-y-6">
          {comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No comments yet. Ask a question about this lesson.
            </p>
          ) : (
            comments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                fetcher={fetcher}
                resetToken={resetToken}
                canPost={access.canPost}
                canModerate={access.canModerate}
                currentUserId={currentUserId}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CommentThread({
  comment,
  fetcher,
  resetToken,
  canPost,
  canModerate,
  currentUserId,
}: {
  comment: CommentNode;
  fetcher: CommentFetcher;
  resetToken: number;
  canPost: boolean;
  canModerate: boolean;
  currentUserId: number | null;
}) {
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    setReplying(false);
  }, [resetToken]);

  return (
    <div>
      <CommentRow
        comment={comment}
        fetcher={fetcher}
        resetToken={resetToken}
        canModerate={canModerate}
        currentUserId={currentUserId}
        showReplyAction={canPost && !comment.deleted}
        onReply={() => setReplying(true)}
      />

      {comment.replies.length > 0 && (
        <div className="mt-4 ml-10 space-y-4 border-l pl-4">
          {comment.replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              fetcher={fetcher}
              resetToken={resetToken}
              canModerate={canModerate}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {replying && (
        <div className="mt-4 ml-10">
          <CommentComposer
            fetcher={fetcher}
            resetToken={resetToken}
            intent="create-comment"
            parentId={comment.id}
            placeholder="Write a reply..."
            submitLabel="Reply"
            autoFocus
            onCancel={() => setReplying(false)}
          />
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  fetcher,
  resetToken,
  canModerate,
  currentUserId,
  showReplyAction = false,
  onReply,
}: {
  comment: CommentReply;
  fetcher: CommentFetcher;
  resetToken: number;
  canModerate: boolean;
  currentUserId: number | null;
  showReplyAction?: boolean;
  onReply?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    setEditing(false);
    setRemoving(false);
  }, [resetToken]);

  const isAuthor =
    comment.author !== null && comment.author.id === currentUserId;
  const canEdit = isAuthor && !comment.deleted;
  const canDelete = !comment.deleted && (isAuthor || canModerate);
  // A moderator removing someone else's comment can leave an optional reason.
  const isModeratorRemoval = canDelete && !isAuthor;
  const showActions =
    !comment.deleted && (showReplyAction || canEdit || canDelete);

  return (
    <div className="flex gap-3">
      {comment.author ? (
        <UserAvatar
          name={comment.author.name}
          avatarUrl={comment.author.avatarUrl}
          className="size-8 shrink-0"
        />
      ) : (
        <div className="size-8 shrink-0 rounded-full bg-muted" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">
            {comment.author?.name ?? "[deleted]"}
          </span>
          {comment.author?.isCourseInstructor && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              Instructor
            </span>
          )}
          <time
            dateTime={comment.createdAt}
            suppressHydrationWarning
            className="text-xs text-muted-foreground"
          >
            {formatRelativeTime(comment.createdAt)}
          </time>
          {comment.updatedAt && (
            <span className="text-xs text-muted-foreground">· edited</span>
          )}
        </div>

        {editing ? (
          <div className="mt-2">
            <EditCommentForm
              comment={comment}
              fetcher={fetcher}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <div className="mt-1">
            {comment.deleted ? (
              <Tombstone comment={comment} />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
            )}
          </div>
        )}

        {showActions && !editing && (
          <div className="mt-1.5 flex items-center gap-1">
            {showReplyAction && (
              <Button variant="ghost" size="xs" onClick={onReply}>
                <Reply className="size-3" />
                Reply
              </Button>
            )}
            {canEdit && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-3" />
                Edit
              </Button>
            )}
            {canDelete && !removing && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setRemoving(true)}
              >
                <Trash2 className="size-3" />
                {isModeratorRemoval ? "Remove" : "Delete"}
              </Button>
            )}
          </div>
        )}

        {removing && (
          <div className="mt-2">
            <DeleteCommentForm
              comment={comment}
              fetcher={fetcher}
              askForReason={isModeratorRemoval}
              onCancel={() => setRemoving(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Tombstone({ comment }: { comment: CommentReply }) {
  if (comment.removedByModerator) {
    const who = comment.deletedBy?.name ?? "a moderator";
    return (
      <p className="text-sm text-muted-foreground italic">
        [removed by {who}
        {comment.deletedReason ? `: ${comment.deletedReason}` : ""}]
      </p>
    );
  }

  return (
    <p className="text-sm text-muted-foreground italic">[deleted by author]</p>
  );
}

function CharCount({ length }: { length: number }) {
  const nearLimit = length > MAX_COMMENT_LENGTH * 0.9;

  return (
    <span
      className={cn(
        "text-xs",
        nearLimit ? "text-amber-600" : "text-muted-foreground"
      )}
    >
      {length} / {MAX_COMMENT_LENGTH}
    </span>
  );
}

function CommentComposer({
  fetcher,
  resetToken,
  intent,
  parentId,
  placeholder,
  submitLabel,
  autoFocus,
  onCancel,
}: {
  fetcher: CommentFetcher;
  resetToken: number;
  intent: "create-comment";
  parentId?: number;
  placeholder: string;
  submitLabel: string;
  autoFocus?: boolean;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState("");
  const busy = fetcher.state !== "idle";
  const isEmpty = body.trim().length === 0;

  useEffect(() => {
    setBody("");
  }, [resetToken]);

  return (
    <fetcher.Form method="post" className="space-y-2">
      <input type="hidden" name="intent" value={intent} />
      {parentId !== undefined && (
        <input type="hidden" name="parentId" value={parentId} />
      )}
      <Textarea
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={MAX_COMMENT_LENGTH}
        autoFocus={autoFocus}
      />
      <div className="flex items-center justify-between gap-2">
        <CharCount length={body.length} />
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" size="sm" disabled={isEmpty || busy}>
            {busy ? "Posting..." : submitLabel}
          </Button>
        </div>
      </div>
    </fetcher.Form>
  );
}

function EditCommentForm({
  comment,
  fetcher,
  onCancel,
}: {
  comment: CommentReply;
  fetcher: CommentFetcher;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(comment.body ?? "");
  const busy = fetcher.state !== "idle";
  const isEmpty = body.trim().length === 0;

  return (
    <fetcher.Form method="post" className="space-y-2">
      <input type="hidden" name="intent" value="update-comment" />
      <input type="hidden" name="commentId" value={comment.id} />
      <Textarea
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={MAX_COMMENT_LENGTH}
        autoFocus
      />
      <div className="flex items-center justify-between gap-2">
        <CharCount length={body.length} />
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isEmpty || busy}>
            {busy ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </fetcher.Form>
  );
}

function DeleteCommentForm({
  comment,
  fetcher,
  askForReason,
  onCancel,
}: {
  comment: CommentReply;
  fetcher: CommentFetcher;
  askForReason: boolean;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const busy = fetcher.state !== "idle";

  return (
    <fetcher.Form
      method="post"
      className="space-y-2 rounded-md border bg-muted/40 p-3"
    >
      <input type="hidden" name="intent" value="delete-comment" />
      <input type="hidden" name="commentId" value={comment.id} />
      <p className="text-sm">
        {askForReason
          ? "Remove this comment? The author will see that a moderator removed it."
          : "Delete this comment? Replies will stay visible."}
      </p>
      {askForReason && (
        <Input
          name="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason (optional, shown to readers)"
          maxLength={MAX_DELETE_REASON_LENGTH}
        />
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={busy}>
          {busy ? "Removing..." : askForReason ? "Remove comment" : "Delete"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </fetcher.Form>
  );
}
