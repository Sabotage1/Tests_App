import { notFound } from "next/navigation";

import { gradeTestAction, gradeTestWithAiAction } from "@/app/actions";
import { getAccessibleUnitsForUser, requireUser } from "@/lib/auth";
import { AiGradingButton } from "@/components/AiGradingButton";
import { SubmitButton } from "@/components/SubmitButton";
import { getBonusQuestionPoints, getTestById } from "@/lib/repository";

type GradePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aiSaved?: string; aiError?: string }>;
};

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

export default async function GradePage({ params, searchParams }: GradePageProps) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const [test, bonusQuestionPoints] = await Promise.all([
    getTestById(id, getAccessibleUnitsForUser(user)),
    getBonusQuestionPoints(),
  ]);

  if (!test) {
    notFound();
  }

  const solvedMinutes = getSolvedMinutes(test.startedAt, test.submittedAt);
  const regularQuestionCount = test.questions.filter((question) => !question.isBonus).length;
  const scoredQuestionCount = regularQuestionCount > 0 ? regularQuestionCount : test.questions.length;
  const maxPerRegularQuestion = scoredQuestionCount > 0 ? Number((100 / scoredQuestionCount).toFixed(2)) : 0;
  const bonusQuestionCount = test.questions.filter((question) => question.isBonus).length;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>בדיקת מבחן</h2>
          <p>השוואת תשובת תלמיד לתשובה הצפויה, עם ציון ומשוב לכל שאלה.</p>
          <p className="muted">
            התחיל: {test.startedAt ? new Date(test.startedAt).toLocaleString("he-IL") : "-"} | הוגש:{" "}
            {test.submittedAt ? new Date(test.submittedAt).toLocaleString("he-IL") : "-"} | זמן פתרון:{" "}
            {solvedMinutes !== null ? `${solvedMinutes} דקות` : "-"}
          </p>
          <p className="muted">
            ציון הבסיס מחושב עד 100. כל שאלה רגילה שווה עד {maxPerRegularQuestion} נקודות.
          </p>
          {bonusQuestionCount > 0 ? (
            <p className="muted">כל שאלת בונוס שווה {bonusQuestionPoints} נקודות מעל 100 ומחוץ לחישוב הרגיל של המבחן.</p>
          ) : null}
          {test.status === "graded" ? (
            <p className="muted">הבדיקה כבר נשמרה בעבר וניתן לערוך אותה מחדש במקרה של ערעור ולשמור שוב.</p>
          ) : null}
        </div>
        <form action={gradeTestWithAiAction}>
          <input type="hidden" name="testId" value={test.id} />
          <AiGradingButton />
        </form>
      </div>
      {query.aiSaved ? (
        <div className="alert">תוצאות הבדיקה האוטומטית נשמרו במבחן. ניתן לעבור ולתקן ידנית לפני שמירה נוספת.</div>
      ) : null}
      {query.aiError ? <div className="alert">{query.aiError}</div> : null}

      <form action={gradeTestAction}>
        <input type="hidden" name="testId" value={test.id} />
        <div className="stack">
          {test.questions.map((question) => (
            <div className="card" key={question.id}>
              <input type="hidden" name="questionIds" value={question.id} />
              <strong>{question.isBonus ? "שאלת בונוס" : "שאלה"} {question.orderIndex}</strong>
              {question.isBonus ? <p className="muted">שאלה זו נמשכה ממאגר שאלות הבונוס ומסומנת כשאלת בונוס.</p> : null}
              <p style={{ whiteSpace: "pre-wrap" }}>{question.prompt}</p>
              <div className="split grade-split">
                <div className="question-block grade-panel expected-answer">
                  <strong>תשובה צפויה</strong>
                  <p style={{ whiteSpace: "pre-wrap" }}>{question.expectedAnswer}</p>
                </div>
                <div className="question-block grade-panel">
                  <strong>תשובת תלמיד</strong>
                  <p style={{ whiteSpace: "pre-wrap" }}>{question.studentAnswer || "-"}</p>
                </div>
              </div>
              <div className="split">
                <label>
                  ציון לשאלה
                  <input
                    type="number"
                    name={`score:${question.id}`}
                    min="0"
                    max={question.isBonus ? bonusQuestionPoints : maxPerRegularQuestion}
                    step="0.01"
                    defaultValue={question.score ?? 0}
                    required
                  />
                </label>
                <label>
                  הערת בודק
                  <textarea name={`feedback:${question.id}`} defaultValue={question.feedback ?? ""} />
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <label>
            הערות כלליות
            <textarea name="gradingNotes" defaultValue={test.gradingNotes ?? ""} />
          </label>
          <p className="muted">בלחיצה על שמירת בדיקה, המערכת תנסה לשלוח לנבחן את הציון לכתובת המייל שהוזנה במבחן.</p>
          <div className="grade-actions">
            <SubmitButton pendingLabel="שומר בדיקה...">
              שמירת בדיקה
            </SubmitButton>
          </div>
        </div>
      </form>
    </div>
  );
}
