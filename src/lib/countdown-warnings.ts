export const COUNTDOWN_WARNING_MINUTES = [15, 10, 5, 1] as const;

const URGENT_WARNING_MINUTES = [...COUNTDOWN_WARNING_MINUTES].sort((left, right) => left - right);

export function getCountdownWarningMinute(input: {
  previousRemainingMs: number | null;
  nextRemainingMs: number;
  warnedMinutes: ReadonlySet<number>;
}) {
  if (input.nextRemainingMs <= 0) {
    return null;
  }

  for (const minutes of URGENT_WARNING_MINUTES) {
    const thresholdMs = minutes * 60 * 1000;
    const crossedThreshold =
      input.previousRemainingMs === null
        ? input.nextRemainingMs <= thresholdMs
        : input.previousRemainingMs > thresholdMs && input.nextRemainingMs <= thresholdMs;

    if (crossedThreshold && !input.warnedMinutes.has(minutes)) {
      return minutes;
    }
  }

  return null;
}

export function getCountdownWarningMessage(minutes: number) {
  if (minutes === 1) {
    return "נותרה דקה אחת לסיום הבחינה.";
  }

  return `נותרו ${minutes} דקות לסיום הבחינה.`;
}
