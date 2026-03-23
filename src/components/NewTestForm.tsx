"use client";

import { useState } from "react";

import { prepareTestDraftAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { QUESTION_UNIT_LABELS, type QuestionUnit } from "@/lib/constants";
import type { Option, QuestionRow } from "@/lib/types";

type NewTestFormProps = {
  activeQuestions: QuestionRow[];
  defaultDurationMinutes: number;
  selectedUnit: QuestionUnit;
  stages: Option[];
  subjects: Option[];
};

type SelectionMode = "random" | "filtered" | "manual";

export function NewTestForm({
  activeQuestions,
  defaultDurationMinutes,
  selectedUnit,
  stages,
  subjects,
}: NewTestFormProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("random");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const isManualSelection = selectionMode === "manual";

  return (
    <form action={prepareTestDraftAction}>
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
          <select
            name="selectionMode"
            onChange={(event) => setSelectionMode(event.target.value as SelectionMode)}
            value={selectionMode}
          >
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
        {isManualSelection ? (
          <p className="muted">בבחירה ידנית, המבחן יורכב בדיוק מהשאלות שיסומנו כאן למטה, וכמות השאלות תיקבע לפי מספר הסימונים.</p>
        ) : (
          <p className="muted">במבחן אקראי או מסונן תיפתח קודם תצוגה מקדימה, שבה אפשר לעבור על השאלות ולהחליף אותן לפני שמירת המבחן.</p>
        )}
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

      {isManualSelection ? (
        <div className="stack">
          <strong>בחירה ידנית של שאלות מהמאגָר עבור {QUESTION_UNIT_LABELS[selectedUnit]}</strong>
          <div className="question-picker-list">
            {activeQuestions.map((question) => {
              const isChecked = selectedQuestionIds.includes(question.id);

              return (
                <label className="question-picker-card" key={question.id}>
                  <input
                    checked={isChecked}
                    name="questionIds"
                    onChange={(event) => {
                      setSelectedQuestionIds((current) => {
                        if (event.target.checked) {
                          return [...current, question.id];
                        }

                        return current.filter((id) => id !== question.id);
                      });
                    }}
                    type="checkbox"
                    value={question.id}
                  />
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
              );
            })}
          </div>
          {activeQuestions.length === 0 ? <div className="muted">עדיין אין שאלות פעילות משויכות ליחידה הזאת.</div> : null}
        </div>
      ) : null}

      <p className="muted">
        אם לא יוזן זמן, יילקח ערך ברירת המחדל מהמערכת. אם יוזן 0, למבחן לא תהיה מגבלת זמן.
      </p>

      <SubmitButton pendingLabel="מכין טיוטת מבחן...">
        {isManualSelection ? "יצירת מבחן" : "המשך לבחירת שאלות"}
      </SubmitButton>
    </form>
  );
}
