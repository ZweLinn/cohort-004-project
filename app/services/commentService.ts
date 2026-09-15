import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "~/db";
import {
  comments,
  courses,
  enrollments,
  lessons,
  modules,
  users,
  UserRole,
} from "~/db/schema";
import {
  MAX_COMMENT_LENGTH,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  type CommentAccess,
  type CommentNode,
  type CommentReply,
} from "~/lib/comments";

// ─── Comment Service ───
// Lesson discussion threads with two-level threading: top-level comments and a
// flat list of replies. A reply may only point at a top-level comment.
//
// Deletion is a tombstone (soft delete): the row survives so replies keep their
// parent, the body is withheld from every reader, and the moderator who removed
// it (plus an optional reason) is recorded. The author row id is kept so we can
// tell "deleted by author" apart from "removed by instructor" - but a
// tombstoned comment never exposes its author to readers.
//
// Uses positional parameters (project convention).

/** Status-carrying error so routes can map service failures onto HTTP responses. */
export class CommentError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CommentError";
    this.status = status;
  }
}

const NO_ACCESS: CommentAccess = {
  canRead: false,
  canPost: false,
  canModerate: false,
  isCourseInstructor: false,
};

/** The course that owns a lesson, via lesson -> module -> course. */
export function getCourseIdForLesson(lessonId: number): number | null {
  const row = db
    .select({ courseId: modules.courseId })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(lessons.id, lessonId))
    .get();

  return row?.courseId ?? null;
}

function getCourseOwnerId(courseId: number): number | null {
  const row = db
    .select({ instructorId: courses.instructorId })
    .from(courses)
    .where(eq(courses.id, courseId))
    .get();

  return row?.instructorId ?? null;
}

/**
 * The single source of truth for who may read, post, and moderate a lesson's
 * thread. The loader and every mutation go through this, so the two can never
 * drift apart.
 *
 * Read/post: an enrolled student, the course's owner instructor, or an admin.
 * Moderate: the course's owner instructor, or an admin.
 */
export function getCommentAccess(
  userId: number | null,
  lessonId: number
): CommentAccess {
  if (!userId) return NO_ACCESS;

  const courseId = getCourseIdForLesson(lessonId);
  if (!courseId) return NO_ACCESS;

  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return NO_ACCESS;

  const ownerId = getCourseOwnerId(courseId);
  const isCourseInstructor = ownerId === userId;
  const isAdmin = user.role === UserRole.Admin;

  const enrolled = db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId))
    )
    .get();

  const canParticipate = Boolean(enrolled) || isCourseInstructor || isAdmin;

  return {
    canRead: canParticipate,
    canPost: canParticipate,
    canModerate: isCourseInstructor || isAdmin,
    isCourseInstructor,
  };
}

export function getCommentById(commentId: number) {
  return db.select().from(comments).where(eq(comments.id, commentId)).get();
}

function validateBody(body: string): string {
  const trimmed = body.trim();

  if (trimmed.length === 0) {
    throw new CommentError("Comment cannot be empty");
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new CommentError(
      `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`
    );
  }

  return trimmed;
}

function assertWithinRateLimit(userId: number, now: number) {
  const since = new Date(now - RATE_LIMIT_WINDOW_MS).toISOString();

  const recent = db
    .select({ id: comments.id })
    .from(comments)
    .where(and(eq(comments.userId, userId), gt(comments.createdAt, since)))
    .all();

  if (recent.length >= RATE_LIMIT_MAX) {
    throw new CommentError(
      "You are commenting too quickly. Please wait a moment and try again.",
      429
    );
  }
}

export interface CreateCommentInput {
  userId: number;
  lessonId: number;
  body: string;
  parentId?: number | null;
}

/**
 * Posts a comment or a reply. `now` is injectable so the rate-limit window is
 * testable without sleeping or faking timers.
 */
export function createComment(
  { userId, lessonId, body, parentId = null }: CreateCommentInput,
  now: number = Date.now()
) {
  const trimmed = validateBody(body);

  const lesson = db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .get();
  if (!lesson) {
    throw new CommentError("Lesson not found", 404);
  }

  const access = getCommentAccess(userId, lessonId);
  if (!access.canPost) {
    throw new CommentError(
      "You must be enrolled in this course to comment on this lesson",
      403
    );
  }

  if (parentId !== null) {
    const parent = getCommentById(parentId);

    if (!parent || parent.lessonId !== lessonId) {
      throw new CommentError("Parent comment not found", 404);
    }
    if (parent.parentId !== null) {
      throw new CommentError("Replies cannot be nested any deeper");
    }
    if (parent.deletedAt) {
      throw new CommentError("You cannot reply to a deleted comment");
    }
  }

  assertWithinRateLimit(userId, now);

  return db
    .insert(comments)
    .values({
      lessonId,
      userId,
      parentId,
      body: trimmed,
      createdAt: new Date(now).toISOString(),
    })
    .returning()
    .get();
}

/** Edits a comment's body. Author only, and never a tombstoned comment. */
export function updateComment(userId: number, commentId: number, body: string) {
  const trimmed = validateBody(body);

  const comment = getCommentById(commentId);
  if (!comment) {
    throw new CommentError("Comment not found", 404);
  }
  if (comment.deletedAt) {
    throw new CommentError("Deleted comments cannot be edited");
  }
  if (comment.userId !== userId) {
    throw new CommentError("You can only edit your own comments", 403);
  }

  return db
    .update(comments)
    .set({ body: trimmed, updatedAt: new Date().toISOString() })
    .where(eq(comments.id, commentId))
    .returning()
    .get();
}

/**
 * Tombstones a comment. The author may delete their own; the course's owner
 * instructor and admins may remove anyone's. `reason` is only persisted for a
 * moderator removing someone else's comment. Idempotent.
 */
export function deleteComment(
  userId: number,
  commentId: number,
  reason?: string | null
) {
  const comment = getCommentById(commentId);
  if (!comment) {
    throw new CommentError("Comment not found", 404);
  }
  if (comment.deletedAt) {
    return comment;
  }

  const isAuthor = comment.userId === userId;
  const access = getCommentAccess(userId, comment.lessonId);

  if (!isAuthor && !access.canModerate) {
    throw new CommentError("You cannot delete this comment", 403);
  }

  const trimmedReason = reason?.trim();
  const isModeratorRemoval = !isAuthor;

  return db
    .update(comments)
    .set({
      deletedAt: new Date().toISOString(),
      deletedByUserId: userId,
      deletedReason: isModeratorRemoval && trimmedReason ? trimmedReason : null,
    })
    .where(eq(comments.id, commentId))
    .returning()
    .get();
}

// ─── Thread reads ───

const authorUsers = alias(users, "comment_author");
const deleterUsers = alias(users, "comment_deleter");

const threadColumns = {
  id: comments.id,
  parentId: comments.parentId,
  body: comments.body,
  createdAt: comments.createdAt,
  updatedAt: comments.updatedAt,
  deletedAt: comments.deletedAt,
  deletedReason: comments.deletedReason,
  authorId: comments.userId,
  authorName: authorUsers.name,
  authorAvatarUrl: authorUsers.avatarUrl,
  deletedById: comments.deletedByUserId,
  deletedByName: deleterUsers.name,
  deletedByAvatarUrl: deleterUsers.avatarUrl,
};

function selectComments() {
  return db
    .select(threadColumns)
    .from(comments)
    .leftJoin(authorUsers, eq(comments.userId, authorUsers.id))
    .leftJoin(deleterUsers, eq(comments.deletedByUserId, deleterUsers.id));
}

type CommentRow = ReturnType<ReturnType<typeof selectComments>["all"]>[number];

function toReply(
  row: CommentRow,
  courseInstructorId: number | null
): CommentReply {
  const deleted = row.deletedAt !== null;
  const removedByModerator =
    deleted && row.deletedById !== null && row.deletedById !== row.authorId;

  return {
    id: row.id,
    // The body is withheld from the payload entirely for tombstones - the
    // client never receives deleted text.
    body: deleted ? null : row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deleted,
    removedByModerator,
    // A moderator's reason is public; an author's own reason is never stored.
    deletedReason: removedByModerator ? row.deletedReason : null,
    author:
      deleted || row.authorId === null
        ? null
        : {
            id: row.authorId,
            name: row.authorName ?? "Unknown",
            avatarUrl: row.authorAvatarUrl,
            isCourseInstructor: row.authorId === courseInstructorId,
          },
    deletedBy: removedByModerator
      ? {
          id: row.deletedById as number,
          name: row.deletedByName ?? "Unknown",
          avatarUrl: row.deletedByAvatarUrl,
        }
      : null,
  };
}

/**
 * The full thread for a lesson: top-level comments oldest-first, each with its
 * replies oldest-first. Two flat queries assembled in memory - no recursive
 * walk, because threading is capped at two levels.
 */
export function getThreadForLesson(lessonId: number): CommentNode[] {
  const courseId = getCourseIdForLesson(lessonId);
  const courseInstructorId = courseId ? getCourseOwnerId(courseId) : null;

  const topLevel = selectComments()
    .where(and(eq(comments.lessonId, lessonId), isNull(comments.parentId)))
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .all();

  if (topLevel.length === 0) return [];

  const parentIds = topLevel.map((row) => row.id);
  const replies = selectComments()
    .where(
      and(
        eq(comments.lessonId, lessonId),
        inArray(comments.parentId, parentIds)
      )
    )
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .all();

  const repliesByParent = new Map<number, CommentReply[]>();
  for (const row of replies) {
    if (row.parentId === null) continue;
    const list = repliesByParent.get(row.parentId) ?? [];
    list.push(toReply(row, courseInstructorId));
    repliesByParent.set(row.parentId, list);
  }

  return topLevel.map((row) => ({
    ...toReply(row, courseInstructorId),
    replies: repliesByParent.get(row.id) ?? [],
  }));
}
