export const APP_NAME = "מערכת ניהול מבחנים - מגדל בן גוריון";
export const APP_VERSION = "1.3";

export const SESSION_COOKIE = "atc_session";

export const DEFAULT_DURATION_MINUTES = 90;
export const DEFAULT_BONUS_QUESTION_POINTS = 5;
export const MISSING_ANSWER_TEXT = "צריך להוסיף תשובה לשאלה";

export const INITIAL_STAGES = [
  "מבחן מסכם הסבת קרקע",
  "מבמכ מסכם הסבת TWR",
  "מבחן מסכם הסבת מתאם",
  "מבחן מסכם הסבת מכ\"מ",
  "מבחן חזרה לכשירות קרקע",
  "מבחן חזרה לכשירות TWR",
  "מבחן חזרה לכשירות בעמדות המכ\"מ",
  "מבחן נהלי עבודה למדריכים בסוכה",
  "מבחן נהלי עבודה למדריכים במכ\"מ",
] as const;

export const INITIAL_SUBJECTS = [
  "עזרי ניווט",
  "נהלי עבודה מבצעיים",
  "תיאומים",
  "כתבי הסכמה",
  "מז\"א",
  "תפעול חריג",
  "מערכות טכניות",
  "תהליכי עזיבה והצטרפות",
] as const;

export const TEST_STATUSES = [
  "generated",
  "sent",
  "completed",
  "graded",
] as const;

export const USER_ROLES = [
  "admin",
  "editor",
  "viewer",
] as const;

export const QUESTION_UNITS = [
  "vfr",
  "ifr",
] as const;

export const QUESTION_UNIT_LABELS = {
  vfr: 'יחידת סוכה VFR',
  ifr: 'יחידת מכ"ם IFR',
} as const;

export type TestStatus = (typeof TEST_STATUSES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type QuestionUnit = (typeof QUESTION_UNITS)[number];
