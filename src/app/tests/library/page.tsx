import Link from "next/link";

import { deleteTestAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { TestLibraryResendForm } from "@/components/TestLibraryResendForm";
import { getSelectedUnitForUser, getUnitOrderForUser, requireUser } from "@/lib/auth";
import { QUESTION_UNIT_LABELS, type QuestionUnit, type TestStatus } from "@/lib/constants";
import { getTests } from "@/lib/repository";

type TestLibraryPageProps = {
  searchParams: Promise<{
    bulkCreated?: string;
    bulkFailed?: string;
    bulkSent?: string;
    deleted?: string;
    deleteError?: string;
    error?: string;
    unit?: string;
  }>;
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
  const user = await requireUser();
  const params = await searchParams;
  const tests = await getTests();
  const selectedUnit: QuestionUnit = getSelectedUnitForUser(user, params.unit);
  const unitOrder = getUnitOrderForUser(user);
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
        {unitOrder.map((unit) => (
          <Link
            key={unit}
            className={selectedUnit === unit ? "button unit-toggle-active" : "button unit-toggle-idle"}
            href={`/tests/library?unit=${unit}`}
          >
            {QUESTION_UNIT_LABELS[unit]}
          </Link>
        ))}
      </div>
      {params.error ? <div className="alert">{params.error}</div> : null}
      {params.deleted === "1" ? <div className="alert">המבחן נמחק מהמערכת.</div> : null}
      {params.deleteError ? <div className="alert">{params.deleteError}</div> : null}
      {params.bulkCreated ? (
        <div className="alert">
          נוצרו {params.bulkCreated} מבחנים, נשלחו {params.bulkSent ?? "0"} מיילים, ונכשלו {params.bulkFailed ?? "0"} שליחות.
        </div>
      ) : null}

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
                    <TestLibraryResendForm sourceTestId={test.id} unit={selectedUnit} />
                    {user.role === "admin" ? (
                      <form action={deleteTestAction}>
                        <input type="hidden" name="testId" value={test.id} />
                        <input type="hidden" name="unit" value={selectedUnit} />
                        <SubmitButton
                          className="button button-danger"
                          confirmMessage="למחוק את המבחן הזה? הפעולה לא ניתנת לביטול."
                          pendingLabel="מוחק מבחן..."
                        >
                          מחיקת מבחן
                        </SubmitButton>
                      </form>
                    ) : null}
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
