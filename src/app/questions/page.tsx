import Link from "next/link";
import type { Route } from "next";

import { archiveQuestionAction, deleteQuestionAction } from "@/app/actions";
import { QuestionEditorForm } from "@/components/QuestionEditorForm";
import { QuestionListHeightSync } from "@/components/QuestionListHeightSync";
import { QuestionUnitSwitcher } from "@/components/QuestionUnitSwitcher";
import { SubmitButton } from "@/components/SubmitButton";
import { getAccessibleUnitsForUser, getSelectedUnitForUser, getUnitOrderForUser, requireUser } from "@/lib/auth";
import { QUESTION_UNIT_LABELS, type QuestionUnit } from "@/lib/constants";
import { getNextQuestionReferenceForUnit, getQuestionBankSummaries, getQuestionById, getStages, getSubjects } from "@/lib/repository";

type QuestionsPageProps = {
  searchParams: Promise<{ edit?: string; unit?: string; error?: string; bonus?: string; subject?: string; stage?: string }>;
};

type BonusFilter = "all" | "bonus" | "regular";

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildQuestionsQueryString(input: {
  unit: QuestionUnit;
  bonusFilter: BonusFilter;
  subjectId: string;
  stageId: string;
  edit?: string;
}) {
  const params = new URLSearchParams();
  params.set("unit", input.unit);

  if (input.bonusFilter !== "all") {
    params.set("bonus", input.bonusFilter);
  }

  if (input.subjectId) {
    params.set("subject", input.subjectId);
  }

  if (input.stageId) {
    params.set("stage", input.stageId);
  }

  if (input.edit) {
    params.set("edit", input.edit);
  }

  return `?${params.toString()}`;
}

export default async function QuestionsPage({ searchParams }: QuestionsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const selectedUnit: QuestionUnit = getSelectedUnitForUser(user, params.unit);
  const accessibleUnits = getAccessibleUnitsForUser(user);
  const unitOrder = getUnitOrderForUser(user);
  const [subjects, stages] = await Promise.all([getSubjects(selectedUnit), getStages(selectedUnit)]);
  const selectedBonusFilter: BonusFilter =
    getSingleValue(params.bonus) === "bonus" ? "bonus" : getSingleValue(params.bonus) === "regular" ? "regular" : "all";
  const requestedSubjectId = getSingleValue(params.subject);
  const requestedStageId = getSingleValue(params.stage);
  const selectedSubjectId = subjects.some((subject) => subject.value === requestedSubjectId) ? requestedSubjectId : "";
  const selectedStageId = stages.some((stage) => stage.value === requestedStageId) ? requestedStageId : "";
  const [displayedQuestions, editingQuestion, nextQuestionReference] = await Promise.all([
    getQuestionBankSummaries({
      unit: selectedUnit,
      bonusFilter: selectedBonusFilter,
      subjectId: selectedSubjectId || undefined,
      stageId: selectedStageId || undefined,
    }),
    params.edit ? getQuestionById(params.edit, accessibleUnits) : Promise.resolve(null),
    getNextQuestionReferenceForUnit(selectedUnit),
  ]);
  const unitQuestions = displayedQuestions;
  const displayedQuestionLabels = new Map(
    unitQuestions.map((question, index) => [question.id, question.sourceReference || `שאלה ${index + 1}`]),
  );
  const editorSourceReference = editingQuestion
    ? displayedQuestionLabels.get(editingQuestion.id) ?? editingQuestion.sourceReference ?? nextQuestionReference
    : nextQuestionReference;
  const currentQuestionsQueryString = buildQuestionsQueryString({
    unit: selectedUnit,
    bonusFilter: selectedBonusFilter,
    subjectId: selectedSubjectId,
    stageId: selectedStageId,
  });

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>מאגר שאלות ותשובות</h2>
          <p>לכל שאלה אפשר לשייך יחידה, נושאים ושלבים, ולייצר מבחנים נפרדים ל־VFR ול־IFR.</p>
        </div>
      </div>

      <QuestionUnitSwitcher selectedUnit={selectedUnit} unitOrder={unitOrder} />
      <div className="button-row">
        <Link className="button button-primary" href={`/questions${currentQuestionsQueryString}#question-editor` as Route} scroll>
          הוסף שאלה חדשה
        </Link>
      </div>
      {params.error ? <div className="alert">{params.error}</div> : null}

      <QuestionListHeightSync />
      <div className="grid grid-2 question-management-grid">
        <div className="card" id="question-editor">
          <h3>{editingQuestion ? "עריכת שאלה" : "הוספת שאלה חדשה"}</h3>
          <QuestionEditorForm
            bonusFilter={selectedBonusFilter}
            editingQuestion={editingQuestion}
            key={editingQuestion?.id ?? `new-question-${selectedUnit}`}
            nextSourceReference={editorSourceReference}
            selectedStageId={selectedStageId}
            selectedSubjectId={selectedSubjectId}
            selectedUnit={selectedUnit}
            stages={stages}
            subjects={subjects}
          />
        </div>

        <div className="card question-list-panel" id="question-list-panel">
          <h3>שאלות קיימות ביחידה {QUESTION_UNIT_LABELS[selectedUnit]}</h3>
          <form className="stack question-filter-form" method="get">
            <input type="hidden" name="unit" value={selectedUnit} />
            <div className="question-filter-grid">
              <label>
                סינון לפי בונוס
                <select name="bonus" defaultValue={selectedBonusFilter}>
                  <option value="all">כל השאלות</option>
                  <option value="bonus">רק שאלות בונוס</option>
                  <option value="regular">רק שאלות רגילות</option>
                </select>
              </label>
              <label>
                סינון לפי נושא
                <select name="subject" defaultValue={selectedSubjectId}>
                  <option value="">כל הנושאים</option>
                  {subjects.map((subject) => (
                    <option key={subject.value} value={subject.value}>
                      {subject.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                סינון לפי שלב
                <select name="stage" defaultValue={selectedStageId}>
                  <option value="">כל השלבים</option>
                  {stages.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="button-row">
              <button className="button button-primary" type="submit">
                סינון מאגר
              </button>
              <Link className="button button-secondary" href={`/questions?unit=${selectedUnit}`}>
                ניקוי סינון
              </Link>
            </div>
            <p className="muted">מוצגות {displayedQuestions.length} שאלות ביחידה.</p>
          </form>
          <div className="stack question-list-scroll">
            {displayedQuestions.map((question) => (
              <div className="question-block" key={question.id}>
                <div className="page-header">
                  <div>
                    <h3>{displayedQuestionLabels.get(question.id) || "שאלה"}</h3>
                    <p>{question.source}</p>
                    <p className="muted">{QUESTION_UNIT_LABELS[question.unit]}</p>
                  </div>
                  <div className="button-row">
                    <Link
                      className="button button-secondary"
                      href={`/questions${buildQuestionsQueryString({
                        unit: selectedUnit,
                        bonusFilter: selectedBonusFilter,
                        subjectId: selectedSubjectId,
                        stageId: selectedStageId,
                        edit: question.id,
                      })}#question-editor` as Route}
                      scroll
                    >
                      עריכה
                    </Link>
                    {user.role === "admin" ? (
                      <>
                        <form action={archiveQuestionAction}>
                          <input name="id" type="hidden" value={question.id} />
                          <input name="unitFilter" type="hidden" value={selectedUnit} />
                          <input name="bonusFilter" type="hidden" value={selectedBonusFilter} />
                          <input name="subjectFilter" type="hidden" value={selectedSubjectId} />
                          <input name="stageFilter" type="hidden" value={selectedStageId} />
                          <SubmitButton className="button button-danger" pendingLabel="מארכב שאלה...">
                            ארכוב
                          </SubmitButton>
                        </form>
                        <form action={deleteQuestionAction}>
                          <input name="id" type="hidden" value={question.id} />
                          <input name="unitFilter" type="hidden" value={selectedUnit} />
                          <input name="bonusFilter" type="hidden" value={selectedBonusFilter} />
                          <input name="subjectFilter" type="hidden" value={selectedSubjectId} />
                          <input name="stageFilter" type="hidden" value={selectedStageId} />
                          <SubmitButton
                            className="button button-danger"
                            confirmMessage="למחוק את השאלה מהמאגר? פעולה זו מוחקת אותה לצמיתות."
                            pendingLabel="מוחק שאלה..."
                          >
                            מחיקה
                          </SubmitButton>
                        </form>
                      </>
                    ) : null}
                  </div>
                </div>
                <p style={{ whiteSpace: "pre-wrap" }}>{question.text}</p>
                <div className="pill-row">
                  {question.isBonusSource ? <span className="pill pill-bonus">שאלת בונוס</span> : null}
                  <span className="pill">{question.questionType === "multiple_choice" ? "רב ברירה" : "פתוחה"}</span>
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
