"use client";

import { useEffect, useMemo, useState } from "react";

import { prepareTestDraftAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { QUESTION_UNIT_LABELS, type QuestionUnit } from "@/lib/constants";
import type { Option, QuestionRow, RecipientList } from "@/lib/types";

type RecipientDraft = {
  email: string;
  name: string;
};

type RecipientMode = "single" | "saved_list" | "manual_list";
type SelectionMode = "random" | "filtered" | "manual";

export type NewTestFormInitialValues = {
  title: string;
  questionCount: string;
  bonusQuestionCount: string;
  durationMinutes: string;
  recipientMode: RecipientMode;
  recipientListId: string;
  recipients: RecipientDraft[];
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
  recipientLists: RecipientList[];
  selectedUnit: QuestionUnit;
  stages: Option[];
  subjects: Option[];
};

function getBrowserLocalDateTimeValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function createEmptyRecipient(): RecipientDraft {
  return { name: "", email: "" };
}

function resizeRecipients(currentRecipients: RecipientDraft[], nextCount: number) {
  const safeCount = Math.max(1, Math.min(200, Number.isNaN(nextCount) ? 1 : nextCount));

  if (safeCount === currentRecipients.length) {
    return currentRecipients;
  }

  if (safeCount > currentRecipients.length) {
    return [...currentRecipients, ...Array.from({ length: safeCount - currentRecipients.length }, () => createEmptyRecipient())];
  }

  return currentRecipients.slice(0, safeCount);
}

function toggleSelectedValue(values: string[], value: string, checked: boolean) {
  if (checked) {
    return values.includes(value) ? values : [...values, value];
  }

  return values.filter((currentValue) => currentValue !== value);
}

export function NewTestForm({
  activeQuestions,
  bonusQuestionPoints,
  defaultDurationMinutes,
  initialValues,
  recipientLists,
  selectedUnit,
  stages,
  subjects,
}: NewTestFormProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(initialValues.selectionMode);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(initialValues.questionIds);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>(initialValues.subjectIds);
  const [selectedStageIds, setSelectedStageIds] = useState<string[]>(initialValues.stageIds);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>(initialValues.recipientMode);
  const [recipientListId, setRecipientListId] = useState(initialValues.recipientListId || recipientLists[0]?.id || "");
  const [recipients, setRecipients] = useState<RecipientDraft[]>(
    initialValues.recipients.length > 0 ? initialValues.recipients : [createEmptyRecipient()],
  );
  const [sentAtValue, setSentAtValue] = useState(initialValues.sentAt);
  const isManualSelection = selectionMode === "manual";
  const isSingleMode = recipientMode === "single";
  const isSavedListMode = recipientMode === "saved_list";
  const isManualListMode = recipientMode === "manual_list";
  const selectedRecipientList = recipientLists.find((recipientList) => recipientList.id === recipientListId) ?? null;
  const filledRecipientCount = recipients.filter((recipient) => recipient.name.trim() || recipient.email.trim()).length;
  const bulkRecipientCount = isSavedListMode ? selectedRecipientList?.recipients.length ?? 0 : filledRecipientCount;
  const manualPickerQuestions = useMemo(
    () =>
      activeQuestions.filter((question) => {
        const subjectMatch =
          selectedSubjectIds.length === 0 ||
          selectedSubjectIds.some((subjectId) => question.subjectIds.includes(subjectId));
        const stageMatch =
          selectedStageIds.length === 0 || selectedStageIds.some((stageId) => question.stageIds.includes(stageId));

        return subjectMatch && stageMatch;
      }),
    [activeQuestions, selectedStageIds, selectedSubjectIds],
  );
  const manualPickerQuestionIds = useMemo(
    () => new Set(manualPickerQuestions.map((question) => question.id)),
    [manualPickerQuestions],
  );

  function updateRecipient(index: number, key: keyof RecipientDraft, value: string) {
    setRecipients((current) =>
      current.map((recipient, currentIndex) => (currentIndex === index ? { ...recipient, [key]: value } : recipient)),
    );
  }

  function addRecipient() {
    setRecipients((current) => [...current, createEmptyRecipient()]);
  }

  function removeRecipient(index: number) {
    setRecipients((current) => {
      if (current.length === 1) {
        return [createEmptyRecipient()];
      }

      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  useEffect(() => {
    if (initialValues.sentAt) {
      setSentAtValue(initialValues.sentAt);
      return;
    }

    setSentAtValue(getBrowserLocalDateTimeValue());
  }, [initialValues.sentAt]);

  useEffect(() => {
    if (recipientMode !== "saved_list") {
      return;
    }

    if (!recipientLists.some((recipientList) => recipientList.id === recipientListId)) {
      setRecipientListId(recipientLists[0]?.id || "");
    }
  }, [recipientListId, recipientLists, recipientMode]);

  useEffect(() => {
    setSelectedQuestionIds((current) => current.filter((questionId) => manualPickerQuestionIds.has(questionId)));
  }, [manualPickerQuestionIds]);

  return (
    <form action={prepareTestDraftAction}>
      <input type="hidden" name="unit" value={selectedUnit} />
      <input type="hidden" name="recipientMode" value={recipientMode} />
      <input type="hidden" name="recipientListId" value={recipientListId} />
      <input type="hidden" name="recipientData" value={isManualListMode ? JSON.stringify(recipients) : ""} />

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
      </div>

      <div className="stack recipient-delivery-stack">
        <div className="grid grid-2 recipient-delivery-meta">
          <label>
            אופן שליחה
            <select onChange={(event) => setRecipientMode(event.target.value as RecipientMode)} value={recipientMode}>
              <option value="single">נבחן יחיד</option>
              <option value="saved_list">רשימת נבחנים</option>
              <option value="manual_list">מספר נבחנים</option>
            </select>
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

        {isSingleMode ? (
          <div className="grid grid-2 recipient-delivery-grid">
            <label>
              שם נבחן
              <input name="studentName" placeholder="אופציונלי" defaultValue={initialValues.studentName} />
            </label>
            <label>
              מייל תלמיד
              <input
                name="studentEmail"
                type="email"
                placeholder="אם יוזן, המבחן יישלח אוטומטית"
                defaultValue={initialValues.studentEmail}
              />
            </label>
          </div>
        ) : null}

        {isSavedListMode ? (
          <div className="question-block recipient-list-panel">
            <div className="recipient-list-header">
              <div>
                <strong>בחירת רשימת נבחנים שמורה</strong>
                <p className="muted">
                  {selectedRecipientList
                    ? `${selectedRecipientList.recipients.length} נבחנים ייכללו בשליחה הזאת.`
                    : "בחר רשימה קיימת, או צור רשימה חדשה ממסך רשימות הנבחנים."}
                </p>
              </div>
              <a className="button button-secondary" href={`/recipient-lists?unit=${selectedUnit}`}>
                ניהול רשימות
              </a>
            </div>

            <label>
              רשימת נבחנים
              <select onChange={(event) => setRecipientListId(event.target.value)} value={recipientListId}>
                <option value="">{recipientLists.length > 0 ? "בחר רשימה שמורה" : "אין עדיין רשימות שמורות"}</option>
                {recipientLists.map((recipientList) => (
                  <option key={recipientList.id} value={recipientList.id}>
                    {recipientList.name} ({recipientList.recipients.length})
                  </option>
                ))}
              </select>
            </label>

            {selectedRecipientList ? (
              <div className="recipient-list-preview">
                {selectedRecipientList.recipients.map((recipient) => (
                  <div className="recipient-list-preview-item" key={recipient.id}>
                    <strong>{recipient.name}</strong>
                    <span>{recipient.email}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted">אפשר להמשיך למסך רשימות הנבחנים, ליצור שם רשימה חדשה, ואז לחזור לבחור אותה כאן.</div>
            )}
          </div>
        ) : null}

        {isManualListMode ? (
          <div className="question-block recipient-list-panel">
            <div className="recipient-list-header">
              <div>
                <strong>שליחה למספר נבחנים</strong>
                <p className="muted">
                  {filledRecipientCount > 0
                    ? `${filledRecipientCount} נבחנים הוזנו כרגע.`
                    : "בחר כמה נבחנים צריך, ואז מלא שם ומייל לכל אחד."}
                </p>
              </div>
            </div>

            <div className="recipient-manual-toolbar">
              <label className="recipient-count-field">
                מספר נבחנים
                <input
                  min="1"
                  onChange={(event) =>
                    setRecipients((current) => resizeRecipients(current, Number(event.target.value || "1")))
                  }
                  type="number"
                  value={recipients.length}
                />
              </label>
              <button className="button button-secondary" onClick={addRecipient} type="button">
                הוספת נבחן
              </button>
            </div>

            <div className="stack">
              {recipients.map((recipient, index) => (
                <div className="recipient-list-row" key={`recipient-${index}`}>
                  <input
                    onChange={(event) => updateRecipient(index, "name", event.target.value)}
                    placeholder="שם תלמיד"
                    type="text"
                    value={recipient.name}
                  />
                  <input
                    onChange={(event) => updateRecipient(index, "email", event.target.value)}
                    placeholder="student@example.com"
                    type="email"
                    value={recipient.email}
                  />
                  <button className="button button-danger" onClick={() => removeRecipient(index)} type="button">
                    הסרה
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
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
                checked={selectedSubjectIds.includes(subject.value)}
                onChange={(event) =>
                  setSelectedSubjectIds((current) => toggleSelectedValue(current, subject.value, event.target.checked))
                }
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
                checked={selectedStageIds.includes(stage.value)}
                onChange={(event) =>
                  setSelectedStageIds((current) => toggleSelectedValue(current, stage.value, event.target.checked))
                }
              />
              {stage.label}
            </label>
          ))}
        </div>
      </div>

      {isManualSelection ? (
        <div className="stack">
          <div className="question-picker-header">
            <div>
              <strong>בחירה ידנית של שאלות מהמאגָר עבור {QUESTION_UNIT_LABELS[selectedUnit]}</strong>
              <p className="muted">
                מוצגות {manualPickerQuestions.length} שאלות לפי הנושאים והשלבים שנבחרו.
              </p>
            </div>
            <div className="question-picker-counter" aria-live="polite">
              נבחרו {selectedQuestionIds.length} שאלות
            </div>
          </div>
          <div className="question-picker-list">
            {manualPickerQuestions.map((question) => {
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
          {activeQuestions.length > 0 && manualPickerQuestions.length === 0 ? (
            <div className="muted">אין שאלות פעילות שתואמות את הסינון הנוכחי.</div>
          ) : null}
        </div>
      ) : null}

      <p className="muted">
        אם לא יוזן זמן, יילקח ערך ברירת המחדל מהמערכת. אם יוזן 0, למבחן לא תהיה מגבלת זמן.
      </p>

      <SubmitButton
        pendingLabel={isManualSelection ? (!isSingleMode ? "יוצר ושולח מבחנים..." : "יוצר מבחן...") : "מכין טיוטת מבחן..."}
      >
        {isManualSelection
          ? !isSingleMode
            ? `יצירה ושליחה ל-${bulkRecipientCount} נבחנים`
            : "יצירת מבחן"
          : "המשך לבחירת שאלות"}
      </SubmitButton>
    </form>
  );
}
