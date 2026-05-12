import { getCountdownWarningMinute } from "@/lib/countdown-warnings";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const minute = 60 * 1000;

assertEqual(
  getCountdownWarningMinute({
    previousRemainingMs: 16 * minute,
    nextRemainingMs: 15 * minute,
    warnedMinutes: new Set(),
  }),
  15,
  "warns when crossing 15 minutes",
);

assertEqual(
  getCountdownWarningMinute({
    previousRemainingMs: 10 * minute + 1000,
    nextRemainingMs: 10 * minute,
    warnedMinutes: new Set([15]),
  }),
  10,
  "warns when crossing 10 minutes",
);

assertEqual(
  getCountdownWarningMinute({
    previousRemainingMs: 5 * minute + 1000,
    nextRemainingMs: 5 * minute,
    warnedMinutes: new Set([15, 10]),
  }),
  5,
  "warns when crossing 5 minutes",
);

assertEqual(
  getCountdownWarningMinute({
    previousRemainingMs: 61 * 1000,
    nextRemainingMs: 60 * 1000,
    warnedMinutes: new Set([15, 10, 5]),
  }),
  1,
  "warns when crossing 1 minute",
);

assertEqual(
  getCountdownWarningMinute({
    previousRemainingMs: 15 * minute,
    nextRemainingMs: 15 * minute - 1000,
    warnedMinutes: new Set([15]),
  }),
  null,
  "does not repeat a warning that already fired",
);

assertEqual(
  getCountdownWarningMinute({
    previousRemainingMs: 16 * minute,
    nextRemainingMs: 30 * 1000,
    warnedMinutes: new Set(),
  }),
  1,
  "uses the most urgent warning if the timer jumps across several thresholds",
);

assertEqual(
  getCountdownWarningMinute({
    previousRemainingMs: null,
    nextRemainingMs: 9 * minute,
    warnedMinutes: new Set(),
  }),
  10,
  "shows the nearest relevant warning after opening an already-started exam",
);
