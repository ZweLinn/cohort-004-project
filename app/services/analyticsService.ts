import type { CourseStatus } from "~/db/schema";

// ─── Instructor Analytics Service ───
// Single test seam for all analytics aggregations and derived metrics.
// All functions take a single object parameter (per AGENTS.md), which is
// deliberately a departure from the positional convention used by the older
// services in this codebase.

export const ANALYTICS_RANGES = ["7d", "30d", "90d", "all"] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export function parseAnalyticsRange(
  value: string | null | undefined
): AnalyticsRange {
  if (value && (ANALYTICS_RANGES as readonly string[]).includes(value)) {
    return value as AnalyticsRange;
  }
  return "30d";
}

export type PortfolioRow = {
  courseId: number;
  title: string;
  status: CourseStatus;
  orders: number;
  revenue: number; // cents, gross
  students: number;
  completionRate: number | null; // null when enrollments or lessons are 0
  enrolledCount: number;
  completedCount: number;
  ratingAverage: number | null;
  ratingCount: number;
};

export type Portfolio = {
  range: AnalyticsRange;
  totals: {
    orders: number;
    revenue: number;
    students: number;
    completionRate: number | null;
    activeStudents: number;
  };
  deltas: {
    orders: number | null;
    revenue: number | null;
    students: number | null;
  };
  rows: PortfolioRow[];
};

/**
 * Portfolio aggregate for the requesting instructor's courses.
 * Phase 1 stub: returns the real shape with empty rows and zeroed totals so
 * the route and its types compile against the final contract. Later phases
 * replace only the body.
 */
export function getPortfolio(opts: {
  instructorId: number;
  range: AnalyticsRange;
}): Portfolio {
  return {
    range: opts.range,
    totals: {
      orders: 0,
      revenue: 0,
      students: 0,
      completionRate: null,
      activeStudents: 0,
    },
    deltas: {
      orders: null,
      revenue: null,
      students: null,
    },
    rows: [],
  };
}
