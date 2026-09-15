import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "./utils";

const NOW = Date.parse("2026-06-01T12:00:00.000Z");

function ago(milliseconds: number): string {
  return new Date(NOW - milliseconds).toISOString();
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
  it("returns an empty string for an invalid date", () => {
    expect(formatRelativeTime("not-a-date", NOW)).toBe("");
  });

  it("uses the largest sensible unit", () => {
    expect(formatRelativeTime(ago(0), NOW)).toBe("now");
    expect(formatRelativeTime(ago(30 * SECOND), NOW)).toBe("30 seconds ago");
    expect(formatRelativeTime(ago(3 * MINUTE), NOW)).toBe("3 minutes ago");
    expect(formatRelativeTime(ago(5 * HOUR), NOW)).toBe("5 hours ago");
    expect(formatRelativeTime(ago(2 * DAY), NOW)).toBe("2 days ago");
    expect(formatRelativeTime(ago(45 * DAY), NOW)).toBe("2 months ago");
    expect(formatRelativeTime(ago(400 * DAY), NOW)).toBe("last year");
  });

  it("rolls over to the next unit exactly at the boundary", () => {
    expect(formatRelativeTime(ago(59 * SECOND), NOW)).toBe("59 seconds ago");
    expect(formatRelativeTime(ago(60 * SECOND), NOW)).toBe("1 minute ago");
    expect(formatRelativeTime(ago(60 * MINUTE), NOW)).toBe("1 hour ago");
    expect(formatRelativeTime(ago(24 * HOUR), NOW)).toBe("yesterday");
    expect(formatRelativeTime(ago(30 * DAY), NOW)).toBe("last month");
  });

  it("describes future timestamps", () => {
    expect(
      formatRelativeTime(new Date(NOW + 5 * MINUTE).toISOString(), NOW)
    ).toBe("in 5 minutes");
  });
});
