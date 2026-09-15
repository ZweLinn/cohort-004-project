import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

type StarSize = "sm" | "md" | "lg";

// `shrink-0` matters: the partial-fill overlay in `StarRow` is narrower than
// its 5 stars, so without it flexbox squeezes the stars and the amber fill
// drifts out of alignment with the grey stars underneath.
const starSizeClass: Record<StarSize, string> = {
  sm: "size-3 shrink-0",
  md: "size-4 shrink-0",
  lg: "size-5 shrink-0",
};

/** Renders the average as a trimmed 1-decimal string (e.g. "4.5", "5"). */
export function formatAverageRating(average: number): string {
  const rounded = Math.round(average * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}

function StarRow({
  averageRating,
  size,
  className,
}: {
  averageRating: number;
  size: StarSize;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (averageRating / 5) * 100));
  const starClass = starSizeClass[size];

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      aria-hidden="true"
    >
      <span className="flex text-muted-foreground/25">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} fill="currentColor" className={starClass} />
        ))}
      </span>
      <span
        className="absolute inset-y-0 left-0 flex overflow-hidden text-amber-400"
        style={{ width: `${pct}%` }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} fill="currentColor" className={starClass} />
        ))}
      </span>
    </span>
  );
}

/**
 * Read-only aggregate course rating: stars (partial fill supported) plus
 * average and rating count. Renders nothing for unrated courses unless
 * `emptyLabel` is provided.
 */
export function CourseRating({
  averageRating,
  ratingCount,
  size = "md",
  showCount = true,
  emptyLabel,
  className,
}: {
  averageRating: number | null;
  ratingCount: number;
  size?: StarSize;
  showCount?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  if (ratingCount === 0 || averageRating === null) {
    if (!emptyLabel) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
          className
        )}
      >
        <StarRow averageRating={0} size={size} />
        {emptyLabel}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <StarRow averageRating={averageRating} size={size} />
      <span className="text-xs font-medium text-foreground">
        {formatAverageRating(averageRating)}
      </span>
      {showCount && ratingCount > 0 && (
        <span className="text-xs text-muted-foreground">
          ({ratingCount} {ratingCount === 1 ? "rating" : "ratings"})
        </span>
      )}
    </span>
  );
}

/**
 * Interactive 1-5 star input. Hovering highlights stars; clicking a star
 * calls `onRate(value)`. Controlled via `value` (0 = nothing selected yet).
 */
export function CourseRatingInput({
  value,
  onRate,
  disabled,
  size = "lg",
  className,
}: {
  value: number;
  onRate: (value: number) => void;
  disabled?: boolean;
  size?: StarSize;
  className?: string;
}) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;
  const starClass = starSizeClass[size];

  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      role="radiogroup"
      aria-label="Rate this course"
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const starValue = i + 1;
        const isActive = starValue <= active;
        return (
          <button
            key={starValue}
            type="button"
            role="radio"
            aria-checked={value === starValue}
            aria-label={`${starValue} star${starValue === 1 ? "" : "s"}`}
            disabled={disabled}
            onClick={() => onRate(starValue)}
            onMouseEnter={() => setHovered(starValue)}
            onMouseLeave={() => setHovered(0)}
            className={cn(
              "rounded-sm p-0.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
              isActive ? "scale-105 text-amber-400" : "text-muted-foreground/40"
            )}
          >
            <Star
              fill="currentColor"
              className={cn(starClass, !isActive && "fill-transparent")}
            />
          </button>
        );
      })}
    </div>
  );
}
