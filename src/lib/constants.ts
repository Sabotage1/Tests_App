export const APP_NAME = "מערכת ניהול מבחנים - מגדל בן גוריון";
export const APP_VERSION = "1.2.1";

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

export const DASHBOARD_CHART_METRICS = [
  "generated",
  "sent",
  "completed",
  "graded",
  "failed",
] as const;

export const DEFAULT_DASHBOARD_CHART_METRICS = [
  "generated",
  "sent",
  "completed",
  "graded",
  "failed",
] as const;

export const DASHBOARD_CHART_METRIC_LABELS = {
  generated: "מבחנים שנוצרו",
  sent: "מבחנים שנשלחו",
  completed: "מבחנים שהוגשו",
  graded: "מבחנים שנבדקו",
  failed: "מבחנים שנכשלו",
} as const;

export const DASHBOARD_CHART_METRIC_DESCRIPTIONS = {
  generated: "כל המבחנים שנוצרו במערכת ועדיין לא הוגשו.",
  sent: "מבחנים שנשלחו לתלמידים.",
  completed: "מבחנים שהוגשו ומחכים לבדיקה.",
  graded: "מבחנים שנבדקו וקיבלו ציון.",
  failed: "מבחנים שנבדקו עם ציון נמוך מ-60.",
} as const;

export const DASHBOARD_CHART_METRIC_COLORS = {
  generated: "#1677c7",
  sent: "#35a3d8",
  completed: "#29a96b",
  graded: "#3456d1",
  failed: "#e26d6d",
} as const;

export type TestStatus = (typeof TEST_STATUSES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type QuestionUnit = (typeof QUESTION_UNITS)[number];
export type DashboardChartMetric = (typeof DASHBOARD_CHART_METRICS)[number];
