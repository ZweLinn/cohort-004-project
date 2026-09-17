import { and, eq } from "drizzle-orm";
import { db } from "~/db";
import { lessonBookmarks, lessons, modules } from "~/db/schema";

// ─── Bookmark Service ───
// Private, per-student lesson bookmarks. A student either holds a bookmark for
// a lesson or does not, so the toggle is a plain insert/delete. Bookmarks are
// independent of progress: they persist until manually removed and survive
// lesson completion.
// Uses object parameters (project convention).

/** Whether the given student has bookmarked the given lesson. */
export function isLessonBookmarked(opts: {
  userId: number;
  lessonId: number;
}): boolean {
  const row = db
    .select({ id: lessonBookmarks.id })
    .from(lessonBookmarks)
    .where(
      and(
        eq(lessonBookmarks.userId, opts.userId),
        eq(lessonBookmarks.lessonId, opts.lessonId)
      )
    )
    .get();

  return row !== undefined;
}

/**
 * Flips the bookmark for a (student, lesson) pair: removes it when present,
 * inserts it when missing. Returns the state after toggling.
 */
export function toggleBookmark(opts: { userId: number; lessonId: number }): {
  bookmarked: boolean;
} {
  const existing = db
    .select()
    .from(lessonBookmarks)
    .where(
      and(
        eq(lessonBookmarks.userId, opts.userId),
        eq(lessonBookmarks.lessonId, opts.lessonId)
      )
    )
    .get();

  if (existing) {
    db.delete(lessonBookmarks).where(eq(lessonBookmarks.id, existing.id)).run();
    return { bookmarked: false };
  }

  try {
    db.insert(lessonBookmarks)
      .values({ userId: opts.userId, lessonId: opts.lessonId })
      .run();
    return { bookmarked: true };
  } catch (error) {
    // Unique index (user_id, lesson_id) guards against concurrent inserts -
    // the other request already created the bookmark, so we end up bookmarked.
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return { bookmarked: true };
    }
    throw error;
  }
}

/**
 * Every bookmarked lesson id in a course, for the given student. Joins
 * bookmarks through lessons and modules so the result is scoped to the course.
 * Used to batch-load bookmark state for curriculum lists.
 */
export function getBookmarkedLessonIds(opts: {
  userId: number;
  courseId: number;
}): number[] {
  const rows = db
    .select({ lessonId: lessonBookmarks.lessonId })
    .from(lessonBookmarks)
    .innerJoin(lessons, eq(lessonBookmarks.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(
      and(
        eq(lessonBookmarks.userId, opts.userId),
        eq(modules.courseId, opts.courseId)
      )
    )
    .all();

  return rows.map((row) => row.lessonId);
}
