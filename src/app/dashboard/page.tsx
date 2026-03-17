import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { TEST_STATUSES, type TestStatus } from "@/lib/constants";
import { getDashboardStats, getTests } from "@/lib/repository";

type DashboardPageProps = {
  searchParams: Promise<{ status?: string }>;
};

const STATUS_LABELS: Record<TestStatus, string> = {
  generated: "מבחנים שנוצרו",
  sent: "מבחנים שנשלחו",
  completed: "מבחנים שהוגשו",
  graded: "מבחנים שנבדקו",
};

function isValidStatus(status: string | undefined): status is TestStatus {
  return !!status && TEST_STATUSES.includes(status as TestStatus);
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireUser();
  const params = await searchParams;
  const [stats, tests] = await Promise.all([getDashboardStats(), getTests()]);
  const selectedStatus = isValidStatus(params.status) ? params.status : null;
  const filteredTests = selectedStatus ? tests.filter((test) => test.status === selectedStatus) : tests;

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
          <span>מבחנים שנוצרו</span>
          <strong>{stats.generated}</strong>
        </div>
        <div className="card stat">
          <span>מבחנים שנשלחו</span>
          <strong>{stats.sent}</strong>
        </div>
        <div className="card stat">
          <span>מבחנים שהוגשו</span>
          <strong>{stats.completed}</strong>
        </div>
        <div className="card stat">
          <span>מבחנים שנבדקו</span>
          <strong>{stats.graded}</strong>
        </div>
        <div className="card stat card-failed">
          <span>מבחנים שנכשלו</span>
          <strong>{stats.failed}</strong>
        </div>
      </div>

      <div className="card">
        <div className="page-header">
          <div>
            <h3>מבחנים אחרונים</h3>
            <p>
              {selectedStatus
                ? `מוצגים רק ${STATUS_LABELS[selectedStatus]}.`
                : "מעקב אחרי כל מחזור החיים של המבחנים."}
            </p>
          </div>
        </div>
        <div className="button-row" style={{ marginBottom: 16 }}>
          <Link className={`button ${selectedStatus === null ? "button-primary" : "button-secondary"}`} href="/dashboard">
            כל המבחנים
          </Link>
          {TEST_STATUSES.map((status) => (
            <Link
              key={status}
              className={`button ${selectedStatus === status ? "button-primary" : "button-secondary"}`}
              href={`/dashboard?status=${status}`}
            >
              {STATUS_LABELS[status]}
            </Link>
          ))}
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
            {filteredTests.map((test) => (
              <tr key={test.id}>
                <td>
                  <Link href={`/tests/${test.id}`}>{test.title}</Link>
                </td>
                <td>{STATUS_LABELS[test.status]}</td>
                <td>{test.creatorName}</td>
                <td>{test.studentName || test.studentEmail || "-"}</td>
                <td>{test.questionCount}</td>
                <td>{test.grade ?? "-"}</td>
              </tr>
            ))}
            {filteredTests.length === 0 ? (
              <tr>
                <td colSpan={6}>אין מבחנים להצגה במסנן שנבחר.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
