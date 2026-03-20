import Link from "next/link";

import { archiveQuestionAction, deleteQuestionAction, saveQuestionAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth";
import { getQuestionById, getQuestions, getStages, getSubjects } from "@/lib/repository";

type QuestionsPageProps = {
  searchParams: Promise<{ edit?: string }>;
};

export default async function QuestionsPage({ searchParams }: QuestionsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const [questions, subjects, stages, editingQuestion] = await Promise.all([
    getQuestions(),
    getSubjects(),
    getStages(),
    params.edit ? getQuestionById(params.edit) : Promise.resolve(null),
  ]);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>מאגר שאלות ותשובות</h2>
          <p>לכל שאלה אפשר לשייך כמה נושאים וכמה שלבים, ולשנות אותם בהמשך.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>{editingQuestion ? "עריכת שאלה" : "הוספת שאלה חדשה"}</h3>
          <form action={saveQuestionAction} key={editingQuestion?.id ?? "new-question"}>
            <input name="id" type="hidden" defaultValue={editingQuestion?.id} />
            <label>
              נוסח השאלה
              <textarea name="text" required defaultValue={editingQuestion?.text} />
            </label>
            <label>
              תשובה נכונה / צפויה
              <textarea name="answer" defaultValue={editingQuestion?.answer} />
            </label>
            <div className="split">
              <label>
                סוג שאלה
                <select
                  name="questionType"
                  defaultValue={editingQuestion?.questionType === "multiple_choice" ? "multiple_choice" : "open"}
                >
                  <option value="open">פתוחה</option>
                  <option value="multiple_choice">רב ברירה</option>
                </select>
              </label>
              <label>
                מקור
                <input name="source" defaultValue={editingQuestion?.source ?? "הוזן ידנית"} required />
              </label>
            </div>
            <label>
              סימוכין
              <input name="sourceReference" defaultValue={editingQuestion?.sourceReference ?? ""} />
            </label>
            <div className="stack">
              <strong>שיוך לנושאים</strong>
              <div className="checkbox-grid">
                {subjects.map((subject) => (
                  <label key={subject.value} className="checkbox-card">
                    <input
                      type="checkbox"
                      name="subjectIds"
                      value={subject.value}
                      defaultChecked={editingQuestion?.subjectIds.includes(subject.value)}
                    />
                    {subject.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="stack">
              <strong>שיוך לשלבים</strong>
              <div className="checkbox-grid">
                {stages.map((stage) => (
                  <label key={stage.value} className="checkbox-card">
                    <input
                      type="checkbox"
                      name="stageIds"
                      value={stage.value}
                      defaultChecked={editingQuestion?.stageIds.includes(stage.value)}
                    />
                    {stage.label}
                  </label>
                ))}
              </div>
            </div>
            <SubmitButton pendingLabel="שומר שאלה...">
              שמירת שאלה
            </SubmitButton>
          </form>
        </div>

        <div className="card">
          <h3>שאלות קיימות</h3>
          <div className="stack">
            {questions.map((question) => (
              <div className="question-block" key={question.id}>
                <div className="page-header">
                  <div>
                    <h3>{question.sourceReference || "שאלה"}</h3>
                    <p>{question.source}</p>
                  </div>
                  <div className="button-row">
                    <Link className="button button-secondary" href={`/questions?edit=${question.id}`}>
                      עריכה
                    </Link>
                    {user.role === "admin" ? (
                      <>
                        <form action={archiveQuestionAction}>
                          <input name="id" type="hidden" value={question.id} />
                          <SubmitButton className="button button-danger" pendingLabel="מארכב שאלה...">
                            ארכוב
                          </SubmitButton>
                        </form>
                        <form action={deleteQuestionAction}>
                          <input name="id" type="hidden" value={question.id} />
                          <SubmitButton className="button button-danger" pendingLabel="מוחק שאלה...">
                            מחיקה
                          </SubmitButton>
                        </form>
                      </>
                    ) : null}
                  </div>
                </div>
                <p style={{ whiteSpace: "pre-wrap" }}>{question.text}</p>
                <div className="pill-row">
                  {question.subjectNames.map((subject) => (
                    <span className="pill" key={subject}>
                      {subject}
                    </span>
                  ))}
                </div>
                <div className="pill-row">
                  {question.stageNames.map((stage) => (
                    <span className="pill" key={stage}>
                      {stage}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
