"use client";

import { useEffect, useState } from "react";

import { prepareTestDraftAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { QUESTION_UNIT_LABELS, type QuestionUnit } from "@/lib/constants";
import type { Option, QuestionRow } from "@/lib/types";

export type NewTestFormInitialValues = {
  title: string;
  questionCount: string;
  bonusQuestionCount: string;
  durationMinutes: string;
  selectionMode: SelectionMode;
  studentName: string;
  studentEmail: string;
  sentAt: string;
  subjectIds: string[];
  stageIds: string[];
  questionIds: string[];
};

type NewTestFormProps = {
  activeQuestions: QuestionRow[];
  bonusQuestionPoints: number;
  defaultDurationMinutes: number;
  initialValues: NewTestFormInitialValues;
  selectedUnit: QuestionUnit;
  stages: Option[];
  subjects: Option[];
};

type SelectionMode = "random" | "filtered" | "manual";

function getBrowserLocalDateTimeValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function NewTestForm({
  activeQuestions,
  bonusQuestionPoints,
  defaultDurationMinutes,
  initialValues,
  selectedUnit,
  stages,
  subjects,
}: NewTestFormProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(initialValues.selectionMode);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(initialValues.questionIds);
  const [sentAtValue, setSentAtValue] = useState(initialValues.sentAt);
  const isManualSelection = selectionMode === "manual";

  useEffect(() => {
    if (initialValues.sentAt) {
      setSentAtValue(initialValues.sentAt);
      return;
    }

    setSentAtValue(getBrowserLocalDateTimeValue());
  }, [initialValues.sentAt]);

  return (
    <form action={prepareTestDraftAction}>
      <input type="hidden" name="unit" value={selectedUnit} />
      <div className="grid grid-2">
        <label>
          כותרת מבחן
          <input name="title" defaultValue={initialValues.title} required />
        </label>
        <label>
          יחידה
          <input value={QUESTION_UNIT_LABELS[selectedUnit]} disabled />
        </label>
        <label>
          כמות שאלות
          <input name="questionCount" type="number" min="1" defaultValue={initialValues.questionCount} required />
        </label>
        <label>
          כמות שאלות בונוס
          <input name="bonusQuestionCount" type="number" min="0" defaultValue={initialValues.bonusQuestionCount} />
        </label>
        <label>
          משך זמן בדקות
          <input
            name="durationMinutes"
            type="number"
            min="0"
            defaultValue={initialValues.durationMinutes}
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
          <input name="studentName" placeholder="אופציונלי" defaultValue={initialValues.studentName} />
        </label>
        <label>
          מייל תלמיד
          <input name="studentEmail" type="email" placeholder="אופציונלי" defaultValue={initialValues.studentEmail} />
        </label>
        <label>
          תאריך ושעת שליחה
          <input
            className="datetime-input-ltr"
            dir="ltr"
            lang="en-GB"
            name="sentAt"
            onChange={(event) => setSentAtValue(event.target.value)}
            type="datetime-local"
            value={sentAtValue}
          />
        </label>
      </div>

      <div className="stack">
        {isManualSelection ? (
          <p className="muted">בבחירה ידנית, המבחן יורכב בדיוק מהשאלות שיסומנו כאן למטה, וכמות השאלות תיקבע לפי מספר הסימונים.</p>
        ) : (
          <p className="muted">במבחן אקראי או מסונן תיפתח קודם תצוגה מקדימה, שבה אפשר לעבור על השאלות ולהחליף אותן לפני שמירת המבחן.</p>
        )}
        <p className="muted">
          שאלות הבונוס זמינות לכל מבחן, נשלפות אקראית משאלות שסומנו כשאלות בונוס במאגרי {QUESTION_UNIT_LABELS.vfr} או {QUESTION_UNIT_LABELS.ifr}, וכל אחת שווה כרגע {bonusQuestionPoints} נקודות מעל 100.
        </p>
      </div>

      <div className="stack">
        <strong>נושאים למבחן</strong>
        <div className="checkbox-grid">
          {subjects.map((subject) => (
            <label className="checkbox-card" key={subject.value}>
              <input
                type="checkbox"
                name="subjectIds"
                value={subject.value}
                defaultChecked={initialValues.subjectIds.includes(subject.value)}
              />
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
              <input
                type="checkbox"
                name="stageIds"
                value={stage.value}
                defaultChecked={initialValues.stageIds.includes(stage.value)}
              />
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
