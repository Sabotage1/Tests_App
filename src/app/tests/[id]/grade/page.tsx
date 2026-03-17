import { notFound } from "next/navigation";

import { gradeTestAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getTestById } from "@/lib/repository";

type GradePageProps = {
  params: Promise<{ id: string }>;
};

export default async function GradePage({ params }: GradePageProps) {
  await requireUser();
  const { id } = await params;
  const test = await getTestById(id);

  if (!test) {
    notFound();
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>בדיקת מבחן</h2>
          <p>השוואת תשובת תלמיד לתשובה הצפויה, עם ציון ומשוב לכל שאלה.</p>
        </div>
      </div>

      <form action={gradeTestAction}>
        <input type="hidden" name="testId" value={test.id} />
        <div className="stack">
          {test.questions.map((question) => (
            <div className="card" key={question.id}>
              <input type="hidden" name="questionIds" value={question.id} />
              <strong>שאלה {question.orderIndex}</strong>
              <p style={{ whiteSpace: "pre-wrap" }}>{question.prompt}</p>
              <div className="split">
                <div className="question-block">
                  <strong>תשובה צפויה</strong>
                  <p style={{ whiteSpace: "pre-wrap" }}>{question.expectedAnswer}</p>
                </div>
                <div className="question-block">
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
                    max="100"
                    step="1"
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
          <button className="button button-primary" type="submit">
            שמירת בדיקה
          </button>
        </div>
      </form>
    </div>
  );
}
