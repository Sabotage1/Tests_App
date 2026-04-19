import type { Route } from "next";
import Link from "next/link";

import { RecipientListManager } from "@/components/RecipientListManager";
import { getSelectedUnitForUser, getUnitOrderForUser, requireEditor } from "@/lib/auth";
import { QUESTION_UNIT_LABELS, type QuestionUnit } from "@/lib/constants";
import { getRecipientLists } from "@/lib/repository";

type RecipientListsPageProps = {
  searchParams: Promise<{
    recipientListDeleted?: string;
    recipientListError?: string;
    recipientListSaved?: string;
    unit?: string;
  }>;
};

export default async function RecipientListsPage({ searchParams }: RecipientListsPageProps) {
  const user = await requireEditor();
  const params = await searchParams;
  const selectedUnit: QuestionUnit = getSelectedUnitForUser(user, params.unit);
  const unitOrder = getUnitOrderForUser(user);
  const recipientLists = await getRecipientLists(selectedUnit);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>רשימות נבחנים</h2>
          <p>אדמין ואחראית הדרכה יכולים ליצור כאן רשימות שמורות, לערוך אותן, ואז לבחור אותן בזמן יצירת מבחן חדש או שליחה ממאגר המבחנים.</p>
        </div>
      </div>

      <div className="button-row">
        {unitOrder.map((unit) => (
          <Link
            key={unit}
            className={selectedUnit === unit ? "button unit-toggle-active" : "button unit-toggle-idle"}
            href={`/recipient-lists?unit=${unit}` as Route}
          >
            {QUESTION_UNIT_LABELS[unit]}
          </Link>
        ))}
      </div>

      {params.recipientListSaved ? <div className="alert">רשימת הנבחנים נשמרה.</div> : null}
      {params.recipientListDeleted ? <div className="alert">רשימת הנבחנים נמחקה.</div> : null}
      {params.recipientListError ? <div className="alert">{params.recipientListError}</div> : null}

      <div className="card">
        <RecipientListManager recipientLists={recipientLists} selectedUnit={selectedUnit} />
      </div>
    </div>
  );
}
