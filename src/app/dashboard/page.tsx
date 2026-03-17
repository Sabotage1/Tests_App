import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { getDashboardStats, getTests } from "@/lib/repository";

export default async function DashboardPage() {
  await requireUser();
  const [stats, tests] = await Promise.all([getDashboardStats(), getTests()]);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>דשבורד ניהול</h2>
          <p>תמונת מצב של מאגר השאלות והמבחנים שנוצרו, נשלחו, הושלמו ונבדקו.</p>
        </div>
        <div className="button-row">
          <Link className="button button-primary" href="/tests/new">
            יצירת מבחן חדש
          </Link>
          <Link className="button button-secondary" href="/questions">
            ניהול שאלות
          </Link>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card card-dark stat">
          <span>שאלות פעילות</span>
          <strong>{stats.questions}</strong>
        </div>
        <div className="card stat">
          <span>Generated tests</span>
          <strong>{stats.generated}</strong>
        </div>
        <div className="card stat">
          <span>Sent tests</span>
          <strong>{stats.sent}</strong>
        </div>
        <div className="card stat">
          <span>Completed tests</span>
          <strong>{stats.completed}</strong>
        </div>
        <div className="card stat">
          <span>Graded tests</span>
          <strong>{stats.graded}</strong>
        </div>
      </div>

      <div className="card">
        <div className="page-header">
          <div>
            <h3>מבחנים אחרונים</h3>
            <p>מעקב אחרי כל מחזור החיים: generated, sent, completed, graded.</p>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>כותרת</th>
              <th>סטטוס</th>
              <th>יוצר</th>
              <th>תלמיד</th>
              <th>כמות שאלות</th>
              <th>ציון</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((test) => (
              <tr key={test.id}>
                <td>
                  <Link href={`/tests/${test.id}`}>{test.title}</Link>
                </td>
                <td>{test.status}</td>
                <td>{test.creatorName}</td>
                <td>{test.studentName || test.studentEmail || "-"}</td>
                <td>{test.questionCount}</td>
                <td>{test.grade ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
