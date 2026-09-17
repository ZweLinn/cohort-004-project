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
  getBookmarkedLessonIds,
  isLessonBookmarked,
  toggleBookmark,
} from "./bookmarkService";

function createStudent(name: string, email: string) {
  return testDb
    .insert(schema.users)
    .values({ name, email, role: schema.UserRole.Student })
    .returning()
    .get();
}

function createModuleWithLesson(
  courseId: number,
  moduleTitle: string,
  lessonTitle: string,
  position = 1
) {
  const mod = testDb
    .insert(schema.modules)
    .values({ courseId, title: moduleTitle, position })
    .returning()
    .get();

  const lesson = testDb
    .insert(schema.lessons)
    .values({ moduleId: mod.id, title: lessonTitle, position })
    .returning()
    .get();

  return { module: mod, lesson };
}

describe("bookmarkService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("toggleBookmark", () => {
    it("creates a bookmark when none exists", () => {
      const { lesson } = createModuleWithLesson(
        base.course.id,
        "Module 1",
        "Lesson 1"
      );

      const result = toggleBookmark({
        userId: base.user.id,
        lessonId: lesson.id,
      });

      expect(result).toEqual({ bookmarked: true });
      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson.id })
      ).toBe(true);
    });

    it("removes the bookmark on the second toggle", () => {
      const { lesson } = createModuleWithLesson(
        base.course.id,
        "Module 1",
        "Lesson 1"
      );

      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });
      const result = toggleBookmark({
        userId: base.user.id,
        lessonId: lesson.id,
      });

      expect(result).toEqual({ bookmarked: false });
      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson.id })
      ).toBe(false);
    });

    it("keeps bookmarks private to each student", () => {
      const { lesson } = createModuleWithLesson(
        base.course.id,
        "Module 1",
        "Lesson 1"
      );
      const other = createStudent("Other User", "other@example.com");

      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });

      expect(
        isLessonBookmarked({ userId: other.id, lessonId: lesson.id })
      ).toBe(false);
    });
  });

  describe("isLessonBookmarked", () => {
    it("is false for a lesson with no bookmark", () => {
      const { lesson } = createModuleWithLesson(
        base.course.id,
        "Module 1",
        "Lesson 1"
      );

      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson.id })
      ).toBe(false);
    });
  });

  describe("getBookmarkedLessonIds", () => {
    it("returns only the user's bookmarks scoped to the given course", () => {
      const first = createModuleWithLesson(
        base.course.id,
        "Module 1",
        "Lesson 1",
        1
      );
      const second = createModuleWithLesson(
        base.course.id,
        "Module 2",
        "Lesson 2",
        2
      );

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
      const other = createModuleWithLesson(
        otherCourse.id,
        "Other Module",
        "Other Lesson"
      );

      toggleBookmark({ userId: base.user.id, lessonId: first.lesson.id });
      toggleBookmark({ userId: base.user.id, lessonId: second.lesson.id });
      toggleBookmark({ userId: base.user.id, lessonId: other.lesson.id });

      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(ids.sort((a, b) => a - b)).toEqual(
        [first.lesson.id, second.lesson.id].sort((a, b) => a - b)
      );
    });

    it("excludes other students' bookmarks", () => {
      const { lesson } = createModuleWithLesson(
        base.course.id,
        "Module 1",
        "Lesson 1"
      );
      const other = createStudent("Other User", "other@example.com");

      toggleBookmark({ userId: other.id, lessonId: lesson.id });

      expect(
        getBookmarkedLessonIds({
          userId: base.user.id,
          courseId: base.course.id,
        })
      ).toEqual([]);
    });

    it("returns an empty array when nothing is bookmarked", () => {
      createModuleWithLesson(base.course.id, "Module 1", "Lesson 1");

      expect(
        getBookmarkedLessonIds({
          userId: base.user.id,
          courseId: base.course.id,
        })
      ).toEqual([]);
    });
  });
});
