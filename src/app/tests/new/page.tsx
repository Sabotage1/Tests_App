import Link from "next/link";

import { createTestAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth";
import { QUESTION_UNIT_LABELS, type QuestionUnit } from "@/lib/constants";
import { getDefaultTestDurationMinutes, getQuestions, getStages, getSubjects } from "@/lib/repository";

type NewTestPageProps = {
  searchParams: Promise<{ error?: string; unit?: string }>;
};

export default async function NewTestPage({ searchParams }: NewTestPageProps) {
  await requireUser();
  const params = await searchParams;
  const [subjects, stages, defaultDurationMinutes, questions] = await Promise.all([
    getSubjects(),
    getStages(),
    getDefaultTestDurationMinutes(),
    getQuestions(),
  ]);
  const selectedUnit: QuestionUnit = params.unit === "ifr" ? "ifr" : "vfr";
  const activeQuestions = questions.filter((question) => question.isActive === 1 && question.unit === selectedUnit);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>יצירת מבחן חדש</h2>
          <p>בחר יחידה, ואז בנה מבחן אקראי או ידני רק מהשאלות הרלוונטיות לאותה יחידה.</p>
        </div>
      </div>
      <div className="button-row">
        <Link className={selectedUnit === "vfr" ? "button" : "button button-secondary"} href="/tests/new?unit=vfr">
          {QUESTION_UNIT_LABELS.vfr}
        </Link>
        <Link className={selectedUnit === "ifr" ? "button" : "button button-secondary"} href="/tests/new?unit=ifr">
          {QUESTION_UNIT_LABELS.ifr}
        </Link>
      </div>
      {params.error ? <div className="alert">{params.error}</div> : null}
      <div className="card">
        <form action={createTestAction}>
          <input type="hidden" name="unit" value={selectedUnit} />
          <div className="grid grid-2">
            <label>
              כותרת מבחן
              <input name="title" defaultValue="מבחן חדש" required />
            </label>
            <label>
              יחידה
              <input value={QUESTION_UNIT_LABELS[selectedUnit]} disabled />
            </label>
            <label>
              כמות שאלות
              <input name="questionCount" type="number" min="1" defaultValue="10" required />
            </label>
            <label>
              משך זמן בדקות
              <input
                name="durationMinutes"
                type="number"
                min="0"
                placeholder={`ברירת מחדל: ${defaultDurationMinutes}`}
              />
            </label>
            <label>
              שיטת בחירה
              <select name="selectionMode" defaultValue="random">
                <option value="random">אקראי מכל המאגר</option>
                <option value="filtered">אקראי רק לפי הנושאים והשלבים שנבחרו</option>
                <option value="manual">בחירה ידנית מהמאגר</option>
              </select>
            </label>
            <label>
              שם נבחן
              <input name="studentName" placeholder="אופציונלי" />
            </label>
            <label>
              מייל תלמיד
              <input name="studentEmail" type="email" placeholder="אופציונלי" />
            </label>
            <label>
              תאריך ושעת שליחה
              <input name="sentAt" type="datetime-local" />
            </label>
          </div>

          <div className="stack">
            <label className="checkbox-card" style={{ maxWidth: 420 }}>
              <input type="checkbox" name="onlyAnswered" />
              בחר רק שאלות עם תשובה צפויה קיימת
            </label>
            <p className="muted">
              בבחירה ידנית, המבחן יורכב בדיוק מהשאלות שיסומנו כאן למטה, וכמות השאלות תיקבע לפי מספר הסימונים.
            </p>
          </div>

          <div className="stack">
            <strong>נושאים למבחן</strong>
            <div className="checkbox-grid">
              {subjects.map((subject) => (
                <label className="checkbox-card" key={subject.value}>
                  <input type="checkbox" name="subjectIds" value={subject.value} />
                  {subject.label}
                </label>
              ))}
            </div>
          </div>

          <div className="stack">
            <strong>שלבים למבחן</strong>
            <div className="checkbox-grid">
              {stages.map((stage) => (
                <label className="checkbox-card" key={stage.value}>
                  <input type="checkbox" name="stageIds" value={stage.value} />
                  {stage.label}
                </label>
              ))}
            </div>
          </div>

          <div className="stack">
            <strong>בחירה ידנית של שאלות מהמאגָר עבור {QUESTION_UNIT_LABELS[selectedUnit]}</strong>
            <div className="question-picker-list">
              {activeQuestions.map((question) => (
                <label className="question-picker-card" key={question.id}>
                  <input type="checkbox" name="questionIds" value={question.id} />
                  <div className="stack" style={{ gap: 8 }}>
                    <div>
                      <strong>{question.sourceReference || "ללא סימוכין"}</strong>
                      <p className="muted question-picker-meta">
                        {question.source} | {question.questionType === "multiple_choice" ? "רב ברירה" : "פתוחה"}
                      </p>
                    </div>
                    <p style={{ whiteSpace: "pre-wrap" }}>{question.text}</p>
                  </div>
                </label>
              ))}
            </div>
            {activeQuestions.length === 0 ? (
              <div className="muted">עדיין אין שאלות פעילות משויכות ליחידה הזאת.</div>
            ) : null}
          </div>

          <p className="muted">
            אם לא יוזן זמן, יילקח ערך ברירת המחדל מהמערכת. אם יוזן 0, למבחן לא תהיה מגבלת זמן.
          </p>

          <SubmitButton pendingLabel="יוצר מבחן...">
            יצירת מבחן
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
