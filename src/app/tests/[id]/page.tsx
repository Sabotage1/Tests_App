import Link from "next/link";
import { notFound } from "next/navigation";

import { createShareLinkAction, sendGradeEmailAction, updateTestDurationAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { getDefaultTestDurationMinutes, getTestById } from "@/lib/repository";

type TestPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ durationSaved?: string; mail?: string; mailError?: string }>;
};

export default async function TestDetailsPage({ params, searchParams }: TestPageProps) {
  await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const [test, defaultDurationMinutes] = await Promise.all([getTestById(id), getDefaultTestDurationMinutes()]);

  if (!test) {
    notFound();
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>{test.title}</h2>
          <p>
            סטטוס: {test.status} | יוצר: {test.creatorName} | שאלות: {test.questionCount}
          </p>
        </div>
        <div className="button-row">
          <form action={createShareLinkAction}>
            <input type="hidden" name="id" value={test.id} />
            <button className="button button-primary" type="submit">
              יצירת / רענון קישור מבחן
            </button>
          </form>
          {test.shareUrl ? <CopyLinkButton path={test.shareUrl} /> : null}
          <Link className="button button-secondary" href={`/print/tests/${test.id}`} target="_blank">
            ייצוא ל־PDF
          </Link>
          <Link className="button button-secondary" href={`/tests/${test.id}/grade`}>
            בדיקה וציונים
          </Link>
        </div>
      </div>

      {query.mail === "sent" ? <div className="alert">המייל נשלח בהצלחה.</div> : null}
      {query.mailError ? <div className="alert">{query.mailError}</div> : null}
      {query.durationSaved ? <div className="alert">משך המבחן עודכן.</div> : null}

      <div className="grid grid-2">
        <div className="card">
          <h3>פרטי מבחן</h3>
          <p>שיטת בחירה: {test.selectionMode}</p>
          <p>משך: {test.durationMinutes === 0 ? "ללא הגבלת זמן" : `${test.durationMinutes} דקות`}</p>
          <p>נוצר: {new Date(test.createdAt).toLocaleString("he-IL")}</p>
          <p>נשלח: {test.sentAt ? new Date(test.sentAt).toLocaleString("he-IL") : "-"}</p>
          <p>הוגש: {test.submittedAt ? new Date(test.submittedAt).toLocaleString("he-IL") : "-"}</p>
          <p>נבדק: {test.gradedAt ? new Date(test.gradedAt).toLocaleString("he-IL") : "-"}</p>
          <p>תלמיד: {test.studentName || "-"}</p>
          <p>מייל: {test.studentEmail || "-"}</p>
          <p>ציון: {test.grade ?? "-"}</p>
          <form action={updateTestDurationAction}>
            <input type="hidden" name="testId" value={test.id} />
            <input type="hidden" name="shareToken" value={test.shareToken ?? ""} />
            <label>
              שינוי זמן למבחן הזה
              <input
                name="durationMinutes"
                type="number"
                min="0"
                placeholder={`ברירת מחדל מערכתית: ${defaultDurationMinutes}`}
              />
            </label>
            <p className="muted">אם השדה ריק, יוחל שוב זמן ברירת המחדל. אם יוזן 0, לא תהיה מגבלת זמן.</p>
            <button className="button button-secondary" type="submit">
              עדכון משך מבחן
            </button>
          </form>
          {test.shareUrl ? (
            <div className="hero-banner">
              <strong>קישור ייחודי לתלמיד</strong>
              <p>{test.shareUrl}</p>
            </div>
          ) : null}
          {test.status === "graded" && test.studentEmail ? (
            <form action={sendGradeEmailAction}>
              <input type="hidden" name="testId" value={test.id} />
              <button className="button button-success" type="submit">
                שליחת ציון והערות במייל
              </button>
            </form>
          ) : null}
        </div>

        <div className="card">
          <h3>שאלות במבחן</h3>
          <div className="stack">
            {test.questions.map((question) => (
              <div className="question-block" key={question.id}>
                <strong>שאלה {question.orderIndex}</strong>
                <p style={{ whiteSpace: "pre-wrap" }}>{question.prompt}</p>
                <div className="pill-row">
                  {question.subjectNames.map((subject) => (
                    <span className="pill" key={subject}>
                      {subject}
                    </span>
                  ))}
                </div>
                <div className="pill-row">
                  {question.stageNames.map((stage) => (
                    <span className="pill" key={stage}>
                      {stage}
                    </span>
                  ))}
                </div>
                <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
                  תשובה צפויה: {question.expectedAnswer}
                </p>
                {question.studentAnswer ? (
                  <p style={{ whiteSpace: "pre-wrap" }}>תשובת תלמיד: {question.studentAnswer}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
