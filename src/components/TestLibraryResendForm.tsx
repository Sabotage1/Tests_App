"use client";

import { useState } from "react";

import { resendArchivedTestAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import type { QuestionUnit } from "@/lib/constants";
import type { RecipientList } from "@/lib/types";

type RecipientDraft = {
  email: string;
  name: string;
};

type RecipientMode = "single" | "saved_list" | "manual_list";

type TestLibraryResendFormProps = {
  recipientLists: RecipientList[];
  sourceTestId: string;
  unit: QuestionUnit;
};

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

export function TestLibraryResendForm({ recipientLists, sourceTestId, unit }: TestLibraryResendFormProps) {
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("single");
  const [recipientListId, setRecipientListId] = useState(recipientLists[0]?.id || "");
  const [singleStudentName, setSingleStudentName] = useState("");
  const [singleStudentEmail, setSingleStudentEmail] = useState("");
  const [sentAt, setSentAt] = useState("");
  const [recipients, setRecipients] = useState<RecipientDraft[]>([createEmptyRecipient()]);
  const isSingleMode = recipientMode === "single";
  const isSavedListMode = recipientMode === "saved_list";
  const selectedRecipientList = recipientLists.find((recipientList) => recipientList.id === recipientListId) ?? null;
  const filledRecipientCount = recipients.filter((recipient) => recipient.name.trim() || recipient.email.trim()).length;
  const bulkRecipientCount = isSavedListMode ? selectedRecipientList?.recipients.length ?? 0 : filledRecipientCount;

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

  return (
    <form action={resendArchivedTestAction}>
      <input type="hidden" name="sourceTestId" value={sourceTestId} />
      <input type="hidden" name="unit" value={unit} />
      <input type="hidden" name="recipientMode" value={recipientMode} />
      <input type="hidden" name="recipientListId" value={recipientListId} />
      <input type="hidden" name="recipientData" value={recipientMode === "manual_list" ? JSON.stringify(recipients) : ""} />

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
              onChange={(event) => setSentAt(event.target.value)}
              type="datetime-local"
              value={sentAt}
            />
          </label>
        </div>

        {isSingleMode ? (
          <div className="grid grid-2 recipient-delivery-grid">
            <label>
              שם נבחן חדש
              <input
                name="studentName"
                onChange={(event) => setSingleStudentName(event.target.value)}
                required
                value={singleStudentName}
              />
            </label>
            <label>
              מייל תלמיד חדש
              <input
                name="studentEmail"
                onChange={(event) => setSingleStudentEmail(event.target.value)}
                placeholder="אם יוזן, המבחן יישלח אוטומטית"
                type="email"
                value={singleStudentEmail}
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
                    ? `${selectedRecipientList.recipients.length} נבחנים יקבלו עותק חדש עם קישור ייחודי.`
                    : "בחר רשימה שמורה או צור אחת חדשה ממסך רשימות הנבחנים."}
                </p>
              </div>
              <a className="button button-secondary" href={`/recipient-lists?unit=${unit}`}>
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
              <div className="muted">אפשר להכין רשימות מראש במסך הייעודי ואז לחזור לכאן לשליחה מהירה.</div>
            )}
          </div>
        ) : null}

        {recipientMode === "manual_list" ? (
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
                <div className="recipient-list-row" key={`library-recipient-${index}`}>
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

      <SubmitButton pendingLabel={isSingleMode ? "יוצר עותק חדש..." : "יוצר ושולח מבחנים..."}>
        {isSingleMode ? "שליחה מחדש" : `שליחה ל-${bulkRecipientCount} נבחנים`}
      </SubmitButton>
    </form>
  );
}
