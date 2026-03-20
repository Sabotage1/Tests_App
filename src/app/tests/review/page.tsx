import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { QUESTION_UNIT_LABELS, type QuestionUnit } from "@/lib/constants";
import { getTests } from "@/lib/repository";

function getSolvedMinutes(startedAt: string | null, submittedAt: string | null) {
  if (!startedAt || !submittedAt) {
    return null;
  }

  const difference = new Date(submittedAt).getTime() - new Date(startedAt).getTime();
  if (difference <= 0) {
    return 0;
  }

  return Math.ceil(difference / 60000);
}

type ReviewTestsPageProps = {
  searchParams: Promise<{ unit?: string }>;
};

export default async function ReviewTestsPage({ searchParams }: ReviewTestsPageProps) {
  await requireUser();
  const params = await searchParams;
  const tests = await getTests();
  const selectedUnit: QuestionUnit = params.unit === "ifr" ? "ifr" : "vfr";
  const pendingTests = tests.filter((test) => test.status === "completed" && test.unit === selectedUnit);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>בדיקת מבחנים</h2>
          <p>רשימת מבחנים שהוגשו ומחכים לבדיקה.</p>
        </div>
      </div>
      <div className="button-row">
        <Link className={selectedUnit === "vfr" ? "button" : "button button-secondary"} href="/tests/review?unit=vfr">
          {QUESTION_UNIT_LABELS.vfr}
        </Link>
        <Link className={selectedUnit === "ifr" ? "button" : "button button-secondary"} href="/tests/review?unit=ifr">
          {QUESTION_UNIT_LABELS.ifr}
        </Link>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>כותרת</th>
              <th>נבחן</th>
              <th>מועד הגשה</th>
              <th>זמן פתרון</th>
              <th>שאלות</th>
              <th>פעולה</th>
            </tr>
          </thead>
          <tbody>
            {pendingTests.map((test) => {
              const solvedMinutes = getSolvedMinutes(test.startedAt, test.submittedAt);

              return (
                <tr key={test.id}>
                  <td>
                    <strong>{test.title}</strong>
                    <div className="muted">{QUESTION_UNIT_LABELS[test.unit]}</div>
                  </td>
                  <td>{test.studentName || test.studentEmail || "-"}</td>
                  <td>{test.submittedAt ? new Date(test.submittedAt).toLocaleString("he-IL") : "-"}</td>
                  <td>{solvedMinutes !== null ? `${solvedMinutes} דקות` : "-"}</td>
                  <td>{test.questionCount}</td>
                  <td>
                    <Link className="button button-primary" href={`/tests/${test.id}/grade`}>
                      לפתיחת בדיקה
                    </Link>
                  </td>
                </tr>
              );
            })}
            {pendingTests.length === 0 ? (
              <tr>
                <td colSpan={6}>אין כרגע מבחנים שממתינים לבדיקה ביחידה שבחרת.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
