export const ISRAEL_TIME_ZONE = "Asia/Jerusalem";

export function formatIsraelDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("he-IL", {
    timeZone: ISRAEL_TIME_ZONE,
  });
}

export function formatIsraelTime(value: string | Date) {
  return new Date(value).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ISRAEL_TIME_ZONE,
  });
}

export function getIsraelYear(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: ISRAEL_TIME_ZONE,
    year: "numeric",
  }).format(new Date(value));
}
