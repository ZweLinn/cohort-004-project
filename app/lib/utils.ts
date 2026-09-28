import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a price in cents to a display string.
 * 0 or null/undefined → "Free", otherwise "$X.XX".
 */
export function formatPrice(cents: number | null | undefined): string {
  if (!cents) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format a gross revenue amount in cents for analytics display.
 * Unlike formatPrice, 0 renders as "$0.00" and cents are always included.
 */
export function formatRevenue(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Human-readable relative time ("3 minutes ago", "yesterday").
 * `now` is injectable for deterministic tests.
 */
export function formatRelativeTime(
  iso: string,
  now: number = Date.now()
): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const diffSeconds = (then - now) / 1000;
  const sign = diffSeconds < 0 ? -1 : 1;
  let magnitude = Math.abs(diffSeconds);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const thresholds: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
  ];

  for (const [unit, limit] of thresholds) {
    if (magnitude < limit) {
      return formatter.format(sign * Math.round(magnitude), unit);
    }
    magnitude = magnitude / limit;
  }

  return formatter.format(sign * Math.round(magnitude), "year");
}

export function formatDuration(
  minutes: number,
  showHours: boolean,
  showSeconds: boolean,
  padZeros: boolean
): string {
  if (minutes <= 0) return padZeros ? "00m" : "0m";

  if (showHours && minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const hStr = padZeros ? String(h).padStart(2, "0") : String(h);
    const mStr = padZeros ? String(m).padStart(2, "0") : String(m);
    if (showSeconds) {
      return `${hStr}h ${mStr}m 00s`;
    }
    return m > 0 ? `${hStr}h ${mStr}m` : `${hStr}h`;
  }

  const mStr = padZeros ? String(minutes).padStart(2, "0") : String(minutes);
  if (showSeconds) {
    return `${mStr}m 00s`;
  }
  return `${mStr}m`;
}
