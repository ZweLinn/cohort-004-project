import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings, courses, enrollments } from "~/db/schema";

// ─── Rating Service ───
// Handles the 5-star course review system. Only enrolled students may rate a
// course, and each student holds a single rating per course that they can
// change at any time.
// Uses positional parameters (project convention).

export interface RatingStats {
  averageRating: number | null;
  ratingCount: number;
}

/**
 * Records a student's rating for a course (1-5 stars). The first rating is
 * inserted, and every later rating is an update, so a student can change
 * their mind.
 * Enforces eligibility: rating range, existing enrollment, and no self-rating.
 */
export function rateCourse(userId: number, courseId: number, rating: number) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  const course = db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .get();
  if (!course) {
    throw new Error("Course not found");
  }

  if (course.instructorId === userId) {
    throw new Error("You cannot rate your own course");
  }

  const enrollment = db
    .select()
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId))
    )
    .get();
  if (!enrollment) {
    throw new Error("You must be enrolled in this course to rate it");
  }

  const existing = getUserCourseRating(userId, courseId);
  if (existing) {
    return db
      .update(courseRatings)
      .set({ rating })
      .where(eq(courseRatings.id, existing.id))
      .returning()
      .get();
  }

  try {
    return db
      .insert(courseRatings)
      .values({ userId, courseId, rating })
      .returning()
      .get();
  } catch (error) {
    // Unique index (user_id, course_id) guards against concurrent inserts -
    // the other request won the race, so apply this value as an update.
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return db
        .update(courseRatings)
        .set({ rating })
        .where(
          and(
            eq(courseRatings.userId, userId),
            eq(courseRatings.courseId, courseId)
          )
        )
        .returning()
        .get();
    }
    throw error;
  }
}

/**
 * Aggregate rating for a single course: average rounded to 1 decimal
 * place (null when there are no ratings) and total rating count.
 */
export function getRatingStatsForCourse(courseId: number): RatingStats {
  const row = db
    .select({
      averageRating: sql<number>`round(avg(${courseRatings.rating}), 1)`,
      ratingCount: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  const ratingCount = row?.ratingCount ?? 0;
  return {
    averageRating: ratingCount > 0 && row ? row.averageRating : null,
    ratingCount,
  };
}

/**
 * Aggregate ratings for many courses with a single grouped query.
 * Returns one entry per requested id (same order as the input),
 * defaulting to no ratings for courses that have none.
 */
export function getRatingStatsForCourses(
  courseIds: number[]
): (RatingStats & { courseId: number })[] {
  if (courseIds.length === 0) return [];

  const rows = db
    .select({
      courseId: courseRatings.courseId,
      averageRating: sql<number>`round(avg(${courseRatings.rating}), 1)`,
      ratingCount: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(inArray(courseRatings.courseId, courseIds))
    .groupBy(courseRatings.courseId)
    .all();

  const statsById = new Map(rows.map((row) => [row.courseId, row]));

  return courseIds.map((id) => {
    const stats = statsById.get(id);
    return {
      courseId: id,
      averageRating: stats?.averageRating ?? null,
      ratingCount: stats?.ratingCount ?? 0,
    };
  });
}

/** The current user's rating for a course, or undefined when they haven't rated it. */
export function getUserCourseRating(userId: number, courseId: number) {
  return db
    .select()
    .from(courseRatings)
    .where(
      and(
        eq(courseRatings.userId, userId),
        eq(courseRatings.courseId, courseId)
      )
    )
    .get();
}
