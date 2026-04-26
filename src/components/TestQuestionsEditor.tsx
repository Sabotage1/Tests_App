"use client";

import { useMemo, useState } from "react";

import { updateTestQuestionsAction } from "@/app/actions";
import { MultipleChoicePreview } from "@/components/MultipleChoicePreview";
import { SubmitButton } from "@/components/SubmitButton";
import { QUESTION_UNIT_LABELS, type QuestionUnit } from "@/lib/constants";
import type { QuestionRow } from "@/lib/types";

type TestQuestionsEditorProps = {
  bonusQuestions: QuestionRow[];
  initialBonusQuestionIds: string[];
  initialRegularQuestionIds: string[];
  regularQuestions: QuestionRow[];
  testId: string;
  unit: QuestionUnit;
};

function getQuestionLabel(question: QuestionRow) {
  return `${question.sourceReference || "ללא סימוכין"} | ${question.source}`;
}

function getFirstAvailableQuestionId(
  questions: QuestionRow[],
  blockedQuestionIds: Set<string>,
) {
  return questions.find((question) => !blockedQuestionIds.has(question.id))?.id ?? "";
}

export function TestQuestionsEditor({
  bonusQuestions,
  initialBonusQuestionIds,
  initialRegularQuestionIds,
  regularQuestions,
  testId,
  unit,
}: TestQuestionsEditorProps) {
  const [regularQuestionIds, setRegularQuestionIds] = useState(initialRegularQuestionIds);
  const [bonusQuestionIds, setBonusQuestionIds] = useState(initialBonusQuestionIds);
  const allQuestionsById = useMemo(
    () => new Map([...regularQuestions, ...bonusQuestions].map((question) => [question.id, question])),
    [bonusQuestions, regularQuestions],
  );
  const totalQuestionCount = regularQuestionIds.length + bonusQuestionIds.length;

  function replaceRegularQuestion(index: number, questionId: string) {
    setRegularQuestionIds((current) => current.map((id, currentIndex) => (currentIndex === index ? questionId : id)));
  }

  function replaceBonusQuestion(index: number, questionId: string) {
    setBonusQuestionIds((current) => current.map((id, currentIndex) => (currentIndex === index ? questionId : id)));
  }

  function addRegularQuestion() {
    const blockedQuestionIds = new Set([...regularQuestionIds, ...bonusQuestionIds]);
    const nextQuestionId = getFirstAvailableQuestionId(regularQuestions, blockedQuestionIds);

    if (nextQuestionId) {
      setRegularQuestionIds((current) => [...current, nextQuestionId]);
    }
  }

  function addBonusQuestion() {
    const blockedQuestionIds = new Set([...regularQuestionIds, ...bonusQuestionIds]);
    const nextQuestionId = getFirstAvailableQuestionId(bonusQuestions, blockedQuestionIds);

    if (nextQuestionId) {
      setBonusQuestionIds((current) => [...current, nextQuestionId]);
    }
  }

  function removeRegularQuestion(index: number) {
    setRegularQuestionIds((current) => {
      if (current.length <= 1) {
        return current;
      }

      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  function removeBonusQuestion(index: number) {
    setBonusQuestionIds((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function renderQuestionRows(input: {
    ids: string[];
    questions: QuestionRow[];
    title: string;
    isBonus?: boolean;
    replaceQuestion: (index: number, questionId: string) => void;
    removeQuestion: (index: number) => void;
  }) {
    return (
      <div className="stack">
        <h3>{input.title}</h3>
        {input.ids.map((questionId, index) => {
          const question = allQuestionsById.get(questionId);
          const usedQuestionIds = new Set([
            ...regularQuestionIds.filter((_, currentIndex) => input.isBonus || currentIndex !== index),
            ...bonusQuestionIds.filter((_, currentIndex) => !input.isBonus || currentIndex !== index),
          ]);

          if (!question) {
            return (
              <div className="alert test-question-editor-row" key={`${input.title}-missing-${index}`}>
                <span>אחת השאלות שנבחרו כבר לא זמינה במאגר הפעיל. הסר אותה או בחר שאלה אחרת.</span>
                <button
                  className="button button-danger"
                  disabled={!input.isBonus && regularQuestionIds.length <= 1}
                  onClick={() => input.removeQuestion(index)}
                  type="button"
                >
                  הסרה
                </button>
              </div>
            );
          }

          return (
            <div className="question-block test-question-editor-row" key={`${input.title}-${questionId}-${index}`}>
              <div className="stack" style={{ gap: 10 }}>
                <div className="page-header test-question-editor-row-header">
                  <div>
                    <strong>
                      {input.isBonus ? "בונוס" : "שאלה"} {index + 1}
                    </strong>
                    <p className="muted">
                      {getQuestionLabel(question)} | {question.questionType === "multiple_choice" ? "רב ברירה" : "פתוחה"}
                    </p>
                  </div>
                </div>

                <label>
                  החלפה
                  <select value={questionId} onChange={(event) => input.replaceQuestion(index, event.target.value)}>
                    {input.questions.map((option) => (
                      <option disabled={usedQuestionIds.has(option.id)} key={option.id} value={option.id}>
                        {getQuestionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <p style={{ whiteSpace: "pre-wrap" }}>{question.text}</p>
                {question.questionType === "multiple_choice" ? (
                  <MultipleChoicePreview
                    choiceMode={question.choiceMode}
                    options={question.choiceOptions}
                    showCorrectAnswers
                    showMultipleHint
                  />
                ) : null}
              </div>
              <button
                className="button button-danger"
                disabled={!input.isBonus && regularQuestionIds.length <= 1}
                onClick={() => input.removeQuestion(index)}
                type="button"
              >
                הסרה
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <form action={updateTestQuestionsAction}>
      <input type="hidden" name="testId" value={testId} />
      <input type="hidden" name="unit" value={unit} />
      {regularQuestionIds.map((questionId, index) => (
        <input key={`regular-${questionId}-${index}`} type="hidden" name="regularQuestionIds" value={questionId} />
      ))}
      {bonusQuestionIds.map((questionId, index) => (
        <input key={`bonus-${questionId}-${index}`} type="hidden" name="bonusQuestionIds" value={questionId} />
      ))}

      <div className="test-question-editor-toolbar">
        <div>
          <strong>עריכת שאלות המבחן</strong>
          <p className="muted">
            {QUESTION_UNIT_LABELS[unit]} | נבחרו {totalQuestionCount} שאלות: {regularQuestionIds.length} רגילות
            {bonusQuestionIds.length > 0 ? ` + ${bonusQuestionIds.length} בונוס` : ""}
          </p>
        </div>
        <div className="button-row">
          <button className="button button-secondary" onClick={addRegularQuestion} type="button">
            הוספת שאלה
          </button>
          <button className="button button-secondary" onClick={addBonusQuestion} type="button">
            הוספת בונוס
          </button>
        </div>
      </div>

      {renderQuestionRows({
        ids: regularQuestionIds,
        questions: regularQuestions,
        title: "שאלות רגילות",
        replaceQuestion: replaceRegularQuestion,
        removeQuestion: removeRegularQuestion,
      })}

      {bonusQuestionIds.length > 0
        ? renderQuestionRows({
            ids: bonusQuestionIds,
            questions: bonusQuestions,
            title: "שאלות בונוס",
            isBonus: true,
            replaceQuestion: replaceBonusQuestion,
            removeQuestion: removeBonusQuestion,
          })
        : null}

      <SubmitButton pendingLabel="שומר שינויי שאלות...">שמירת שאלות המבחן</SubmitButton>
    </form>
  );
}
