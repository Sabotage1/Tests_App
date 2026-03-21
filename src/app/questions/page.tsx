import Link from "next/link";

import { archiveQuestionAction, deleteQuestionAction, saveQuestionAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth";
import { QUESTION_UNIT_LABELS, type QuestionUnit } from "@/lib/constants";
import { getQuestionById, getQuestions, getStages, getSubjects } from "@/lib/repository";

type QuestionsPageProps = {
  searchParams: Promise<{ edit?: string; unit?: string }>;
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
  const selectedUnit: QuestionUnit = params.unit === "ifr" ? "ifr" : "vfr";
  const displayedQuestions = questions.filter((question) => question.unit === selectedUnit);
  const editFormUnit = editingQuestion?.unit ?? selectedUnit;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>מאגר שאלות ותשובות</h2>
          <p>לכל שאלה אפשר לשייך יחידה, נושאים ושלבים, ולייצר מבחנים נפרדים ל־VFR ול־IFR.</p>
        </div>
      </div>

      <div className="button-row">
        <Link
          className={selectedUnit === "vfr" ? "button unit-toggle-active" : "button unit-toggle-idle"}
          href="/questions?unit=vfr"
        >
          {QUESTION_UNIT_LABELS.vfr}
        </Link>
        <Link
          className={selectedUnit === "ifr" ? "button unit-toggle-active" : "button unit-toggle-idle"}
          href="/questions?unit=ifr"
        >
          {QUESTION_UNIT_LABELS.ifr}
        </Link>
      </div>

      <div className="grid grid-2">
        <div className="card" id="question-editor">
          <h3>{editingQuestion ? "עריכת שאלה" : "הוספת שאלה חדשה"}</h3>
          <form
            action={saveQuestionAction}
            key={editingQuestion?.id ?? `new-question-${selectedUnit}`}
          >
            <input name="id" type="hidden" defaultValue={editingQuestion?.id} />
            <input name="unitFilter" type="hidden" value={selectedUnit} />
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
                יחידה
                <select name="unit" defaultValue={editFormUnit}>
                  <option value="vfr">{QUESTION_UNIT_LABELS.vfr}</option>
                  <option value="ifr">{QUESTION_UNIT_LABELS.ifr}</option>
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
          <h3>שאלות קיימות ביחידה {QUESTION_UNIT_LABELS[selectedUnit]}</h3>
          <div className="stack">
            {displayedQuestions.map((question) => (
              <div className="question-block" key={question.id}>
                <div className="page-header">
                  <div>
                    <h3>{question.sourceReference || "שאלה"}</h3>
                    <p>{question.source}</p>
                    <p className="muted">{QUESTION_UNIT_LABELS[question.unit]}</p>
                  </div>
                  <div className="button-row">
                    <Link
                      className="button button-secondary"
                      href={`/questions?unit=${selectedUnit}&edit=${question.id}#question-editor`}
                      scroll
                    >
                      עריכה
                    </Link>
                    {user.role === "admin" ? (
                      <>
                        <form action={archiveQuestionAction}>
                          <input name="id" type="hidden" value={question.id} />
                          <input name="unitFilter" type="hidden" value={selectedUnit} />
                          <SubmitButton className="button button-danger" pendingLabel="מארכב שאלה...">
                            ארכוב
                          </SubmitButton>
                        </form>
                        <form action={deleteQuestionAction}>
                          <input name="id" type="hidden" value={question.id} />
                          <input name="unitFilter" type="hidden" value={selectedUnit} />
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
            {displayedQuestions.length === 0 ? <div className="muted">עדיין אין שאלות משויכות ליחידה הזאת.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
