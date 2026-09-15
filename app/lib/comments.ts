// ─── Comment shared config and view types ───
// Lives outside app/services/commentService.ts so client components can import
// the limits and shapes without pulling the SQLite-bound service (and ~/db)
// into the browser bundle.

export const MAX_COMMENT_LENGTH = 2000;
export const MAX_DELETE_REASON_LENGTH = 200;
export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Who may read, post, and moderate a lesson's discussion thread. */
export interface CommentAccess {
  canRead: boolean;
  canPost: boolean;
  canModerate: boolean;
  isCourseInstructor: boolean;
}

export interface CommentAuthor {
  id: number;
  name: string;
  avatarUrl: string | null;
  /** True when this author is the instructor who owns the course. */
  isCourseInstructor: boolean;
}

export interface CommentReply {
  id: number;
  /** Null for a tombstone - deleted text is never sent to the client. */
  body: string | null;
  createdAt: string;
  /** Null until the author edits; drives the "edited" marker. */
  updatedAt: string | null;
  deleted: boolean;
  /** True when a moderator removed someone else's comment. */
  removedByModerator: boolean;
  deletedReason: string | null;
  /** Null for tombstones - a deleted comment never leaks its author. */
  author: CommentAuthor | null;
  /** The moderator who removed the comment, when it was not the author. */
  deletedBy: { id: number; name: string; avatarUrl: string | null } | null;
}

export interface CommentNode extends CommentReply {
  replies: CommentReply[];
}
