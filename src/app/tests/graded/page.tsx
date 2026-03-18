import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { getTests } from "@/lib/repository";

type GradedTestsPageProps = {
  searchParams: Promise<{ year?: string; grade?: string }>;
};

type GradeBand = "all" | "below-60" | "60-69" | "70-79" | "80-89" | "90-plus";

const GRADE_LABELS: Record<GradeBand, string> = {
  all: "כל הציונים",
  "below-60": "מתחת ל־60",
  "60-69": "60-69",
  "70-79": "70-79",
  "80-89": "80-89",
  "90-plus": "90 ומעלה",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("he-IL") : "-";
}

function formatGrade(value: number | null) {
  return value === null ? "-" : Math.round(value);
}

function getTestYear(dateValue: string | null) {
  return dateValue ? String(new Date(dateValue).getFullYear()) : null;
}

function isGradeBand(value: string | undefined): value is GradeBand {
  return value === "all" || value === "below-60" || value === "60-69" || value === "70-79" || value === "80-89" || value === "90-plus";
}

function matchesGradeBand(grade: number, band: GradeBand) {
  if (band === "all") {
    return true;
  }

  if (band === "below-60") {
    return grade < 60;
  }

  if (band === "60-69") {
    return grade >= 60 && grade < 70;
  }

  if (band === "70-79") {
    return grade >= 70 && grade < 80;
  }

  if (band === "80-89") {
    return grade >= 80 && grade < 90;
  }

  return grade >= 90;
}

export default async function GradedTestsPage({ searchParams }: GradedTestsPageProps) {
  await requireUser();
  const params = await searchParams;
  const tests = await getTests();
  const gradedTests = tests.filter((test) => test.status === "graded" && test.grade !== null);
  const years = [...new Set(gradedTests.map((test) => getTestYear(test.gradedAt)).filter(Boolean))].sort((a, b) =>
    Number(b) - Number(a),
  ) as string[];
  const selectedYear = params.year && years.includes(params.year) ? params.year : "all";
  const selectedGrade = isGradeBand(params.grade) ? params.grade : "all";

  const filteredTests = gradedTests.filter((test) => {
    const testYear = getTestYear(test.gradedAt);
    const yearMatches = selectedYear === "all" || testYear === selectedYear;
    const gradeMatches = test.grade !== null && matchesGradeBand(test.grade, selectedGrade);

    return yearMatches && gradeMatches;
  });

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>מבחנים שנבדקו</h2>
          <p>רשימת כל המבחנים שנבדקו וקיבלו ציון, עם אפשרות סינון לפי שנה וטווח ציון.</p>
        </div>
      </div>

      <div className="card">
        <form method="get">
          <div className="grid grid-2">
            <label>
              סינון לפי שנה
              <select name="year" defaultValue={selectedYear}>
                <option value="all">כל השנים</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label>
              סינון לפי ציון
              <select name="grade" defaultValue={selectedGrade}>
                {(Object.keys(GRADE_LABELS) as GradeBand[]).map((gradeBand) => (
                  <option key={gradeBand} value={gradeBand}>
                    {GRADE_LABELS[gradeBand]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="button-row">
            <button className="button button-primary" type="submit">
              סינון רשימה
            </button>
            <Link className="button button-secondary" href="/tests/graded">
              ניקוי סינון
            </Link>
          </div>
        </form>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>מבחן</th>
              <th>נבחן</th>
              <th>שנת בדיקה</th>
              <th>מועד בדיקה</th>
              <th>מועד הגשה</th>
              <th>ציון</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filteredTests.map((test) => (
              <tr key={test.id}>
                <td>
                  <strong>{test.title}</strong>
                  <div className="muted">יוצר: {test.creatorName}</div>
                </td>
                <td>{test.studentName || test.studentEmail || "-"}</td>
                <td>{getTestYear(test.gradedAt) || "-"}</td>
                <td>{formatDate(test.gradedAt)}</td>
                <td>{formatDate(test.submittedAt)}</td>
                <td>{formatGrade(test.grade)}</td>
                <td>
                  <div className="button-row">
                    <Link className="button button-secondary" href={`/tests/${test.id}`}>
                      פתיחת מבחן
                    </Link>
                    <Link className="button button-secondary" href={`/print/tests/${test.id}`} target="_blank">
                      ייצוא ל־PDF
                    </Link>
                    <Link className="button button-success" href={`/tests/${test.id}/grade`}>
                      צפייה / עריכת בדיקה
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {filteredTests.length === 0 ? (
              <tr>
                <td colSpan={7}>אין מבחנים שנבדקו במסנן שבחרת.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
