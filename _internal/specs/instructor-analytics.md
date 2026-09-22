# Instructor Analytics Dashboard

> Triage label to apply on publish: `ready-for-agent`
> Source: grill-me decisions, 2026-09-22.

## Problem Statement

Instructors have nowhere to look to understand how their courses are performing. The instructor course editor shows a lesson count and a student count, and the Students tab lists who is enrolled, but there is no way to answer the questions an instructor actually has about a course they have published:

- Is this selling at all, and is that trend going up or down?
- Are the people who buy it actually finishing it?
- Where do they give up, so I know which lesson to fix?

Without those answers, an instructor is authoring content blind. They cannot tell whether a rewritten module improved completion, whether a price change helped or hurt, or which lesson is quietly killing the course. They also cannot tell whether a course is dead because nobody buys it or because everybody buys it and quits at lesson 3, which are two completely different problems requiring opposite responses.

## Solution

A new cross-course Analytics page for instructors, reachable from the sidebar, that shows the instructor's whole catalogue at a glance and lets them drill into any one course's drop-off curve.

The page answers the three questions directly:

- **How is it selling.** Headline figures for orders, gross revenue, and enrolled students across the catalogue, a revenue trend over time with order volume overlaid, and a percentage change for each figure against the previous equivalent period.
- **Are they finishing.** A completion rate per course and a weighted completion rate for the catalogue, where completion means every lesson in the course is marked completed by that student.
- **Where do they drop off.** A per-lesson funnel for a chosen course showing how many students reached and completed each lesson in course order, so the lesson where the bars fall off a cliff is immediately visible.

Plus two supporting signals chosen from the wider idea list: the average rating per course, and how many students have been active recently.

A range selector (last 7 days, last 30 days, last 90 days, or all time) drives the trend, the change indicators, and the active-student count. The drop-off funnel deliberately does not obey it: the funnel is always computed over the entire enrolled cohort, because a windowed funnel over a handful of students per window is noise.

## User Stories

### Access and navigation

1. As an instructor, I want an Analytics entry in the sidebar, so that I can reach my metrics without going through a course first.
2. As an instructor, I want the Analytics entry to appear only when I am signed in as an instructor, so that students and admins do not see a page they cannot use.
3. As an instructor, I want the Analytics page to cover all of my courses at once, so that I do not have to visit each course separately to get a portfolio view.
4. As an instructor, I want to see analytics only for courses I own, so that I cannot see another instructor's commercial data.
5. As an admin, I want to be denied the instructor Analytics page in the same way the existing instructor course list denies me, so that the permission model stays consistent.
6. As a signed-out visitor, I want to be told to select a user in the DevUI panel rather than seeing an empty dashboard, so that I understand why the page will not load.
7. As an instructor with no courses yet, I want a clear empty state that explains there is nothing to show, so that the page does not look broken.
8. As an instructor, I want a link back to My Courses, so that I can navigate away naturally.

### Portfolio overview

1. As an instructor, I want one row per course I own, so that I can compare courses against each other.
2. As an instructor, I want each course row to show its status badge, so that I can tell a draft apart from a published course at a glance.
3. As an instructor, I want draft courses to appear with zeroed figures, so that I can see what is waiting to launch without it being hidden from me.
4. As an instructor, I want archived courses to still appear, so that their historical revenue and enrollments continue to count.
5. As an instructor, I want a catalogue-wide total line above the per-course rows, so that I get the portfolio number without adding up rows myself.
6. As an instructor, I want each course row to link to that course's analytics, so that I can drill in from the row itself.
7. As an instructor, I want each course row to link to the course editor, so that when I spot a problem lesson I can go fix it.

### Sales and revenue

1. As an instructor, I want to see the total number of orders for a course, so that I know how many times it was bought.
2. As an instructor, I want to see gross revenue for a course, so that I know what it has earned before any fees or refunds.
3. As an instructor, I want to see the number of enrolled students for a course, so that I know how many people actually have access.
4. As an instructor, I want orders, revenue, and students shown as three separate labelled numbers rather than one combined figure, so that a multi-seat team order cannot be misread as a single sale.
5. As an instructor, I want to be told that a team order was a lump sum covering several seats, so that I understand why revenue and order count do not scale together.
6. As an instructor, I want a catalogue-wide revenue total, so that I know what the whole catalogue has earned.
7. As an instructor, I want revenue displayed in the platform's standard currency formatting, so that it reads consistently with prices elsewhere in the app.
8. As an instructor, I want revenue for the selected range, so that I can see what a recent promotion or launch actually produced.
9. As an instructor, I want an all-time revenue figure alongside the ranged figure, so that I can always see lifetime earnings regardless of the range selector.

### Trends and change indicators

1. As an instructor, I want a revenue trend chart over time, so that I can see the shape of sales rather than just a total.
2. As an instructor, I want order volume shown alongside revenue on the trend chart, so that I can tell a few large orders apart from many small ones.
3. As an instructor, I want the trend bucketed sensibly for the selected range, so that 7 days does not render as a single bar and all time does not render as hundreds of unreadable ones.
4. As an instructor, I want each headline figure to show a percentage change against the previous equivalent period, so that I can tell whether things are improving without memorising old numbers.
5. As an instructor, I want the previous period to be the immediately preceding window of the same length, so that a 30-day view compares against the 30 days before it.
6. As an instructor, I want a figure with no previous-period data to read as "new" rather than showing infinity or a broken percentage, so that a first sale is not rendered as a bug.
7. As an instructor, I want a decrease to be visually distinguishable from an increase, so that I can read the direction instantly.
8. As an instructor, I want to know which range the change indicators refer to, so that I do not compare a 7-day delta against a 30-day total.

### Time range

1. As an instructor, I want to switch between last 7 days, last 30 days, last 90 days, and all time, so that I can look at recent performance or the whole history.
2. As an instructor, I want the selected range to live in the URL, so that I can bookmark or share a specific view and reload without losing it.
3. As an instructor, I want an invalid or unrecognised range value to fall back to a sensible default, so that a hand-edited URL does not break the page.
4. As an instructor, I want the range to drive the trend chart, the change indicators, and the active-student count, so that one control governs the whole time-sensitive part of the page.
5. As an instructor, I want the drop-off funnel to be explicitly labelled as all-time, so that I do not assume it respects the range selector.
6. As an instructor, I want an all-time view not to apply a lower date bound at all, so that nothing from the course's history is silently excluded.

### Completion

1. As an instructor, I want a completion rate per course, so that I can see which courses students actually finish.
2. As an instructor, I want completion defined as every lesson in the course being marked completed by that student, so that the number is derived from real lesson state rather than a separate flag that can drift.
3. As an instructor, I want the catalogue completion rate weighted by enrollment, so that a course with four students does not swing the headline number as hard as a course with a thousand.
4. As an instructor, I want to see the raw enrolled and completed counts next to each rate, so that I can judge whether a percentage rests on a meaningful sample.
5. As an instructor, I want a course with no lessons to show a placeholder instead of a percentage, so that the page does not render NaN or divide by zero.
6. As an instructor, I want a course with no enrollments to show a placeholder instead of a percentage, so that a zero denominator is handled explicitly.
7. As an instructor, I want completion computed over all time rather than the selected range, so that the rate is not distorted by students who enrolled outside the window.

### Lesson drop-off

1. As an instructor, I want to pick a course from a selector on the Analytics page, so that I can see its funnel without leaving the page.
2. As an instructor, I want the selected course stored in the URL, so that the drill-down is bookmarkable and survives a reload.
3. As an instructor, I want the funnel to list lessons in true course order across modules, so that the curve reflects the path a student actually walks.
4. As an instructor, I want the funnel to show how many students reached each lesson, so that I can see the shape of attrition.
5. As an instructor, I want the funnel to show how many students completed each lesson, so that I can distinguish "did not start" from "started and gave up".
6. As an instructor, I want each funnel row to show a percentage of the enrolled cohort, so that I can compare courses of different sizes.
7. As an instructor, I want the first lesson to always be 100 percent of the enrolled cohort, so that the funnel has a meaningful baseline.
8. As an instructor, I want "reached lesson N" to mean the student completed lesson N-1, so that the funnel models the intended sequential path.
9. As an instructor, I want the largest single drop between consecutive lessons to be visually obvious, so that I can find the lesson to fix without reading every row.
10. As an instructor, I want module grouping reflected in the funnel, so that a cliff caused by an entire module is distinguishable from one bad lesson.
11. As an instructor, I want lessons with zero reach to still be listed, so that I can see how far into the course students actually get.
12. As an instructor, I want the funnel for a course with no enrollments to show an empty state, so that the chart does not render meaningless bars.
13. As an instructor, I want the funnel to handle a course whose modules have been reordered, so that the curve follows the current content order.

### Ratings and engagement

1. As an instructor, I want the average rating per course, so that quality sits next to revenue where I can compare them.
2. As an instructor, I want the rating count next to the average, so that I can tell a 5.0 from two reviews apart from a 4.6 from two hundred.
3. As an instructor, I want a course with no ratings to show a placeholder, so that an unrated course is not displayed as zero stars.
4. As an instructor, I want a count of students active in the selected range, so that I can tell whether anyone is using the course at all.
5. As an instructor, I want activity counted from any signal the platform records, so that a student who watches video without completing a lesson still counts as active.
6. As an instructor, I want active students counted as distinct people, so that one student generating many events is not counted many times.
7. As an instructor, I want active students to obey the range selector, so that it answers "is this course alive right now".

### Data quality and trust

1. As an instructor, I want each figure labelled with the period it covers, so that ranged and all-time numbers are never confused.
2. As an instructor, I want the page to load its data on the server, so that the first paint already contains numbers rather than a flash of empty cards.
3. As an instructor, I want a course I do not own to be unselectable in the course selector, so that a tampered URL does not leak another instructor's data.
4. As an instructor, I want a tampered or stale course identifier to fall back to my first course with a visible notice, so that a bookmarked link to a deleted course still lands somewhere useful.
5. As an instructor, I want the page to remain responsive with a catalogue of many courses and thousands of students, so that opening analytics is not a multi-second wait.
6. As an instructor, I want the page to stay correct when a lesson is added or removed mid-course, so that historical funnels are not permanently skewed.

## Implementation Decisions

### Modules

- **New analytics service module.** Holds every aggregation and every derived-metric calculation. This is the single test seam. See Testing Decisions.
- **New instructor analytics route.** Registered in the explicit route configuration as a static segment declared before the dynamic course segment, following the precedent already set by the instructor course-creation route. A dynamic segment declared first would shadow it.
- **New chart and stat-card components** under the existing components directory, presentation only, containing no metric maths.
- **Modified sidebar** to add an Analytics entry restricted to the instructor role.
- **Modified seed script** to generate enough history to exercise the feature.
- **Added dependency:** a charting library for React.

### Service interface

All new service functions take a single object parameter. This follows the project's agent instructions, which require an object parameter whenever a function accepts more than one parameter of the same type. Note that the existing services in this codebase use positional parameters and document that as project convention; that convention is deliberately not followed for new code, and no existing service is refactored.

The range selector is modelled as a closed set rather than a free-form window:

```ts
type AnalyticsRange = "7d" | "30d" | "90d" | "all";
```

The portfolio response is a single shape so the route renders one structure rather than joining several:

```ts
type PortfolioRow = {
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

type Portfolio = {
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
  }; // null means "no previous period data"
  rows: PortfolioRow[];
};
```

### Metric definitions

- `orders(range)` = count of purchases for the instructor's courses with a creation date inside the range.
- `revenue(range)` = sum of price paid over the same set. Gross, no refund concept exists, and multi-seat team orders contribute their lump sum once.
- `students(range)` = count of enrollments for the instructor's courses with an enrollment date inside the range.
- `completed(course)` = enrollments where the student's count of completed lesson progress rows for that course equals the course's lesson count.
- `completionRate` = completed enrollments divided by total enrollments, summed across the catalogue. Enrollment-weighted, not a mean of per-course rates.
- `reached[N](course)` = the enrolled cohort size when N is the first lesson, otherwise the number of distinct students with a completed progress row on lesson N-1.
- `activeStudents(range)` = distinct students with either a watch event in the range or a completed progress row in the range, scoped to the instructor's courses:

```sql
SELECT userId FROM video_watch_events JOIN lessons -> modules -> courses
  WHERE createdAt IN range AND courses.instructor_id = ?
UNION
SELECT userId FROM lesson_progress JOIN lessons -> modules -> courses
  WHERE status = 'completed' AND completedAt IN range AND courses.instructor_id = ?
```

- `delta` = percentage change against the immediately preceding window of equal length. `null` when the previous window total is zero, rendered as "new" rather than as a division by zero. When the range is all time, no delta is shown.

### Query strategy

- Every metric is computed with a single set-based grouped query. The existing per-student progress calculation must **not** be reused: it runs one query per student and is called in a loop elsewhere in the codebase today. A set-based equivalent is added to the analytics module instead, and the existing function is left untouched.
- Lesson ordering within a course is established with a window function over module position then lesson position, so the funnel needs one query for the whole course rather than one query per lesson:

```sql
ROW_NUMBER() OVER (PARTITION BY module.course_id ORDER BY module.position, lesson.position)
```

- All timestamps are ISO 8601 text, so range comparisons are lexicographic string comparisons against a computed lower bound. No date parsing is required inside SQL. The all-time range applies no lower bound rather than a very old one.

### Authorization and parameter handling

- The loader resolves the current user with the existing session helper and requires the instructor role, matching the existing instructor course-list route. Admins are excluded; platform-wide analytics is a separate, out-of-scope feature.
- Every query is additionally filtered by instructor id, so ownership is enforced in the data layer rather than only in the loader.
- The course selector is validated against the instructor's own courses. An unknown or unowned identifier falls back to the instructor's first course and surfaces an inline notice, rather than throwing a not-found error, which would reveal whether a course exists.
- Both the range and the selected course are read from URL search parameters and validated; unrecognised values fall back to defaults.

### Rendering

- Server rendering is enabled in this project, and the charting library's responsive container measures the DOM, which is not available on the server. Charts must therefore render behind a client-only boundary or receive explicit dimensions. This must be settled before the first chart is written, not discovered through hydration warnings.
- Every chart needs an explicit empty state for a course or range with no data, rather than an axis with no series.
- A missing value (`null` completion rate, `null` rating, `null` delta) renders as a placeholder, never as zero.

### Seed data

The current seed cannot exercise this feature: it contains six purchases, seven enrollments, and eleven watch events, all dated between late July and early September, while the newest 7-day and 30-day windows are empty. The seed script is extended to generate roughly twelve months of history across both seeded courses, targeting on the order of a hundred and eighty orders and a hundred and forty students, with:

- varied purchase countries so location-based pricing appears in revenue,
- several multi-seat team orders generating coupon links,
- staggered lesson progress following a decay curve so the funnel shows a real cliff rather than a flat line,
- watch events, including periodic progress heartbeats, for a subset of students so the active-student metric has data,
- dates relative to the current time so the short ranges are never empty,
- a deterministic pseudo-random generator so the data is reproducible.

The seed script already drops and recreates every table, so it stays idempotent.

### Schema

No schema changes and no migration. In particular:

- `lesson_progress` has no created or updated timestamp, only a nullable completion timestamp. This is why the active-student metric unions watch events with completions, which is the broadest signal available without a migration. Adding an activity timestamp to lesson progress is explicitly deferred.
- No video duration is stored, which is why drop-off is modelled on lesson progress rather than on video playhead position.

## Testing Decisions

### What makes a good test here

Tests assert the external behaviour of the analytics module: given a known set of users, courses, enrollments, purchases, ratings, and progress rows, the returned figures are correct. They must not assert how the query is written, which SQL functions were used, or how many queries were issued. A test that breaks when the query is rewritten to return the same numbers is a bad test.

Concretely, tests should be written against the public service functions and their return shapes, seeded through the existing real in-memory database helper, with the same mock of the database module the rest of the suite uses. Assertions are on numbers and nullability, including the deliberate `null` cases, because those are the values that render as placeholders and are the easiest to get silently wrong.

### The single seam

There is exactly one seam: the analytics service module.

This is the highest seam available and it is an existing seam type rather than a new one. The repository contains fifteen test files, all of them either a service module or a utility module, and zero route tests and zero component tests. The established pattern is a pure module exercised against a real in-memory SQLite database built from the real migrations, with the database module mocked so the module under test receives the test instance.

Prior art to copy:

- the progress service test, for lesson progress aggregation and completion semantics,
- the enrollment service test, for enrollment and count semantics,
- the purchase service test, for purchase and revenue semantics,
- the rating service test, for rating aggregation.

Because all metric maths lives in the service, the route loader is a thin adapter that resolves the session, validates ownership, and parses search parameters, with no logic worth a second seam. Chart components are presentation only and stay untested, consistent with the rest of the codebase. Introducing route or component testing infrastructure is explicitly not part of this work.

### Cases to cover

- Portfolio rows are scoped to the requesting instructor and exclude other instructors' courses.
- Orders, revenue, and students count independently, so a purchase with multiple seats is one order and its full lump sum of revenue while producing one enrollment per redeemed coupon.
- Revenue for a range excludes purchases outside it, at both boundaries.
- All-time applies no lower bound and includes the oldest purchase.
- Completion counts only students with every lesson in the course marked completed, and does not count a student one lesson short.
- Completion is weighted by enrollment across two courses of deliberately different sizes, so the result differs from an unweighted mean.
- A course with zero lessons returns a null completion rate rather than NaN.
- A course with zero enrollments returns a null completion rate rather than NaN.
- The funnel's first lesson equals the full enrolled cohort.
- `reached[N]` equals completed lesson N-1 for later lessons.
- A student who completes a later lesson while skipping an earlier one does not inflate the earlier lesson's reached count.
- The funnel respects course order across module boundaries, including after a reorder.
- Lessons with zero reach are still present in the output.
- Active students unions watch events and completions and counts distinct users, so one student with many events counts once.
- Active students respects the range at both boundaries.
- Deltas compare against the immediately preceding window of equal length.
- A zero previous-period total yields a null delta rather than infinity.
- An all-time range yields no deltas.
- Rating average is null for an unrated course, and the rating count is reported alongside it.

## Out of Scope

- **View-to-purchase conversion rate.** Nothing in the schema records course page views or impressions, so conversion is not computable without new instrumentation.
- **Quiz pass rates.** Declined for this version, though the attempt and answer data exists.
- **Revenue broken down by country or location-based pricing tier.** Declined for this version.
- **Video playhead drop-off.** Would require persisting video duration and generating progress heartbeats in the seed, which the lesson-progress funnel makes unnecessary for now.
- **Adding an activity timestamp to lesson progress.** Deferred; the union approach avoids the migration.
- **Platform-wide or admin analytics.** A separate feature from the idea list. Admins are denied this page, consistent with the existing instructor course list.
- **Watch time per lesson, time to completion, and comment or bookmark volume per lesson.** Proposed as follow-ups, not built here.
- **CSV export, scheduled email reports, alerting on thresholds, and cohort retention analysis.**
- **Caching or precomputing aggregates.** The query strategy is expected to be fast enough at this data scale; revisit only if measured otherwise.
- **Refunds and net revenue.** There is no refund model, so revenue is gross by definition.
- **Route-level and component-level tests.** No such infrastructure exists in the repository and none is added.

## Further Notes

### Why three numbers instead of one

A single "sales" figure would be actively misleading on this schema. A team purchase stores the total price for all seats in one row, so a five-seat order at fifty-nine ninety-nine is recorded as one purchase of two hundred and ninety-nine ninety-five. Meanwhile coupons minted by that purchase create additional enrollments with no purchase row at all, which is why the seeded data has more enrollments than purchases. Orders, revenue, and students are therefore three genuinely different quantities, and the page presents them separately with a note explaining the team case.

### Why the funnel ignores the range selector

Drop-off is a property of the content, not of the calendar. Windowing the funnel would split a small cohort across several bars and produce a curve that changes shape for reasons unrelated to the course. The funnel is labelled as all-time so the distinction from the ranged figures is explicit rather than something the instructor has to infer.

### Data volume

The seeded catalogue is two published courses with nineteen and twenty lessons. After the seed work described above, the funnel will have enough students to show a meaningful curve; without it, the short ranges render empty and the funnel flatlines after the third lesson. The seed enrichment is therefore on the critical path, not a nice-to-have.

### Known limitation worth revisiting

Because lesson progress carries no activity timestamp, a student who reads lesson text without playing video and without completing anything is invisible to the active-student count. The union of watch events and completions is the broadest honest signal available without a schema change; if engagement reporting becomes a priority, adding an activity timestamp is the correct fix.
