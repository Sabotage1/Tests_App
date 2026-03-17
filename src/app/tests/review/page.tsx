import Link from "next/link";

import { requireUser } from "@/lib/auth";
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

export default async function ReviewTestsPage() {
  await requireUser();
  const tests = await getTests();
  const pendingTests = tests.filter((test) => test.status === "completed");

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>בדיקת מבחנים</h2>
          <p>רשימת מבחנים שהוגשו ומחכים לבדיקה.</p>
        </div>
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
                  <td>{test.title}</td>
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
                <td colSpan={6}>אין כרגע מבחנים שממתינים לבדיקה.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
