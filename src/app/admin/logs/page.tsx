import type { Route } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { getAuditLogs } from "@/lib/repository";

type AdminLogsPageProps = {
  searchParams: Promise<{
    entity?: string;
  }>;
};

const ENTITY_FILTERS = [
  { value: "all", label: "הכל" },
  { value: "test", label: "מבחנים" },
  { value: "question", label: "שאלות" },
  { value: "lookup", label: "נושאים ושלבים" },
  { value: "user", label: "משתמשים" },
  { value: "settings", label: "הגדרות" },
] as const;

const ACTION_LABELS: Record<string, string> = {
  "lookup.created": "יצירת ערך",
  "lookup.deleted": "מחיקת ערך",
  "lookup.updated": "עדכון ערך",
  "question.archived": "העברה לארכיון",
  "question.created": "יצירת שאלה",
  "question.deleted": "מחיקת שאלה",
  "question.updated": "עדכון שאלה",
  "settings.bonus_points_updated": "עדכון שווי בונוס",
  "settings.default_duration_updated": "עדכון ברירת מחדל למשך מבחן",
  "test.bulk_deleted": "מחיקה גורפת",
  "test.cloned": "שכפול מבחן",
  "test.created": "יצירת מבחן",
  "test.deleted": "מחיקת מבחן",
  "test.duration_updated": "עדכון זמן מבחן",
  "test.grade_email_sent": "שליחת ציון במייל",
  "test.graded": "שמירת בדיקה",
  "test.graded_with_ai": "בדיקת AI",
  "test.invitation_email_sent": "שליחת הזמנה במייל",
  "test.share_link_created": "יצירת קישור שיתוף",
  "test.started": "התחלת מבחן",
  "test.submitted": "הגשת מבחן",
  "user.created": "יצירת משתמש",
  "user.deleted": "מחיקת משתמש",
  "user.password_changed": "שינוי סיסמה",
  "user.updated": "עדכון משתמש",
};

const ENTITY_LABELS: Record<string, string> = {
  lookup: "ערך מערכת",
  question: "שאלה",
  settings: "הגדרה",
  test: "מבחן",
  user: "משתמש",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "אדמין",
  editor: "אחראית הדרכה",
  viewer: "צופה",
};

const DETAIL_LABELS: Record<string, string> = {
  deletedCount: "כמות שנמחקה",
  durationMinutes: "משך מבחן",
  grade: "ציון",
  isBonusSource: "שאלת בונוס",
  lookupType: "סוג ערך",
  passwordReset: "איפוס סיסמה",
  questionCount: "כמות שאלות",
  role: "תפקיד",
  selectionMode: "שיטת בחירה",
  shareToken: "טוקן שיתוף",
  source: "מקור",
  sourceReference: "מספר שאלה",
  sourceTestId: "מזהה מבחן מקור",
  sourceTitle: "כותרת מבחן מקור",
  status: "סטטוס",
  studentEmail: "מייל נבחן",
  studentName: "שם נבחן",
  unit: "יחידה",
  units: "יחידות",
  username: "שם משתמש",
  value: "ערך",
};

function formatDetailValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value === null || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "כן" : "לא";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export default async function AdminLogsPage({ searchParams }: AdminLogsPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const selectedEntity = ENTITY_FILTERS.some((filter) => filter.value === params.entity)
    ? params.entity!
    : "all";
  const logs = await getAuditLogs({
    entityType: selectedEntity === "all" ? undefined : selectedEntity,
    limit: 200,
  });

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>יומן פעילות</h2>
          <p>תצוגת פעולות מערכת אחרונות, כולל מי ביצע כל שינוי ועל איזה אובייקט הוא בוצע.</p>
        </div>
      </div>

      <div className="button-row">
        {ENTITY_FILTERS.map((filter) => (
          <Link
            key={filter.value}
            className={selectedEntity === filter.value ? "button button-primary" : "button button-secondary"}
            href={
              (filter.value === "all" ? "/admin/logs" : `/admin/logs?entity=${filter.value}`) as Route
            }
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>מועד</th>
              <th>מבצע</th>
              <th>פעולה</th>
              <th>פריט</th>
              <th>פרטים</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const details = Object.entries(log.details ?? {}).filter(([, value]) => {
                if (value === undefined || value === null || value === "") {
                  return false;
                }

                return !(Array.isArray(value) && value.length === 0);
              });

              return (
                <tr key={log.id}>
                  <td>{new Date(log.createdAt).toLocaleString("he-IL")}</td>
                  <td>
                    <strong>{log.actorDisplayName}</strong>
                    <div className="muted">{log.actorRole ? ROLE_LABELS[log.actorRole] ?? log.actorRole : "ללא משתמש"}</div>
                  </td>
                  <td>{ACTION_LABELS[log.action] ?? log.action}</td>
                  <td>
                    <strong>{log.entityLabel || ENTITY_LABELS[log.entityType] || log.entityType}</strong>
                    <div className="muted">{ENTITY_LABELS[log.entityType] ?? log.entityType}</div>
                    {log.entityId ? <div className="audit-log-id">{log.entityId}</div> : null}
                  </td>
                  <td>
                    {details.length > 0 ? (
                      <div className="audit-log-details">
                        {details.map(([key, value]) => (
                          <span className="audit-log-detail" key={key}>
                            <strong>{DETAIL_LABELS[key] ?? key}:</strong> {formatDetailValue(value)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">ללא פרטים נוספים</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5}>אין פעולות להצגה במסנן שנבחר.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
