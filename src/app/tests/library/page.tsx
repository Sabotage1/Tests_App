import Link from "next/link";

import { resendArchivedTestAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth";
import { QUESTION_UNIT_LABELS, type QuestionUnit, type TestStatus } from "@/lib/constants";
import { getTests } from "@/lib/repository";

type TestLibraryPageProps = {
  searchParams: Promise<{ error?: string; unit?: string }>;
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

export default async function TestLibraryPage({ searchParams }: TestLibraryPageProps) {
  await requireUser();
  const params = await searchParams;
  const tests = await getTests();
  const selectedUnit: QuestionUnit = params.unit === "ifr" ? "ifr" : "vfr";
  const reusableTests = tests.filter((test) => test.selectionMode !== "archived_copy" && test.unit === selectedUnit);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>מאגר מבחנים</h2>
          <p>כל מבחן שנוצר נשמר כאן לשימוש עתידי, כולל אפשרות לשכפול ושליחה לנבחנים חדשים.</p>
        </div>
      </div>
      <div className="button-row">
        <Link className={selectedUnit === "vfr" ? "button" : "button button-secondary"} href="/tests/library?unit=vfr">
          {QUESTION_UNIT_LABELS.vfr}
        </Link>
        <Link className={selectedUnit === "ifr" ? "button" : "button button-secondary"} href="/tests/library?unit=ifr">
          {QUESTION_UNIT_LABELS.ifr}
        </Link>
      </div>
      {params.error ? <div className="alert">{params.error}</div> : null}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>מבחן</th>
              <th>יוצר</th>
              <th>נוצר</th>
              <th>נבחן אחרון</th>
              <th>סטטוס</th>
              <th>ציון</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {reusableTests.map((test) => (
              <tr key={test.id}>
                <td>
                  <strong>{test.title}</strong>
                  <div className="muted">{QUESTION_UNIT_LABELS[test.unit]}</div>
                  <div className="muted">שאלות: {test.questionCount}</div>
                </td>
                <td>{test.creatorName}</td>
                <td>{formatDate(test.createdAt)}</td>
                <td>{test.studentName || test.studentEmail || "-"}</td>
                <td>{STATUS_LABELS[test.status]}</td>
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
                      <SubmitButton pendingLabel="יוצר עותק חדש...">
                        שליחה מחדש
                      </SubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {reusableTests.length === 0 ? (
              <tr>
                <td colSpan={7}>עדיין לא נוצרו מבחנים במערכת.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
