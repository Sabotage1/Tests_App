import Link from "next/link";

import { resendArchivedTestAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import type { TestStatus } from "@/lib/constants";
import { getTests } from "@/lib/repository";

type ArchivePageProps = {
  searchParams: Promise<{ error?: string }>;
};

const STATUS_LABELS: Record<TestStatus, string> = {
  generated: "מבחן שנוצר",
  sent: "מבחן שנשלח",
  completed: "מבחן שהוגש",
  graded: "מבחן שנבדק",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("he-IL") : "-";
}

function formatGrade(value: number | null) {
  return value === null ? "-" : Math.round(value);
}

export default async function ArchiveTestsPage({ searchParams }: ArchivePageProps) {
  await requireUser();
  const params = await searchParams;
  const tests = await getTests();
  const archivedTests = tests.filter((test) => test.status !== "generated");

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>ארכיון מבחנים</h2>
          <p>רשימת כל המבחנים שנשלחו בעבר, עם נתוני נבחן, מועדים, ציון ופעולות להמשך טיפול.</p>
        </div>
      </div>
      {params.error ? <div className="alert">{params.error}</div> : null}

      <div className="card">
        {archivedTests.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>מבחן</th>
                <th>נבחן</th>
                <th>מייל</th>
                <th>סטטוס</th>
                <th>נשלח</th>
                <th>הוגש</th>
                <th>ציון</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {archivedTests.map((test) => (
                <tr key={test.id}>
                  <td>
                    <strong>{test.title}</strong>
                    <div className="muted">שאלות: {test.questionCount}</div>
                  </td>
                  <td>{test.studentName || "-"}</td>
                  <td>{test.studentEmail || "-"}</td>
                  <td>{STATUS_LABELS[test.status]}</td>
                  <td>{formatDate(test.sentAt)}</td>
                  <td>{formatDate(test.submittedAt)}</td>
                  <td>{formatGrade(test.grade)}</td>
                  <td>
                    <div className="stack">
                      <div className="button-row">
                        <Link className="button button-secondary" href={`/tests/${test.id}`}>
                          פתיחת מבחן
                        </Link>
                        <Link className="button button-success" href={`/tests/${test.id}/grade`}>
                          בדיקה חוזרת
                        </Link>
                      </div>
                      <form action={resendArchivedTestAction}>
                        <input type="hidden" name="sourceTestId" value={test.id} />
                        <div className="grid grid-3">
                          <label>
                            שם נבחן חדש
                            <input name="studentName" defaultValue="" required />
                          </label>
                          <label>
                            מייל תלמיד חדש
                            <input name="studentEmail" type="email" defaultValue="" />
                          </label>
                          <label>
                            תאריך ושעת שליחה
                            <input name="sentAt" type="datetime-local" />
                          </label>
                        </div>
                        <button className="button button-primary" type="submit">
                          שליחה מחדש
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div>אין מבחנים בארכיון כרגע.</div>
        )}
      </div>
    </div>
  );
}
