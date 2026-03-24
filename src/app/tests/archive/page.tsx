import Link from "next/link";

import { getSelectedUnitForUser, getUnitOrderForUser, requireUser } from "@/lib/auth";
import { QUESTION_UNIT_LABELS, type QuestionUnit, type TestStatus } from "@/lib/constants";
import { getTests } from "@/lib/repository";

type ArchivePageProps = {
  searchParams: Promise<{ error?: string; unit?: string; year?: string; subject?: string; stage?: string }>;
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

function getArchiveYear(value: string | null) {
  if (!value) {
    return null;
  }

  return String(new Date(value).getFullYear());
}

export default async function ArchiveTestsPage({ searchParams }: ArchivePageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const tests = await getTests();
  const selectedUnit: QuestionUnit = getSelectedUnitForUser(user, params.unit);
  const unitOrder = getUnitOrderForUser(user);
  const selectedYear = params.year?.trim() ?? "";
  const selectedSubject = params.subject?.trim() ?? "";
  const selectedStage = params.stage?.trim() ?? "";
  const archivedTests = tests.filter((test) => test.status !== "generated" && test.unit === selectedUnit);
  const availableYears = Array.from(
    new Set(
      archivedTests
        .map((test) => getArchiveYear(test.sentAt || test.createdAt))
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => Number(right) - Number(left));
  const availableSubjects = Array.from(
    new Set(archivedTests.flatMap((test) => test.subjectNames).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, "he"));
  const availableStages = Array.from(
    new Set(archivedTests.flatMap((test) => test.stageNames).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, "he"));
  const filteredArchivedTests = archivedTests.filter((test) => {
    const archiveYear = getArchiveYear(test.sentAt || test.createdAt);
    const yearMatch = !selectedYear || archiveYear === selectedYear;
    const subjectMatch = !selectedSubject || test.subjectNames.includes(selectedSubject);
    const stageMatch = !selectedStage || test.stageNames.includes(selectedStage);

    return yearMatch && subjectMatch && stageMatch;
  });

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>ארכיון מבחנים</h2>
          <p>רשימת המבחנים שנשלחו בעבר עבור היחידה שנבחרה, עם נתוני נבחן, מועדים, ציון ופעולות להמשך טיפול.</p>
        </div>
      </div>
      <div className="button-row">
        {unitOrder.map((unit) => (
          <Link
            key={unit}
            className={selectedUnit === unit ? "button unit-toggle-active" : "button unit-toggle-idle"}
            href={`/tests/archive?unit=${unit}`}
          >
            {QUESTION_UNIT_LABELS[unit]}
          </Link>
        ))}
      </div>
      {params.error ? <div className="alert">{params.error}</div> : null}

      <div className="card">
        <form action="/tests/archive" method="get">
          <input type="hidden" name="unit" value={selectedUnit} />
          <div className="grid grid-3">
            <label>
              סינון לפי שנה
              <select name="year" defaultValue={selectedYear}>
                <option value="">כל השנים</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label>
              סינון לפי נושא
              <select name="subject" defaultValue={selectedSubject}>
                <option value="">כל הנושאים</option>
                {availableSubjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </label>
            <label>
              סינון לפי שלב
              <select name="stage" defaultValue={selectedStage}>
                <option value="">כל השלבים</option>
                {availableStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="button-row">
            <button className="button button-primary" type="submit">
              החל סינון
            </button>
            <Link className="button button-secondary" href={`/tests/archive?unit=${selectedUnit}`}>
              איפוס סינון
            </Link>
          </div>
        </form>
      </div>

      <div className="card">
        {filteredArchivedTests.length > 0 ? (
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
              {filteredArchivedTests.map((test) => (
                <tr key={test.id}>
                  <td>
                    <strong>{test.title}</strong>
                    <div className="muted">{QUESTION_UNIT_LABELS[test.unit]}</div>
                    <div className="muted">שאלות: {test.questionCount}</div>
                    {test.subjectNames.length > 0 ? <div className="muted">נושאים: {test.subjectNames.join(", ")}</div> : null}
                    {test.stageNames.length > 0 ? <div className="muted">שלבים: {test.stageNames.join(", ")}</div> : null}
                  </td>
                  <td>{test.studentName || "-"}</td>
                  <td>{test.studentEmail || "-"}</td>
                  <td>{STATUS_LABELS[test.status]}</td>
                  <td>{formatDate(test.sentAt)}</td>
                  <td>{formatDate(test.submittedAt)}</td>
                  <td>{formatGrade(test.grade)}</td>
                  <td>
                    <div className="button-row">
                      <Link className="button button-secondary" href={`/tests/${test.id}`}>
                        פתיחת מבחן
                      </Link>
                      <Link className="button button-success" href={`/tests/${test.id}/grade`}>
                        בדיקה חוזרת
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div>אין מבחנים בארכיון עבור היחידה והסינון שנבחרו כרגע.</div>
        )}
      </div>
    </div>
  );
}
