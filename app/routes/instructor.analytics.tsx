import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/instructor.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  getPortfolio,
  parseAnalyticsRange,
  type AnalyticsRange,
} from "~/services/analyticsService";
import { formatRevenue } from "~/lib/utils";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { AlertTriangle, ArrowLeft, GraduationCap } from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";

const RANGE_OPTIONS: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export function meta() {
  return [
    { title: "Analytics - Cadence" },
    { name: "description", content: "Track your course sales and student progress" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (!user || user.role !== UserRole.Instructor) {
    throw data("Only instructors can access this page.", {
      status: 403,
    });
  }

  const url = new URL(request.url);
  const range = parseAnalyticsRange(url.searchParams.get("range"));
  const portfolio = getPortfolio({ instructorId: currentUserId, range });

  return { range, portfolio };
}

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <div className="mb-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-2 h-5 w-96" />
      </div>
      <div className="mb-8">
        <Skeleton className="h-10 w-44" />
      </div>
      <div className="grid gap-6 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-3 h-8 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function InstructorAnalytics({
  loaderData,
}: Route.ComponentProps) {
  const { range, portfolio } = loaderData;
  const [, setSearchParams] = useSearchParams();

  function handleRangeChange(value: string) {
    setSearchParams((prev) => {
      prev.set("range", value);
      return prev;
    });
  }

  const hasCourses = portfolio.rows.length > 0;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="mt-1 text-muted-foreground">
            Understand how your courses are selling and where students drop off.
          </p>
        </div>
        <Link
          to="/instructor"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 size-4" />
          My Courses
        </Link>
      </div>

      {/* Range selector, controlled by the URL */}
      <div className="mb-8 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Showing</span>
        <Select value={range} onValueChange={handleRangeChange}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Select a range" />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Catalogue totals placeholders */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardContent>
            <div className="text-sm text-muted-foreground">Orders</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">
              {portfolio.totals.orders}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-muted-foreground">Revenue</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">
              {formatRevenue(portfolio.totals.revenue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-muted-foreground">Students</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">
              {portfolio.totals.students}
            </div>
          </CardContent>
        </Card>
      </div>

      {!hasCourses && (
        <div className="mt-8 flex flex-col items-center justify-center py-16 text-center">
          <GraduationCap className="mb-4 size-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">No courses yet</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            There is nothing to show yet. Analytics appear here once you have
            created a course.
          </p>
          <Link to="/instructor" className="mt-4">
            <Button variant="outline">
              <ArrowLeft className="mr-2 size-4" />
              Back to My Courses
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading your analytics.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message = typeof error.data === "string" ? error.data : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message = typeof error.data === "string" ? error.data : "You don't have permission to access this page.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/instructor">
            <Button variant="outline">My Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
