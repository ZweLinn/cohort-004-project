# Instructor Analytics Dashboard - Multi-Phase Plan

Source spec: `_internal/specs/instructor-analytics.md`
Triage label: `ready-for-agent`
Status: not started

## How to use this plan

This plan is written for an autonomous agent loop (see `.sandcastle/prompt.md`). Read the
spec alongside it: the spec is the "what", this plan is the "how".

Rules for the agent:

1. Work on **one phase per task**. A phase is a single commit.
2. Do not start a phase until its dependencies (listed per phase) are committed.
3. Before committing, run `pnpm run test` and `pnpm run typecheck`. Both must pass.
4. Commit message must include key decisions, files changed, and notes for the next phase.
5. Tick the checkbox for a phase once it is committed and green.
6. Keep the spec's decisions intact. If reality contradicts the spec, note it in the commit
   and update the spec in the same commit rather than silently diverging.

Phase checklist:

- [x] Phase 1 - Tracer bullet: route shell, auth, sidebar, range-in-URL
- [ ] Phase 2 - Seed enrichment for verifiable data
- [ ] Phase 3 - Portfolio sales figures (orders, revenue, students)
- [ ] Phase 4 - Completion metrics
- [ ] Phase 5 - Ratings and active students
- [ ] Phase 6 - Revenue trend and change indicators
- [ ] Phase 7 - Lesson drop-off funnel
- [ ] Phase 8 - Hardening, empty states, and performance

## Locked decisions

These are settled. Do not re-open them mid-loop.

- **Charting:** `recharts` (latest v3, React 19 compatible; verify peer deps during install)
  rendered behind a client-only boundary. `ResponsiveContainer` measures the DOM, which does
  not exist during SSR. Every chart sits inside a `<ClientOnly>` wrapper with a skeleton
  fallback. This is the fix for the hydration warning the spec warns about.
- **Single test seam:** `app/services/analyticsService.ts`. All metric maths lives there.
  Chart components and the route loader hold no metric maths and get no tests.
- **Object parameters:** every new analytics function takes a single object parameter, per
  `AGENTS.md`. Existing services keep positional parameters and are not refactored.
- **No schema changes, no migration.** `lesson_progress` has only `completedAt`, no activity
  timestamp. Active students use the union of watch events and completions.
- **Completion is derived from lesson progress**, not from `enrollments.completedAt`. Never
  read that column for the completion rate.
- **Funnel ignores the range selector.** It is always computed over the whole enrolled cohort
  and must be labelled "all time".
- **Admin is denied**, matching `/instructor`. Platform-wide analytics is out of scope.

## Global conventions

- No em dashes in any file, comment, or commit message. Use a plain hyphen.
- Never add the agent name as a commit co-author.
- Reuse `formatPrice` only for course prices (it renders `0` as "Free"). Revenue needs a new
  `formatRevenue(cents)` that renders `$0.00` and always includes cents. Add it to
  `app/lib/utils.ts` with a unit test in `app/lib/utils.test.ts`.
- A missing value (`null` completion rate, `null` rating, `null` delta) renders as a
  placeholder (for example `-` or "No data"), never as `0`.
- Range values are a closed set: `"7d" | "30d" | "90d" | "all"`. Unrecognised values fall back
  to `"30d"`.
- Timestamps are ISO 8601 text. Range filters are lexicographic string comparisons against a
  computed lower bound. All-time applies no lower bound.

## Phase 1 - Tracer bullet: route shell, auth, sidebar, range-in-URL

**Goal:** the thinnest end-to-end path. An instructor can reach `/instructor/analytics`, see the
page chrome and an empty state, and the permission model matches `/instructor`. No real metrics.

**Depends on:** nothing.

**Files**

- `app/routes.ts` - register `route("instructor/analytics", "routes/instructor.analytics.tsx")`
  **before** `route("instructor/:courseId", ...)`. A dynamic segment declared first would
  shadow the static one. Follow the precedent of `instructor/new`.
- `app/routes/instructor.analytics.tsx` (new) - loader, component, `ErrorBoundary`.
- `app/components/sidebar.tsx` - add an Analytics `NavItem` with `roles: [UserRole.Instructor]`,
  an icon (for example `BarChart3` from `lucide-react`), and `to: "/instructor/analytics"`.
- `app/services/analyticsService.ts` (new) - types and a stub `getPortfolio` returning empty
  `rows` and zeroed `totals`/`deltas`.
- `app/lib/utils.ts` + `app/lib/utils.test.ts` - add `formatRevenue(cents)`.

**Steps**

1. Create the route file. Loader mirrors `app/routes/instructor.tsx`:
   - `getCurrentUserId(request)`; no user -> `throw data("Select a user from the DevUI panel ...", { status: 401 })`.
   - `getUserById`; missing or role is not `Instructor` -> `throw data("Only instructors can access this page.", { status: 403 })`.
2. Parse URL state in the loader:
   - `range` from `?range=`, validated against the closed set, default `"30d"`.
   - Return `{ range, portfolio: getPortfolio({ instructorId, range }) }`.
3. Component renders: breadcrumb (Home / Analytics), heading, a link back to `/instructor`
   ("My Courses"), the range selector, catalogue totals placeholders, and an empty state when
   there are no courses yet (message explains there is nothing to show).
4. Range selector is a `Select` (or segmented buttons) that writes `?range=` via
   `useSearchParams`, preserving any other params. Keep it controlled by the URL, not local state.
5. Add `HydrateFallback` (skeletons) and `ErrorBoundary` modelled on `instructor.tsx` so 401
   and 403 render the same copy as the rest of the instructor area.
6. Add the sidebar entry. Verify it is absent for students and admins.
7. Define the public shapes in `analyticsService.ts` exactly as the spec's `Portfolio` and
   `PortfolioRow` types, and export `type AnalyticsRange`.
8. `getPortfolio` stub: return the real shape with empty `rows`, zeroed numeric totals, `null`
   completion rate and deltas. It must typecheck against the real shape so later phases only
   replace the body.

**Tests**

- `app/lib/utils.test.ts`: `formatRevenue(0)` is `"$0.00"`, `formatRevenue(4999)` is `"$49.99"`,
  and `formatRevenue` never returns "Free".
- No route tests exist in this repo and none are added. The route stays untested by design.

**Done when**

- `pnpm typecheck` and `pnpm test` are green.
- Manually: signed in as an instructor, `/instructor/analytics` loads with the shell and empty
  state; as admin it shows the same "Access denied" copy as `/instructor`; signed out it asks
  for a DevUI user; `?range=bogus` falls back to `30d`.

## Phase 2 - Seed enrichment for verifiable data

**Goal:** enough history that the short ranges and the funnel are non-empty on a fresh seed.
The spec calls this critical path, not a nice-to-have.

**Depends on:** Phase 1 (only so the page exists to eyeball; the seed work itself is independent).

**Files**

- `scripts/seed.ts`

**Steps**

1. Add a deterministic pseudo-random generator (for example a `mulberry32` seeded with a fixed
   constant) and route all generated variation through it. The seed must be reproducible.
2. Expand the student pool to roughly 140 distinct students across both seeded courses. Generate
   names and emails from the PRNG. Keep the existing demo students and their hand-authored
   progress so the current demo flows (quiz attempts, comments) still land.
3. Generate roughly 180 purchases spread over the last 12 months, relative to `Date.now()` via
   the existing `daysAgo` helper so short ranges are never empty.
   - Vary `country` across the `COUNTRIES`/PPP tier set from `app/lib/ppp.ts` and vary
     `pricePaid` using `calculatePppPrice` so location-based pricing appears in revenue.
   - Include several multi-seat team orders: one purchase row carrying the lump sum, a team,
     and coupon links redeemed by distinct students. This makes enrollments exceed purchases,
     which the team-order note on the page depends on.
4. Generate staggered lesson progress following a decay curve (more students complete early
   lessons, fewer finish the course) so the funnel shows a real cliff. Keep the existing
   hand-authored students' patterns intact on top.
5. Generate `video_watch_events`, including periodic progress heartbeats, for a subset of
   students and lessons, dated inside the last 90 days, so the active-student metric has data.
6. Keep the existing drop-and-recreate block and the `migrate()` call, so the seed stays
   idempotent. Update the `console.log` counts.

**Tests**

- The seed script is not unit tested (no existing seed tests). Verify by running it.

**Done when**

- `pnpm db:seed` completes without error and prints the new counts.
- Inspecting the DB: purchases roughly 180, enrollments greater than purchases, all three
  time windows (`7d`, `30d`, `90d`) contain rows, and the funnel for course 1 visibly decays.
- Re-running `pnpm db:seed` produces the same figures (deterministic).

## Phase 3 - Portfolio sales figures (orders, revenue, students)

**Goal:** real orders, revenue, and student counts per course and for the catalogue, with the
range selector driving the ranged revenue figure.

**Depends on:** Phase 1 (shape and route), Phase 2 (data to look at).

**Files**

- `app/services/analyticsService.ts` - implement `getPortfolio` for these three metrics.
- `app/services/analyticsService.test.ts` (new).
- `app/routes/instructor.analytics.tsx` - stat cards and portfolio table.
- `app/components/stat-card.tsx` (new, presentation only).

**Steps**

1. Implement set-based grouped queries scoped by `instructorId`:
   - `orders(range)` = count of purchases for the instructor's courses with `createdAt` inside
     the range.
   - `revenue(range)` = sum of `pricePaid` over the same set. Gross. A team order contributes
     its lump sum once.
   - `students(range)` = count of enrollments for the instructor's courses with `enrolledAt`
     inside the range.
   - All-time revenue (no lower bound) alongside the ranged revenue. Expose it on the row or in
     totals as the spec requires an all-time figure next to the ranged one.
2. Build one row per owned course, including drafts (zeroed figures) and archived courses
   (historical figures count). Sort/keep a stable order.
3. Catalogue totals across all owned courses.
4. Every query carries `courses.instructorId = ?`. Ownership is enforced in the data layer,
   not only by the loader.
5. UI: three stat cards (Orders, Revenue, Students) using `formatRevenue`; a catalogue total
   line above the per-course table; a table row per course with status badge (reuse the
   `statusBadge` pattern from `instructor.tsx`), per-course orders/revenue/students, a link to
   the course editor, and a link to that course's analytics (seed `?course=` now so Phase 7
   wires straight in).
6. Add the team-order explanation note near the Orders/Revenue/Students cards: a team order is
   one order and one lump sum covering several seats, which is why revenue and order count do
   not scale together.
7. Keep a single empty state for "no courses yet" and a per-range note when a range has no data.

**Tests** (in `analyticsService.test.ts`, in-memory DB via `createTestDb`, `vi.mock("~/db")`)

- Portfolio rows are scoped to the requesting instructor and exclude another instructor's courses.
- Orders, revenue, and students count independently: a multi-seat purchase is one order, its full
  lump sum of revenue, and one enrollment per redeemed coupon.
- Ranged revenue excludes purchases outside the range at both boundaries (inclusive lower and
  upper bounds).
- All-time applies no lower bound and includes the oldest purchase.
- Draft courses appear with zeroed figures; archived courses keep their figures.
- Catalogue totals equal the sum of the visible rows for the same range.

**Done when**

- Tests and typecheck green.
- Manually: the page shows real per-course figures that change when the range changes, drafts
  show zeros, archived courses still show history, and the all-time revenue figure is present
  regardless of range.

## Phase 4 - Completion metrics

**Goal:** per-course completion rate, enrollment-weighted catalogue rate, and the raw
enrolled/completed counts, all computed over all time.

**Depends on:** Phase 3.

**Files**

- `app/services/analyticsService.ts` - add completion to `getPortfolio`.
- `app/services/analyticsService.test.ts`.
- `app/routes/instructor.analytics.tsx` - completion column and catalogue completion.

**Steps**

1. Add a **set-based** completion query. Do not reuse `calculateProgress` or
   `getCompletedLessonCount` from `progressService`: those run per student and are called in a
   loop elsewhere. The spec explicitly forbids reusing them here and forbids touching them.
2. Definition: a student has completed a course when their count of completed `lesson_progress`
   rows for that course equals the course's total lesson count. Never use
   `enrollments.completedAt`.
3. Per-course `completionRate` = completed enrollments / total enrollments. It is `null` when
   the course has zero lessons or zero enrollments. Report `enrolledCount` and `completedCount`
   next to the rate.
4. Catalogue `completionRate` is enrollment-weighted: sum of completed across courses divided by
   sum of enrolled across courses. It is not a mean of per-course rates.
5. Completion is all-time. The range selector must not affect it.
6. UI: a Completion column per row showing the percentage with the raw `completed / enrolled`
   counts, and a placeholder when `null`. Add the catalogue weighted completion to the totals area.

**Tests**

- Completion counts only students with every lesson in the course marked completed; a student
  one lesson short is not counted.
- Completion is weighted by enrollment across two courses of deliberately different sizes, so
  the catalogue result differs from the unweighted mean of the two rates.
- A course with zero lessons returns a `null` completion rate rather than `NaN`.
- A course with zero enrollments returns a `null` completion rate rather than `NaN`.
- Completion is unaffected by the selected range (same value for `7d` and `all`).

**Done when**

- Tests and typecheck green.
- Manually: completion percentages and raw counts render, an empty course shows a placeholder,
  and the catalogue completion is not simply the average of the visible rates.

## Phase 5 - Ratings and active students

**Goal:** average rating per course with its count, and a distinct active-student count driven by
the range selector.

**Depends on:** Phase 3, Phase 4.

**Files**

- `app/services/analyticsService.ts`.
- `app/services/analyticsService.test.ts`.
- `app/routes/instructor.analytics.tsx` - rating column and active-students stat.

**Steps**

1. Ratings: reuse `getRatingStatsForCourses` from `app/services/ratingService.ts` (already
   grouped and single-query). Populate `ratingAverage` and `ratingCount` per row. A course with
   no ratings has `ratingAverage: null` and `ratingCount: 0`.
2. Active students: implement the spec's union query scoped to the instructor's courses and to
   the selected range:
   - distinct `userId` from `video_watch_events` joined lessons -> modules -> courses with
     `createdAt` inside the range, unioned with
   - distinct `userId` from `lesson_progress` joined lessons -> modules -> courses with
     `status = 'completed'` and `completedAt` inside the range.
   - Count distinct users across the union. `lesson_progress` has no created timestamp, so
     `completedAt` is the only available signal.
3. Active students obeys the range. For all-time, no lower bound.
4. UI: rating column showing the average and count ("4.7 (12)"), placeholder when unrated. An
   Active Students stat card labelled with the selected range so it is never confused with the
   all-time figures.

**Tests**

- Rating average is `null` for an unrated course and the rating count is reported alongside it.
- Active students unions watch events and completions and counts distinct users: one student with
  many events counts once.
- A student who only watched video (no completion) still counts as active.
- A student who only completed a lesson (no watch event) still counts as active.
- Active students respects the range at both boundaries.
- Active students is scoped to the instructor's own courses.

**Done when**

- Tests and typecheck green.
- Manually: ratings and counts render; the active-student number changes with the range; an
  unrated course shows a placeholder.

## Phase 6 - Revenue trend and change indicators

**Goal:** a revenue trend chart with order volume overlaid, plus a percentage change on each
headline figure against the previous equivalent period.

**Depends on:** Phase 3, Phase 5. This is the first chart, so it also delivers the client-only
component the funnel will reuse.

**Files**

- `package.json` / `pnpm-lock.yaml` - add `recharts`.
- `app/components/client-only.tsx` (new) - mounted-gate wrapper with a fallback.
- `app/components/charts/chart-skeleton.tsx` (new).
- `app/components/charts/revenue-trend-chart.tsx` (new, presentation only).
- `app/services/analyticsService.ts` - add `getRevenueTrend` and `deltas`.
- `app/services/analyticsService.test.ts`.
- `app/routes/instructor.analytics.tsx` - render the chart and the delta indicators.

**Steps**

1. `pnpm add recharts`. Confirm it resolves against React 19 during install; if the peer range
   blocks, pin a React 19 compatible major (recharts v3) rather than downgrading React.
2. Implement `ClientOnly`: `const [mounted, setMounted] = useState(false)` +
   `useEffect(() => setMounted(true), [])`; render the fallback on the server and first client
   render, children after mount. Every chart uses it. This is the settled SSR boundary.
3. `getRevenueTrend({ instructorId, range })` returns ordered points `{ bucketStart, label, revenue, orders }`.
   Bucketing:
   - `7d` and `30d`: daily buckets.
   - `90d`: weekly buckets.
   - `all`: monthly buckets.
     The point is that 7 days never renders as one bar and all time never renders hundreds.
4. `deltas` compare each headline figure against the immediately preceding window of equal
   length: for `30d`, the 30 days before the current 30. Compute for orders, revenue, and
   students.
   - `null` when the previous window total is zero (render as "new", never infinity or a broken
     percentage).
   - For `all`, no deltas at all (`null`).
5. UI: `RevenueTrendChart` inside `ClientOnly`, bars for revenue with a line overlay for order
   volume (two axes or a shared normalized axis, labelled clearly). Explicit empty state when
   there is no data for the range, never an axis with no series.
6. Delta indicators on the three stat cards: percentage, an up/down affordance distinguishable
   without colour alone (for example an arrow icon plus sign), "new" for `null`, and a label
   making clear which range the delta refers to.

**Tests**

- Trend bucketing: `7d` yields daily points, `90d` yields weekly points, `all` yields monthly
  points over the seeded span.
- Trend revenue for a range excludes purchases outside it and the point totals sum to the
  ranged revenue from Phase 3.
- Deltas compare against the immediately preceding window of equal length (construct data where
  a naive "previous calendar period" would give a different answer).
- A zero previous-period total yields a `null` delta rather than infinity or `NaN`.
- An all-time range yields no deltas.
- Delta signs: an increase is positive, a decrease is negative.

**Done when**

- Tests and typecheck green.
- Manually: the trend chart renders with both series, there is no SSR hydration warning in the
  console, empty ranges show the chart empty state, and deltas read "new" on a first sale.

## Phase 7 - Lesson drop-off funnel

**Goal:** a per-lesson funnel for a chosen course, in true course order across modules, always
computed over the whole enrolled cohort and labelled all time.

**Depends on:** Phase 6 (reuses `ClientOnly` and chart conventions), Phase 2 (data to make the
curve meaningful).

**Files**

- `app/services/analyticsService.ts` - add `getCourseFunnel`.
- `app/services/analyticsService.test.ts`.
- `app/components/charts/lesson-funnel-chart.tsx` (new, presentation only).
- `app/routes/instructor.analytics.tsx` - course selector, ownership validation, funnel section.

**Steps**

1. `getCourseFunnel({ instructorId, courseId })` returns lessons in true course order across
   modules, each with `{ lessonId, lessonTitle, moduleTitle, position, reached, completed }`.
   - Ordering uses a window function over module position then lesson position, so the whole
     course is one query rather than one query per lesson:
     `ROW_NUMBER() OVER (PARTITION BY modules.course_id ORDER BY modules.position, lessons.position)`.
   - `reached[N]` is the enrolled cohort size when N is the first lesson, otherwise the number of
     distinct students with a completed progress row on lesson N-1. So "reached" models the
     intended sequential path.
   - `completed[N]` is the number of distinct students with a completed progress row on lesson N.
   - Lessons with zero reach are still returned.
   - Module grouping is included so a module-wide cliff is distinguishable from one bad lesson.
2. Validate the selected course against the instructor's own courses. An unknown or unowned
   `?course=` falls back to the instructor's first course and surfaces an inline notice. Do not
   throw a not-found error, which would reveal whether a course exists.
3. The funnel ignores the range selector. Label it clearly as "all time". All-time applies no
   lower bound.
4. Empty state when the course has no enrollments: no bars, explanatory copy.
5. UI: `LessonFunnelChart` inside `ClientOnly`, listing lessons in order with a bar per lesson,
   the percentage of the enrolled cohort, module grouping visible, and the largest single drop
   between consecutive lessons visually emphasised. A course selector stores `?course=` in the
   URL so the drill-down is bookmarkable and survives reload.

**Tests**

- The funnel's first lesson equals the full enrolled cohort.
- `reached[N]` equals `completed[N-1]` for every later lesson.
- A student who completes a later lesson while skipping an earlier one does not inflate the
  earlier lesson's reached count.
- The funnel respects course order across module boundaries.
- After reordering modules, the funnel follows the current content order.
- Lessons with zero reach are still present in the output.
- A course with no enrollments returns an empty funnel (no rows or an explicit empty marker)
  rather than meaningless bars.
- The funnel result is identical whichever range is selected.

**Done when**

- Tests and typecheck green.
- Manually: the funnel shows a decaying curve with a visible cliff, module boundaries are
  visible, an unowned `?course=` id falls back with a notice, and the section is labelled
  all time.

## Phase 8 - Hardening, empty states, and performance

**Goal:** close the trust and quality gaps from the spec's "Data quality and trust" stories.

**Depends on:** Phases 1 through 7.

**Files**

- `app/routes/instructor.analytics.tsx`
- `app/services/analyticsService.ts`
- `app/services/analyticsService.test.ts`
- Chart components under `app/components/charts/` as needed.

**Steps**

1. Ensure every figure is labelled with the period it covers. The ranged figures, the all-time
   revenue figure, the all-time completion rate, and the all-time funnel must be unambiguous.
2. Confirm server rendering means the first paint already contains the numbers (no client fetch,
   no flash of empty cards). The loader does all data work.
3. Confirm the page stays correct when a lesson is added or removed mid-course: the funnel is
   derived from current lesson rows and current progress, so it must not depend on a stored
   snapshot. Add a test for a lesson added after progress exists.
4. Confirm a tampered or stale `?course=` falls back to the first course with a visible notice,
   and that a course the instructor does not own is never selectable and never leaks data.
5. Performance: with a catalogue of many courses and thousands of students, the number of
   queries must stay bounded (grouped, set-based, one query per metric family, not one per
   course or per student). Time `getPortfolio` and `getCourseFunnel` against seeded data. If a
   metric is slow, add an index in a migration rather than caching.
6. Sweep empty and null states: no courses, range with no orders, unrated course, course with no
   enrollments, course with no lessons, funnel with zero reach. Every one renders a placeholder
   or empty state, never `NaN`, `Infinity`, or `0` standing in for missing data.
7. Add `meta()` (title "Analytics - Cadence", description) and responsive layout checks.
8. Confirm charts carry accessible labels (an `aria-label` or a visually hidden table/summary)
   so the data is not chart-only.

**Tests**

- A lesson added after students completed the course drops those students out of "course
  completed" and changes the funnel end, without corrupting earlier lessons.
- A lesson removed does not leave a dangling funnel row.
- Re-assert the null and empty cases across the portfolio and funnel after refactors.

**Done when**

- `pnpm test` and `pnpm typecheck` green.
- Manual pass over every empty state and null case.
- `getPortfolio` and `getCourseFunnel` are each a small, bounded number of queries on seeded data
  (inspect with query logging or a counter in a temporary test), and no metric loops per student.

## Dependency graph

```
Phase 1 (tracer)
  |
  v
Phase 2 (seed) --------.
  |                     |
  v                     |
Phase 3 (sales)         |
  |                     |
  v                     |
Phase 4 (completion)    |
  |                     |
  v                     |
Phase 5 (ratings/active)|
  |                     |
  v                     |
Phase 6 (trend/deltas) <'
  |
  v
Phase 7 (funnel)
  |
  v
Phase 8 (hardening)
```

## Out of scope (do not build)

Carried from the spec, restated so the loop does not drift:

- View-to-purchase conversion, quiz pass rates, revenue by country, video playhead drop-off.
- Activity timestamp on `lesson_progress` (deferred; the union avoids the migration).
- Platform-wide or admin analytics.
- Watch time per lesson, time to completion, comment/bookmark volume per lesson.
- CSV export, scheduled reports, alerting, cohort retention.
- Caching or precomputed aggregates.
- Refunds and net revenue.
- Route-level and component-level tests.
