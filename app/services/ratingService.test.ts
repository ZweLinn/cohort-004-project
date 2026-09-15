import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  rateCourse,
  getRatingStatsForCourse,
  getRatingStatsForCourses,
  getUserCourseRating,
} from "./ratingService";

function createStudent(name: string, email: string) {
  return testDb
    .insert(schema.users)
    .values({ name, email, role: schema.UserRole.Student })
    .returning()
    .get();
}

function enroll(userId: number, courseId: number) {
  testDb.insert(schema.enrollments).values({ userId, courseId }).run();
}

describe("ratingService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("rateCourse", () => {
    it("creates a rating for an enrolled student", () => {
      enroll(base.user.id, base.course.id);

      const rating = rateCourse(base.user.id, base.course.id, 5);

      expect(rating).toBeDefined();
      expect(rating.userId).toBe(base.user.id);
      expect(rating.courseId).toBe(base.course.id);
      expect(rating.rating).toBe(5);
      expect(typeof rating.createdAt).toBe("string");
    });

    it("accepts any rating between 1 and 5", () => {
      enroll(base.user.id, base.course.id);

      for (const value of [1, 2, 3, 4, 5]) {
        const freshUser = createStudent(
          `student-${value}@example.com`,
          `s${value}@example.com`
        );
        enroll(freshUser.id, base.course.id);
        const rating = rateCourse(freshUser.id, base.course.id, value);
        expect(rating.rating).toBe(value);
      }
    });

    it("rejects ratings outside the 1-5 range", () => {
      enroll(base.user.id, base.course.id);

      expect(() => rateCourse(base.user.id, base.course.id, 0)).toThrow(
        "Rating must be between 1 and 5"
      );
      expect(() => rateCourse(base.user.id, base.course.id, 6)).toThrow(
        "Rating must be between 1 and 5"
      );
    });

    it("rejects users who are not enrolled in the course", () => {
      expect(() => rateCourse(base.user.id, base.course.id, 4)).toThrow(
        "You must be enrolled in this course to rate it"
      );
    });

    it("rejects an instructor rating their own course", () => {
      expect(() => rateCourse(base.instructor.id, base.course.id, 5)).toThrow(
        "You cannot rate your own course"
      );
    });

    it("throws when the course does not exist", () => {
      expect(() => rateCourse(base.user.id, 9999, 5)).toThrow(
        "Course not found"
      );
    });

    it("updates the existing rating when a student rates again", () => {
      enroll(base.user.id, base.course.id);
      const first = rateCourse(base.user.id, base.course.id, 5);
      const second = rateCourse(base.user.id, base.course.id, 2);

      expect(second.id).toBe(first.id);
      expect(second.userId).toBe(base.user.id);
      expect(second.courseId).toBe(base.course.id);
      expect(second.rating).toBe(2);
      expect(getUserCourseRating(base.user.id, base.course.id)?.rating).toBe(2);
    });

    it("keeps a single row and count when a student re-rates", () => {
      enroll(base.user.id, base.course.id);
      rateCourse(base.user.id, base.course.id, 5);
      rateCourse(base.user.id, base.course.id, 1);

      const rows = testDb.select().from(schema.courseRatings).all();
      expect(rows).toHaveLength(1);
      expect(getRatingStatsForCourse(base.course.id)).toEqual({
        averageRating: 1,
        ratingCount: 1,
      });
    });

    it("does not let one student's re-rating affect another's", () => {
      const emma = createStudent("Emma", "emma@example.com");
      enroll(base.user.id, base.course.id);
      enroll(emma.id, base.course.id);
      rateCourse(base.user.id, base.course.id, 5);
      rateCourse(emma.id, base.course.id, 4);

      rateCourse(base.user.id, base.course.id, 1);

      expect(getUserCourseRating(emma.id, base.course.id)?.rating).toBe(4);
      expect(getRatingStatsForCourse(base.course.id)).toEqual({
        averageRating: 2.5,
        ratingCount: 2,
      });
    });
  });

  describe("getRatingStatsForCourse", () => {
    it("returns zero counts when a course has no ratings", () => {
      const stats = getRatingStatsForCourse(base.course.id);

      expect(stats).toEqual({ averageRating: null, ratingCount: 0 });
    });

    it("returns the count and rounded average for a rated course", () => {
      const emma = createStudent("Emma", "emma@example.com");
      const james = createStudent("James", "james@example.com");
      enroll(emma.id, base.course.id);
      enroll(james.id, base.course.id);
      rateCourse(emma.id, base.course.id, 5);
      rateCourse(james.id, base.course.id, 4);

      const stats = getRatingStatsForCourse(base.course.id);

      expect(stats.ratingCount).toBe(2);
      expect(stats.averageRating).toBe(4.5);
    });

    it("averages across courses independently", () => {
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      const emma = createStudent("Emma", "emma@example.com");
      enroll(emma.id, base.course.id);
      enroll(emma.id, otherCourse.id);
      rateCourse(emma.id, base.course.id, 3);
      rateCourse(emma.id, otherCourse.id, 5);

      expect(getRatingStatsForCourse(base.course.id).averageRating).toBe(3);
      expect(getRatingStatsForCourse(otherCourse.id).averageRating).toBe(5);
    });
  });

  describe("getRatingStatsForCourses", () => {
    it("returns an empty array for no ids", () => {
      expect(getRatingStatsForCourses([])).toEqual([]);
    });

    it("returns entries aligned to the requested course ids", () => {
      const emma = createStudent("Emma", "emma@example.com");
      enroll(emma.id, base.course.id);
      rateCourse(emma.id, base.course.id, 5);

      const stats = getRatingStatsForCourses([base.course.id, 9999]);

      expect(stats).toHaveLength(2);
      expect(stats[0]).toEqual({
        courseId: base.course.id,
        averageRating: 5,
        ratingCount: 1,
      });
      expect(stats[1]).toEqual({
        courseId: 9999,
        averageRating: null,
        ratingCount: 0,
      });
    });
  });

  describe("getUserCourseRating", () => {
    it("returns undefined when the user has not rated the course", () => {
      enroll(base.user.id, base.course.id);

      expect(getUserCourseRating(base.user.id, base.course.id)).toBeUndefined();
    });

    it("returns the user's rating for a course", () => {
      enroll(base.user.id, base.course.id);
      rateCourse(base.user.id, base.course.id, 4);

      const rating = getUserCourseRating(base.user.id, base.course.id);

      expect(rating).toBeDefined();
      expect(rating!.rating).toBe(4);
      expect(rating!.courseId).toBe(base.course.id);
    });
  });
});
