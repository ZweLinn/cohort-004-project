import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;
let lesson: { id: number };
let otherLesson: { id: number };

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { MAX_COMMENT_LENGTH, RATE_LIMIT_WINDOW_MS } from "~/lib/comments";
import {
  CommentError,
  createComment,
  deleteComment,
  getCommentAccess,
  getCommentById,
  getThreadForLesson,
  updateComment,
} from "./commentService";

const CLOCK_START = Date.parse("2026-01-01T00:00:00.000Z");

let clock = CLOCK_START;

/** Advances well past the rate-limit window so helper calls never trip it. */
function nextTime() {
  clock += RATE_LIMIT_WINDOW_MS * 2;
  return clock;
}

function createUser(
  name: string,
  email: string,
  role: schema.UserRole
): { id: number } {
  return testDb
    .insert(schema.users)
    .values({ name, email, role })
    .returning()
    .get();
}

function createStudent(name: string, email: string) {
  return createUser(name, email, schema.UserRole.Student);
}

function enroll(userId: number, courseId: number) {
  testDb.insert(schema.enrollments).values({ userId, courseId }).run();
}

function createLesson(title: string): { id: number } {
  const mod = testDb
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: `Module ${title}`, position: 1 })
    .returning()
    .get();

  return testDb
    .insert(schema.lessons)
    .values({ moduleId: mod.id, title, position: 1 })
    .returning()
    .get();
}

function post(
  userId: number,
  body: string,
  options: { parentId?: number; lessonId?: number; at?: number } = {}
) {
  return createComment(
    {
      userId,
      lessonId: options.lessonId ?? lesson.id,
      body,
      parentId: options.parentId ?? null,
    },
    options.at ?? nextTime()
  );
}

describe("commentService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
    clock = CLOCK_START;
    lesson = createLesson("Lesson 1");
    otherLesson = createLesson("Lesson 2");
  });

  describe("getCommentAccess", () => {
    it("denies everything to a logged-out viewer", () => {
      expect(getCommentAccess(null, lesson.id)).toEqual({
        canRead: false,
        canPost: false,
        canModerate: false,
        isCourseInstructor: false,
      });
    });

    it("denies a student who is not enrolled", () => {
      const student = createStudent("Outsider", "outsider@example.com");

      expect(getCommentAccess(student.id, lesson.id).canRead).toBe(false);
      expect(getCommentAccess(student.id, lesson.id).canPost).toBe(false);
    });

    it("lets an enrolled student read and post, but not moderate", () => {
      enroll(base.user.id, base.course.id);

      const access = getCommentAccess(base.user.id, lesson.id);

      expect(access.canRead).toBe(true);
      expect(access.canPost).toBe(true);
      expect(access.canModerate).toBe(false);
      expect(access.isCourseInstructor).toBe(false);
    });

    it("lets the owner instructor read, post, and moderate without enrolling", () => {
      const access = getCommentAccess(base.instructor.id, lesson.id);

      expect(access.canRead).toBe(true);
      expect(access.canPost).toBe(true);
      expect(access.canModerate).toBe(true);
      expect(access.isCourseInstructor).toBe(true);
    });

    it("gives admins full rights on any course", () => {
      const admin = createUser(
        "Admin",
        "admin@example.com",
        schema.UserRole.Admin
      );

      const access = getCommentAccess(admin.id, lesson.id);

      expect(access.canRead).toBe(true);
      expect(access.canPost).toBe(true);
      expect(access.canModerate).toBe(true);
      expect(access.isCourseInstructor).toBe(false);
    });

    it("denies an instructor who does not own the course", () => {
      const otherInstructor = createUser(
        "Other Instructor",
        "other-instructor@example.com",
        schema.UserRole.Instructor
      );

      expect(getCommentAccess(otherInstructor.id, lesson.id)).toEqual({
        canRead: false,
        canPost: false,
        canModerate: false,
        isCourseInstructor: false,
      });
    });

    it("denies everything for a lesson that does not exist", () => {
      enroll(base.user.id, base.course.id);

      expect(getCommentAccess(base.user.id, 999_999).canRead).toBe(false);
    });
  });

  describe("createComment", () => {
    it("creates a comment for an enrolled student", () => {
      enroll(base.user.id, base.course.id);

      const comment = post(base.user.id, "How does the reducer work?");

      expect(comment.id).toBeDefined();
      expect(comment.lessonId).toBe(lesson.id);
      expect(comment.userId).toBe(base.user.id);
      expect(comment.parentId).toBeNull();
      expect(comment.body).toBe("How does the reducer work?");
      expect(typeof comment.createdAt).toBe("string");
      expect(comment.updatedAt).toBeNull();
      expect(comment.deletedAt).toBeNull();
    });

    it("lets the owner instructor comment without an enrollment", () => {
      const comment = post(base.instructor.id, "Great question!");

      expect(comment.userId).toBe(base.instructor.id);
    });

    it("lets an admin comment", () => {
      const admin = createUser(
        "Admin",
        "admin@example.com",
        schema.UserRole.Admin
      );

      const comment = post(admin.id, "Moderating");

      expect(comment.userId).toBe(admin.id);
    });

    it("rejects a student who is not enrolled", () => {
      const outsider = createStudent("Outsider", "outsider@example.com");

      expect(() => post(outsider.id, "Let me in")).toThrow(CommentError);
      expect(() => post(outsider.id, "Let me in")).toThrow(/must be enrolled/i);
    });

    it("rejects an instructor who does not own the course", () => {
      const otherInstructor = createUser(
        "Other Instructor",
        "other-instructor@example.com",
        schema.UserRole.Instructor
      );

      try {
        post(otherInstructor.id, "Butting in");
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(CommentError);
        expect((error as CommentError).status).toBe(403);
      }
    });

    it("rejects a missing lesson", () => {
      enroll(base.user.id, base.course.id);

      expect(() => post(base.user.id, "Hello", { lessonId: 999_999 })).toThrow(
        /Lesson not found/i
      );
    });

    it("trims the body and rejects whitespace-only comments", () => {
      enroll(base.user.id, base.course.id);

      expect(post(base.user.id, "  spaced out  ").body).toBe("spaced out");
      expect(() => post(base.user.id, "   ")).toThrow(/cannot be empty/i);
      expect(() => post(base.user.id, "")).toThrow(/cannot be empty/i);
    });

    it("rejects a body over the length limit", () => {
      enroll(base.user.id, base.course.id);

      const tooLong = "x".repeat(MAX_COMMENT_LENGTH + 1);

      expect(() => post(base.user.id, tooLong)).toThrow(/2000 characters/i);
      expect(
        post(base.user.id, "x".repeat(MAX_COMMENT_LENGTH)).body
      ).toHaveLength(MAX_COMMENT_LENGTH);
    });

    describe("replies", () => {
      it("creates a reply to a top-level comment", () => {
        enroll(base.user.id, base.course.id);
        const parent = post(base.user.id, "Parent");

        const reply = post(base.instructor.id, "Reply", {
          parentId: parent.id,
        });

        expect(reply.parentId).toBe(parent.id);
      });

      it("rejects a reply to a reply", () => {
        enroll(base.user.id, base.course.id);
        const parent = post(base.user.id, "Parent");
        const reply = post(base.user.id, "Reply", { parentId: parent.id });

        expect(() =>
          post(base.user.id, "Nested", { parentId: reply.id })
        ).toThrow(/cannot be nested/i);
      });

      it("rejects a reply to a tombstoned comment", () => {
        enroll(base.user.id, base.course.id);
        const parent = post(base.user.id, "Parent");
        deleteComment(base.user.id, parent.id);

        expect(() =>
          post(base.user.id, "Reply", { parentId: parent.id })
        ).toThrow(/deleted comment/i);
      });

      it("rejects a parent from another lesson", () => {
        enroll(base.user.id, base.course.id);
        const foreignParent = post(base.user.id, "Elsewhere", {
          lessonId: otherLesson.id,
        });

        expect(() =>
          post(base.user.id, "Reply", { parentId: foreignParent.id })
        ).toThrow(/Parent comment not found/i);
      });

      it("rejects a parent that does not exist", () => {
        enroll(base.user.id, base.course.id);

        expect(() =>
          post(base.user.id, "Reply", { parentId: 999_999 })
        ).toThrow(/Parent comment not found/i);
      });
    });

    describe("rate limiting", () => {
      it("allows five comments in a window and rejects the sixth", () => {
        enroll(base.user.id, base.course.id);
        const now = nextTime();

        for (let i = 0; i < 5; i++) {
          post(base.user.id, `Comment ${i}`, { at: now });
        }

        try {
          post(base.user.id, "One too many", { at: now });
          expect.unreachable("should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(CommentError);
          expect((error as CommentError).status).toBe(429);
        }
      });

      it("allows posting again once the window has passed", () => {
        enroll(base.user.id, base.course.id);
        const now = nextTime();

        for (let i = 0; i < 5; i++) {
          post(base.user.id, `Comment ${i}`, { at: now });
        }

        expect(() =>
          post(base.user.id, "Later", { at: now + RATE_LIMIT_WINDOW_MS + 1 })
        ).not.toThrow();
      });

      it("tracks the limit per user, not per lesson", () => {
        enroll(base.user.id, base.course.id);
        const now = nextTime();

        for (let i = 0; i < 5; i++) {
          post(base.user.id, `Comment ${i}`, { at: now });
        }

        expect(() =>
          post(base.user.id, "Different lesson", {
            at: now,
            lessonId: otherLesson.id,
          })
        ).toThrow(/too quickly/i);
      });
    });
  });

  describe("updateComment", () => {
    it("lets the author edit, and records updatedAt", () => {
      enroll(base.user.id, base.course.id);
      const comment = post(base.user.id, "Original");

      const updated = updateComment(base.user.id, comment.id, "  Edited  ");

      expect(updated.body).toBe("Edited");
      expect(updated.updatedAt).not.toBeNull();
      expect(updated.updatedAt).not.toBe(updated.createdAt);
    });

    it("rejects an edit from someone other than the author", () => {
      enroll(base.user.id, base.course.id);
      const comment = post(base.user.id, "Original");

      expect(() =>
        updateComment(base.instructor.id, comment.id, "Hijacked")
      ).toThrow(/only edit your own/i);
    });

    it("rejects editing a tombstoned comment", () => {
      enroll(base.user.id, base.course.id);
      const comment = post(base.user.id, "Original");
      deleteComment(base.user.id, comment.id);

      expect(() =>
        updateComment(base.user.id, comment.id, "Back from the dead")
      ).toThrow(/Deleted comments cannot be edited/i);
    });

    it("rejects an empty body and a missing comment", () => {
      enroll(base.user.id, base.course.id);
      const comment = post(base.user.id, "Original");

      expect(() => updateComment(base.user.id, comment.id, "  ")).toThrow(
        /cannot be empty/i
      );
      expect(() => updateComment(base.user.id, 999_999, "Hello")).toThrow(
        /Comment not found/i
      );
    });
  });

  describe("deleteComment", () => {
    it("lets the author tombstone their own comment", () => {
      enroll(base.user.id, base.course.id);
      const comment = post(base.user.id, "Regrettable");

      const deleted = deleteComment(base.user.id, comment.id);

      expect(deleted.deletedAt).not.toBeNull();
      expect(deleted.deletedByUserId).toBe(base.user.id);
      expect(deleted.body).toBe("Regrettable");
    });

    it("does not store a reason when the author deletes their own comment", () => {
      enroll(base.user.id, base.course.id);
      const comment = post(base.user.id, "Regrettable");

      const deleted = deleteComment(
        base.user.id,
        comment.id,
        "changed my mind"
      );

      expect(deleted.deletedReason).toBeNull();
    });

    it("lets the owner instructor remove a student's comment with a reason", () => {
      enroll(base.user.id, base.course.id);
      const comment = post(base.user.id, "Spam");

      const deleted = deleteComment(
        base.instructor.id,
        comment.id,
        "Off topic"
      );

      expect(deleted.deletedByUserId).toBe(base.instructor.id);
      expect(deleted.deletedReason).toBe("Off topic");
    });

    it("lets an admin remove a comment on a course they do not own", () => {
      enroll(base.user.id, base.course.id);
      const comment = post(base.user.id, "Spam");
      const admin = createUser(
        "Admin",
        "admin@example.com",
        schema.UserRole.Admin
      );

      const deleted = deleteComment(admin.id, comment.id, "Abuse");

      expect(deleted.deletedByUserId).toBe(admin.id);
      expect(deleted.deletedReason).toBe("Abuse");
    });

    it("rejects an enrolled student deleting someone else's comment", () => {
      enroll(base.user.id, base.course.id);
      const author = post(base.user.id, "Mine");
      const other = createStudent("Other", "other@example.com");
      enroll(other.id, base.course.id);

      expect(() => deleteComment(other.id, author.id)).toThrow(
        /cannot delete this comment/i
      );
      expect(() => deleteComment(other.id, author.id)).toThrow(CommentError);
    });

    it("rejects an instructor who does not own the course", () => {
      enroll(base.user.id, base.course.id);
      const comment = post(base.user.id, "Mine");
      const otherInstructor = createUser(
        "Other Instructor",
        "other-instructor@example.com",
        schema.UserRole.Instructor
      );

      expect(() => deleteComment(otherInstructor.id, comment.id)).toThrow(
        /cannot delete this comment/i
      );
    });

    it("is idempotent", () => {
      enroll(base.user.id, base.course.id);
      const comment = post(base.user.id, "Regrettable");

      const first = deleteComment(base.user.id, comment.id);
      const second = deleteComment(base.instructor.id, comment.id, "Late");

      expect(second.deletedAt).toBe(first.deletedAt);
      expect(second.deletedByUserId).toBe(base.user.id);
      expect(second.deletedReason).toBeNull();
    });

    it("rejects a missing comment", () => {
      expect(() => deleteComment(base.user.id, 999_999)).toThrow(
        /Comment not found/i
      );
    });
  });

  describe("getThreadForLesson", () => {
    it("returns an empty array when there are no comments", () => {
      expect(getThreadForLesson(lesson.id)).toEqual([]);
    });

    it("nests replies under their parent, both oldest-first", () => {
      enroll(base.user.id, base.course.id);
      const second = post(base.user.id, "Second", {
        at: CLOCK_START + 2000,
      });
      const first = post(base.user.id, "First", { at: CLOCK_START + 1000 });

      const secondReply = post(base.user.id, "Second reply", {
        parentId: second.id,
        at: CLOCK_START + 2000,
      });
      const firstReply = post(base.user.id, "First reply", {
        parentId: first.id,
        at: CLOCK_START + 1000,
      });

      const thread = getThreadForLesson(lesson.id);

      expect(thread.map((node) => node.body)).toEqual(["First", "Second"]);
      expect(thread[0].replies.map((reply) => reply.id)).toEqual([
        firstReply.id,
      ]);
      expect(thread[1].replies.map((reply) => reply.id)).toEqual([
        secondReply.id,
      ]);
    });

    it("withholds a tombstoned body and flags an author deletion", () => {
      enroll(base.user.id, base.course.id);
      const comment = post(base.user.id, "Secret");
      deleteComment(base.user.id, comment.id);

      const [node] = getThreadForLesson(lesson.id);

      expect(node.deleted).toBe(true);
      expect(node.body).toBeNull();
      expect(node.removedByModerator).toBe(false);
      expect(node.deletedReason).toBeNull();
      expect(node.author).toBeNull();
      expect(node.deletedBy).toBeNull();
    });

    it("attributes a moderator removal and exposes the reason", () => {
      enroll(base.user.id, base.course.id);
      const comment = post(base.user.id, "Spam");
      deleteComment(base.instructor.id, comment.id, "Off topic");

      const [node] = getThreadForLesson(lesson.id);

      expect(node.deleted).toBe(true);
      expect(node.body).toBeNull();
      expect(node.removedByModerator).toBe(true);
      expect(node.deletedReason).toBe("Off topic");
      expect(node.deletedBy?.id).toBe(base.instructor.id);
      expect(node.author).toBeNull();
    });

    it("keeps replies alive after their parent is tombstoned", () => {
      enroll(base.user.id, base.course.id);
      const parent = post(base.user.id, "Parent");
      const reply = post(base.instructor.id, "Reply", { parentId: parent.id });

      deleteComment(base.user.id, parent.id);

      const thread = getThreadForLesson(lesson.id);

      expect(thread).toHaveLength(1);
      expect(thread[0].deleted).toBe(true);
      expect(thread[0].replies).toHaveLength(1);
      expect(thread[0].replies[0].id).toBe(reply.id);
      expect(thread[0].replies[0].body).toBe("Reply");
    });

    it("marks the course owner's comments as instructor comments", () => {
      enroll(base.user.id, base.course.id);
      post(base.user.id, "Student question");
      post(base.instructor.id, "Instructor answer");

      const thread = getThreadForLesson(lesson.id);

      const studentComment = thread.find((n) => n.body === "Student question");
      const instructorComment = thread.find(
        (n) => n.body === "Instructor answer"
      );

      expect(studentComment?.author?.isCourseInstructor).toBe(false);
      expect(studentComment?.author?.name).toBe(base.user.name);
      expect(instructorComment?.author?.isCourseInstructor).toBe(true);
    });

    it("does not leak comments from another lesson", () => {
      enroll(base.user.id, base.course.id);
      post(base.user.id, "Lesson 1 comment");
      post(base.user.id, "Lesson 2 comment", { lessonId: otherLesson.id });

      const thread = getThreadForLesson(lesson.id);

      expect(thread).toHaveLength(1);
      expect(thread[0].body).toBe("Lesson 1 comment");
    });
  });

  describe("getCommentById", () => {
    it("returns the raw row, including a tombstoned body", () => {
      enroll(base.user.id, base.course.id);
      const comment = post(base.user.id, "Secret");
      deleteComment(base.user.id, comment.id);

      const row = getCommentById(comment.id);

      expect(row?.body).toBe("Secret");
      expect(row?.deletedAt).not.toBeNull();
    });
  });
});
