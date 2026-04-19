"use client";

import { useState } from "react";

import { deleteRecipientListAction, saveRecipientListAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { type QuestionUnit } from "@/lib/constants";
import type { RecipientList } from "@/lib/types";

type RecipientDraft = {
  email: string;
  name: string;
};

type RecipientListManagerProps = {
  recipientLists: RecipientList[];
  selectedUnit: QuestionUnit;
};

function createEmptyRecipient(): RecipientDraft {
  return { name: "", email: "" };
}

function toDraftRecipients(recipientList?: RecipientList) {
  if (!recipientList || recipientList.recipients.length === 0) {
    return [createEmptyRecipient()];
  }

  return recipientList.recipients.map((recipient) => ({
    name: recipient.name,
    email: recipient.email,
  }));
}

function RecipientListEditor({
  recipientList,
  selectedUnit,
}: {
  recipientList?: RecipientList;
  selectedUnit: QuestionUnit;
}) {
  const [name, setName] = useState(recipientList?.name ?? "");
  const [recipients, setRecipients] = useState<RecipientDraft[]>(toDraftRecipients(recipientList));
  const filledRecipientCount = recipients.filter((recipient) => recipient.name.trim() || recipient.email.trim()).length;

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
    <form action={saveRecipientListAction} className="question-block recipient-list-editor">
      {recipientList ? <input type="hidden" name="id" value={recipientList.id} /> : null}
      <input type="hidden" name="recipientListUnit" value={selectedUnit} />
      <input type="hidden" name="recipientData" value={JSON.stringify(recipients)} />

      <div className="recipient-list-editor-header">
        <div>
          <strong>{recipientList ? "עריכת רשימת שליחה" : "רשימת שליחה חדשה"}</strong>
          <p className="muted">
            {filledRecipientCount > 0 ? `${filledRecipientCount} נבחנים מוכנים כרגע.` : "הוסף שמות ומיילים כדי לשמור רשימה זמינה לשליחה."}
          </p>
        </div>
        <button className="button button-secondary" onClick={addRecipient} type="button">
          הוספת נבחן
        </button>
      </div>

      <label>
        שם הרשימה
        <input name="name" onChange={(event) => setName(event.target.value)} placeholder="למשל: קורס אפריל" required value={name} />
      </label>

      {recipientList ? (
        <div className="muted">
          נוצרה על ידי {recipientList.createdByName} | עודכנה {new Date(recipientList.updatedAt).toLocaleString("he-IL")}
        </div>
      ) : null}

      <div className="stack">
        {recipients.map((recipient, index) => (
          <div className="recipient-list-row" key={`${recipientList?.id ?? "new"}-${index}`}>
            <input
              onChange={(event) => updateRecipient(index, "name", event.target.value)}
              placeholder="שם נבחן"
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

      <div className="button-row">
        <SubmitButton pendingLabel={recipientList ? "מעדכן רשימה..." : "שומר רשימה..."}>
          {recipientList ? "שמירת שינויים" : "שמירת רשימה"}
        </SubmitButton>
        {recipientList ? (
          <SubmitButton
            className="button button-danger"
            confirmMessage="למחוק את רשימת השליחה הזאת? הפעולה לא ניתנת לביטול."
            formAction={deleteRecipientListAction}
            pendingLabel="מוחק רשימה..."
          >
            מחיקת רשימה
          </SubmitButton>
        ) : null}
      </div>
    </form>
  );
}

export function RecipientListManager({ recipientLists, selectedUnit }: RecipientListManagerProps) {
  return (
    <div className="stack">
      <RecipientListEditor selectedUnit={selectedUnit} />
      {recipientLists.map((recipientList) => (
        <RecipientListEditor key={recipientList.id} recipientList={recipientList} selectedUnit={selectedUnit} />
      ))}
      {recipientLists.length === 0 ? <div className="muted">עדיין לא נשמרו רשימות שליחה ליחידה הזאת.</div> : null}
    </div>
  );
}
