import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { PrintButton } from "@/components/PrintButton";
import { getTestById } from "@/lib/repository";

type PrintPageProps = {
  params: Promise<{ id: string }>;
};

function getPerformedAtLabel(startedAt: string | null, submittedAt: string | null, sentAt: string | null) {
  const performedAt = startedAt || submittedAt || sentAt;
  return performedAt ? new Date(performedAt).toLocaleString("he-IL") : "-";
}

export default async function PrintTestPage({ params }: PrintPageProps) {
  await requireUser();
  const { id } = await params;
  const test = await getTestById(id);

  if (!test) {
    notFound();
  }

  const isGraded = test.status === "graded";
  const durationLabel = test.durationMinutes === 0 ? "ללא הגבלת זמן" : `${test.durationMinutes} דקות`;
  const performedAtLabel = getPerformedAtLabel(test.startedAt, test.submittedAt, test.sentAt);
  const bonusQuestionCount = test.questions.filter((question) => question.isBonus).length;
  const regularQuestionCount = test.questions.length - bonusQuestionCount;

  return (
    <div className="print-shell">
      <div className="no-print" style={{ marginBottom: 20 }}>
        <PrintButton />
      </div>
      <h1>{test.title}</h1>
      <p>משך: {durationLabel}</p>
      <p>
        שאלות: {regularQuestionCount}
        {bonusQuestionCount > 0 ? ` + ${bonusQuestionCount} בונוס` : ""}
      </p>
      <p>נבחן: {test.studentName || "-"}</p>
      <p>תאריך ביצוע הבחינה: {performedAtLabel}</p>
      {isGraded ? (
        <>
          <p>מועד התחלה: {test.startedAt ? new Date(test.startedAt).toLocaleString("he-IL") : "-"}</p>
          <p>מועד הגשה: {test.submittedAt ? new Date(test.submittedAt).toLocaleString("he-IL") : "-"}</p>
          <p>ציון סופי: {test.grade ?? "-"}</p>
        </>
      ) : null}
      <div className="stack">
        {test.questions.map((question) => (
          <div key={question.id} style={{ marginBottom: 28 }}>
            <h3>{question.isBonus ? "שאלת בונוס" : "שאלה"} {question.orderIndex}</h3>
            {question.isBonus ? <p>שאלה זו נוספה ממאגר יחידת המכ"ם כשאלת בונוס.</p> : null}
            <p style={{ whiteSpace: "pre-wrap" }}>{question.prompt}</p>
            {isGraded ? (
              <>
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    background: "#f4f8fc",
                    border: "1px solid #d6e0ea",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  <strong>תשובת תלמיד</strong>
                  <div>{question.studentAnswer || "-"}</div>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    background: "#e8f8ee",
                    border: "1px solid #9fd5b1",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  <strong>תשובה צפויה</strong>
                  <div>{question.expectedAnswer}</div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <strong>ציון לשאלה:</strong> {question.score ?? 0}
                </div>
                <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                  <strong>הערת בודק:</strong> {question.feedback || "-"}
                </div>
              </>
            ) : (
              <>
                <div style={{ borderBottom: "1px solid #cfd6df", height: 60, marginTop: 12 }} />
                <div style={{ borderBottom: "1px solid #cfd6df", height: 60, marginTop: 12 }} />
              </>
            )}
          </div>
        ))}
      </div>
      {isGraded ? (
        <div style={{ marginTop: 48 }}>
          <p>
            <strong>אחראי הדרכה:</strong> ______________________
          </p>
          <p>
            <strong>שם הבודק:</strong> {test.gradedByName || "______________________"}
          </p>
          <p>
            <strong>חתימה:</strong> ______________________
          </p>
        </div>
      ) : null}
    </div>
  );
}
