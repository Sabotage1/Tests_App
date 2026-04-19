"use client";

import { useState } from "react";

import { resendArchivedTestAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import type { QuestionUnit } from "@/lib/constants";

type RecipientDraft = {
  email: string;
  name: string;
};

type RecipientMode = "single" | "list";

type TestLibraryResendFormProps = {
  sourceTestId: string;
  unit: QuestionUnit;
};

export function TestLibraryResendForm({ sourceTestId, unit }: TestLibraryResendFormProps) {
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("single");
  const [singleStudentName, setSingleStudentName] = useState("");
  const [singleStudentEmail, setSingleStudentEmail] = useState("");
  const [sentAt, setSentAt] = useState("");
  const [recipients, setRecipients] = useState<RecipientDraft[]>([{ name: "", email: "" }]);
  const isListMode = recipientMode === "list";
  const filledRecipientCount = recipients.filter((recipient) => recipient.name.trim() || recipient.email.trim()).length;

  function updateRecipient(index: number, key: keyof RecipientDraft, value: string) {
    setRecipients((current) =>
      current.map((recipient, currentIndex) => (currentIndex === index ? { ...recipient, [key]: value } : recipient)),
    );
  }

  function addRecipient() {
    setRecipients((current) => [...current, { name: "", email: "" }]);
  }

  function removeRecipient(index: number) {
    setRecipients((current) => {
      if (current.length === 1) {
        return [{ name: "", email: "" }];
      }

      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  return (
    <form action={resendArchivedTestAction}>
      <input type="hidden" name="sourceTestId" value={sourceTestId} />
      <input type="hidden" name="unit" value={unit} />
      <input type="hidden" name="recipientMode" value={recipientMode} />

      <div className="grid grid-2 recipient-delivery-grid">
        <div className="stack">
          <label>
            אופן שליחה
            <select onChange={(event) => setRecipientMode(event.target.value as RecipientMode)} value={recipientMode}>
              <option value="single">נבחן יחיד</option>
              <option value="list">רשימת נבחנים</option>
            </select>
          </label>

          {isListMode ? null : (
            <>
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
            </>
          )}

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

        {isListMode ? (
          <div className="question-block recipient-list-panel">
            <input type="hidden" name="recipientData" value={JSON.stringify(recipients)} />
            <div className="recipient-list-header">
              <div>
                <strong>רשימת נבחנים</strong>
                <p className="muted">
                  {filledRecipientCount > 0
                    ? `${filledRecipientCount} נבחנים הוזנו כרגע.`
                    : "הוסף שמות ומיילים, ולחץ שליחה כדי ליצור ולשלוח מבחן נפרד לכל תלמיד."}
                </p>
              </div>
              <button className="button button-secondary" onClick={addRecipient} type="button">
                הוספת תלמיד
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

      <SubmitButton pendingLabel={isListMode ? "יוצר ושולח מבחנים..." : "יוצר עותק חדש..."}>
        {isListMode ? `שליחה לרשימה (${filledRecipientCount || 0})` : "שליחה מחדש"}
      </SubmitButton>
    </form>
  );
}
