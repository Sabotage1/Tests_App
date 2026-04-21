"use client";

import { useState } from "react";

import { saveQuestionAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { getChoiceOptionLabel } from "@/lib/multiple-choice";
import { QUESTION_UNIT_LABELS, type QuestionUnit } from "@/lib/constants";
import type { ChoiceMode, ChoiceOption, Option, QuestionRow, QuestionType } from "@/lib/types";

type QuestionEditorFormProps = {
  bonusFilter: "all" | "bonus" | "regular";
  editingQuestion: QuestionRow | null;
  nextSourceReference: string;
  selectedStageId: string;
  selectedSubjectId: string;
  selectedUnit: QuestionUnit;
  stages: Option[];
  subjects: Option[];
};

function createChoiceOption(id: string, isCorrect = false): ChoiceOption {
  return {
    id,
    text: "",
    isCorrect,
  };
}

function createDefaultChoiceOptions() {
  return [
    createChoiceOption("option-1", true),
    createChoiceOption("option-2"),
    createChoiceOption("option-3"),
    createChoiceOption("option-4"),
  ];
}

export function QuestionEditorForm({
  bonusFilter,
  editingQuestion,
  nextSourceReference,
  selectedStageId,
  selectedSubjectId,
  selectedUnit,
  stages,
  subjects,
}: QuestionEditorFormProps) {
  const [questionType, setQuestionType] = useState<QuestionType>(editingQuestion?.questionType ?? "open");
  const [choiceMode, setChoiceMode] = useState<ChoiceMode>(editingQuestion?.choiceMode ?? "single");
  const [choiceOptions, setChoiceOptions] = useState<ChoiceOption[]>(
    editingQuestion?.choiceOptions.length ? editingQuestion.choiceOptions : createDefaultChoiceOptions(),
  );

  function ensureSingleCorrectOption(nextOptions: ChoiceOption[]) {
    const firstCorrectOptionId = nextOptions.find((option) => option.isCorrect)?.id ?? nextOptions[0]?.id ?? "";
    return nextOptions.map((option) => ({
      ...option,
      isCorrect: option.id === firstCorrectOptionId,
    }));
  }

  function updateQuestionType(nextQuestionType: QuestionType) {
    setQuestionType(nextQuestionType);

    if (nextQuestionType === "multiple_choice" && choiceOptions.length < 2) {
      setChoiceOptions(createDefaultChoiceOptions());
    }
  }

  function updateChoiceMode(nextChoiceMode: ChoiceMode) {
    setChoiceMode(nextChoiceMode);

    if (nextChoiceMode === "single") {
      setChoiceOptions((current) => ensureSingleCorrectOption(current));
    }
  }

  function updateChoiceOption(optionId: string, patch: Partial<ChoiceOption>) {
    setChoiceOptions((current) =>
      current.map((option) => (option.id === optionId ? { ...option, ...patch } : option)),
    );
  }

  function toggleCorrect(optionId: string, nextChecked: boolean) {
    setChoiceOptions((current) => {
      if (choiceMode === "single") {
        return current.map((option) => ({
          ...option,
          isCorrect: option.id === optionId,
        }));
      }

      const updated = current.map((option) =>
        option.id === optionId ? { ...option, isCorrect: nextChecked } : option,
      );

      if (updated.some((option) => option.isCorrect)) {
        return updated;
      }

      return updated.map((option, index) => ({
        ...option,
        isCorrect: index === 0,
      }));
    });
  }

  function addChoiceOption() {
    setChoiceOptions((current) => [
      ...current,
      createChoiceOption(`option-${current.length + 1}-${Date.now()}`),
    ]);
  }

  function removeChoiceOption(optionId: string) {
    setChoiceOptions((current) => {
      if (current.length <= 2) {
        return current;
      }

      const updated = current.filter((option) => option.id !== optionId);
      if (choiceMode === "single") {
        return ensureSingleCorrectOption(updated);
      }

      if (updated.some((option) => option.isCorrect)) {
        return updated;
      }

      return updated.map((option, index) => ({
        ...option,
        isCorrect: index === 0,
      }));
    });
  }

  return (
    <form action={saveQuestionAction} key={editingQuestion?.id ?? `new-question-${selectedUnit}`}>
      <input name="id" type="hidden" defaultValue={editingQuestion?.id} />
      <input name="unitFilter" type="hidden" value={selectedUnit} />
      <input name="bonusFilter" type="hidden" value={bonusFilter} />
      <input name="subjectFilter" type="hidden" value={selectedSubjectId} />
      <input name="stageFilter" type="hidden" value={selectedStageId} />
      <input name="choiceMode" type="hidden" value={questionType === "multiple_choice" ? choiceMode : ""} />
      <input
        name="choiceData"
        type="hidden"
        value={questionType === "multiple_choice" ? JSON.stringify(choiceOptions) : ""}
      />

      <label>
        נוסח השאלה
        <textarea name="text" required defaultValue={editingQuestion?.text} />
      </label>

      <div className="split">
        <label>
          סוג שאלה
          <select
            name="questionType"
            onChange={(event) => updateQuestionType(event.target.value as QuestionType)}
            value={questionType}
          >
            <option value="open">פתוחה</option>
            <option value="multiple_choice">רב ברירה</option>
          </select>
        </label>
        <label>
          יחידה
          <select name="unit" defaultValue={editingQuestion?.unit ?? selectedUnit}>
            <option value="vfr">{QUESTION_UNIT_LABELS.vfr}</option>
            <option value="ifr">{QUESTION_UNIT_LABELS.ifr}</option>
          </select>
        </label>
        <label>
          מקור
          <input name="source" defaultValue={editingQuestion?.source ?? "הוזן ידנית"} required />
        </label>
      </div>

      {questionType === "open" ? (
        <label>
          תשובה נכונה / צפויה
          <textarea name="answer" defaultValue={editingQuestion?.answer} />
        </label>
      ) : (
        <div className="question-block mcq-editor">
          <div className="recipient-list-header">
            <div>
              <strong>אפשרויות רב ברירה</strong>
              <p className="muted">
                לכל תשובה יש שדה נפרד. בחר אם זו שאלה עם תשובה אחת או כמה תשובות נכונות, וסמן את הנכונות בירוק.
              </p>
            </div>
            <button className="button button-secondary" onClick={addChoiceOption} type="button">
              הוספת אפשרות
            </button>
          </div>

          <label>
            מספר תשובות נכונות
            <select onChange={(event) => updateChoiceMode(event.target.value as ChoiceMode)} value={choiceMode}>
              <option value="single">תשובה אחת נכונה</option>
              <option value="multiple">כמה תשובות נכונות</option>
            </select>
          </label>

          <div className="stack">
            {choiceOptions.map((option, index) => (
              <div
                className={["mcq-editor-row", option.isCorrect ? "is-correct" : ""].filter(Boolean).join(" ")}
                key={option.id}
              >
                <label className="mcq-editor-marker">
                  <input
                    checked={option.isCorrect}
                    onChange={(event) => toggleCorrect(option.id, event.target.checked)}
                    type={choiceMode === "single" ? "radio" : "checkbox"}
                    name="correctOptionPreview"
                  />
                  <span>{getChoiceOptionLabel(index)}</span>
                </label>
                <input
                  onChange={(event) => updateChoiceOption(option.id, { text: event.target.value })}
                  placeholder={`אפשרות ${getChoiceOptionLabel(index)}`}
                  type="text"
                  value={option.text}
                />
                <button
                  className="button button-danger"
                  disabled={choiceOptions.length <= 2}
                  onClick={() => removeChoiceOption(option.id)}
                  type="button"
                >
                  הסרה
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <label>
        סימוכין
        <input name="sourceReference" defaultValue={editingQuestion?.sourceReference ?? nextSourceReference} />
      </label>
      <p className="muted">מספר שאלה יכול לחזור בין יחידות שונות, אבל לא פעמיים בתוך אותה יחידה.</p>
      <label className="checkbox-card">
        <input type="checkbox" name="isBonusSource" defaultChecked={editingQuestion?.isBonusSource} />
        לסמן כשאלת בונוס
      </label>
      <p className="muted">
        שאלות שיסומנו כאן ייכנסו למאגר שאלות הבונוס, ויוכלו להישלף אקראית למבחנים מתוך VFR או IFR.
      </p>
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
      <SubmitButton pendingLabel="שומר שאלה...">שמירת שאלה</SubmitButton>
    </form>
  );
}
