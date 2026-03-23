import Link from "next/link";
import { notFound } from "next/navigation";

import { QUESTION_UNIT_LABELS } from "@/lib/constants";
import {
  createShareLinkAction,
  sendGradeEmailAction,
  sendTestInvitationEmailAction,
  updateTestDurationAction,
} from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { SubmitButton } from "@/components/SubmitButton";
import { getDefaultTestDurationMinutes, getTestById } from "@/lib/repository";

type TestPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    durationSaved?: string;
    mail?: string;
    mailError?: string;
    inviteMail?: string;
    inviteMailError?: string;
    reused?: string;
  }>;
};

const STATUS_LABELS = {
  generated: "מבחן שנוצר",
  sent: "מבחן שנשלח",
  completed: "מבחן שהוגש",
  graded: "מבחן שנבדק",
} as const;

const SELECTION_MODE_LABELS: Record<string, string> = {
  random: "בחירה אקראית מכל המאגר",
  filtered: "בחירה אקראית לפי סינון",
  manual: "בחירה ידנית מהמאגר",
  archived_copy: "עותק שנשלח מחדש מהמאגר",
};

function getSolvedMinutes(startedAt: string | null, submittedAt: string | null) {
  if (!startedAt || !submittedAt) {
    return null;
  }

  const difference = new Date(submittedAt).getTime() - new Date(startedAt).getTime();
  if (difference <= 0) {
    return 0;
  }

  return Math.ceil(difference / 60000);
}

function formatRoundedGrade(grade: number | null) {
  return grade === null ? "-" : Math.round(grade);
}

export default async function TestDetailsPage({ params, searchParams }: TestPageProps) {
  await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const [test, defaultDurationMinutes] = await Promise.all([getTestById(id), getDefaultTestDurationMinutes()]);
  const solvedMinutes = test ? getSolvedMinutes(test.startedAt, test.submittedAt) : null;

  if (!test) {
    notFound();
  }

  const bonusQuestionCount = test.questions.filter((question) => question.isBonus).length;
  const regularQuestionCount = test.questions.length - bonusQuestionCount;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>{test.title}</h2>
          <p>
            סטטוס: {STATUS_LABELS[test.status]} | יוצר: {test.creatorName} | שאלות: {regularQuestionCount}
            {bonusQuestionCount > 0 ? ` + ${bonusQuestionCount} בונוס` : ""}
          </p>
        </div>
        <div className="button-row">
          <form action={createShareLinkAction}>
            <input type="hidden" name="id" value={test.id} />
            <SubmitButton
              pendingLabel={test.shareUrl ? "מרענן קישור..." : "יוצר קישור..."}
            >
              {test.shareUrl ? "רענון קישור מבחן" : "יצירת קישור מבחן"}
            </SubmitButton>
          </form>
          {test.shareUrl ? <CopyLinkButton path={test.shareUrl} autoCopy={query.reused === "1"} /> : null}
          <form action={sendTestInvitationEmailAction}>
            <input type="hidden" name="testId" value={test.id} />
            <SubmitButton
              className="button button-success"
              pendingLabel="שולח מבחן במייל..."
              disabled={!test.studentEmail}
            >
              שלח במייל
            </SubmitButton>
          </form>
          <Link className="button button-secondary" href={`/print/tests/${test.id}`} target="_blank">
            ייצוא ל־PDF
          </Link>
          <Link className="button button-secondary" href={`/tests/${test.id}/grade`}>
            {test.status === "graded" ? "צפייה / עריכת בדיקה" : "בדיקה וציונים"}
          </Link>
        </div>
      </div>

      {query.mail === "sent" ? <div className="alert">המייל נשלח בהצלחה.</div> : null}
      {query.mailError ? <div className="alert">{query.mailError}</div> : null}
      {query.inviteMail === "sent" ? <div className="alert">קישור המבחן נשלח בהצלחה לחניך.</div> : null}
      {query.inviteMailError ? <div className="alert">{query.inviteMailError}</div> : null}
      {query.durationSaved ? <div className="alert">משך המבחן עודכן.</div> : null}
      {query.reused === "1" ? <div className="alert">נוצר מבחן חדש והקישור לתלמיד הועתק אוטומטית.</div> : null}

      <div className="grid grid-2">
        <div className="card">
          <h3>פרטי מבחן</h3>
          <p>יחידה: {QUESTION_UNIT_LABELS[test.unit]}</p>
          <p>שיטת בחירה: {SELECTION_MODE_LABELS[test.selectionMode] ?? "שיטת בחירה מותאמת"}</p>
          <p>משך: {test.durationMinutes === 0 ? "ללא הגבלת זמן" : `${test.durationMinutes} דקות`}</p>
          <p>נוצר: {new Date(test.createdAt).toLocaleString("he-IL")}</p>
          <p>נשלח: {test.sentAt ? new Date(test.sentAt).toLocaleString("he-IL") : "-"}</p>
          <p>התחיל: {test.startedAt ? new Date(test.startedAt).toLocaleString("he-IL") : "-"}</p>
          <p>הוגש: {test.submittedAt ? new Date(test.submittedAt).toLocaleString("he-IL") : "-"}</p>
          <p>משך פתרון בפועל: {solvedMinutes !== null ? `${solvedMinutes} דקות` : "-"}</p>
          <p>נבדק: {test.gradedAt ? new Date(test.gradedAt).toLocaleString("he-IL") : "-"}</p>
          <p>בודק: {test.gradedByName || "-"}</p>
          <p>תלמיד: {test.studentName || "-"}</p>
          <p>מייל: {test.studentEmail || "-"}</p>
          <p>ציון: {formatRoundedGrade(test.grade)}</p>
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
            <SubmitButton className="button button-secondary" pendingLabel="מעדכן משך...">
              עדכון משך מבחן
            </SubmitButton>
          </form>
          {test.shareUrl ? (
            <div className="hero-banner">
              <strong>קישור ייחודי לתלמיד</strong>
              <p>{test.shareUrl}</p>
            </div>
          ) : null}
          {!test.studentEmail ? (
            <p className="muted">כדי לשלוח את המבחן במייל, יש להזין כתובת מייל לחניך במבחן.</p>
          ) : null}
          {test.status === "graded" && test.studentEmail ? (
            <form action={sendGradeEmailAction}>
              <input type="hidden" name="testId" value={test.id} />
              <SubmitButton className="button button-success" pendingLabel="שולח מייל...">
                שליחת ציון והערות במייל
              </SubmitButton>
            </form>
          ) : null}
        </div>

        <div className="card">
          <h3>שאלות במבחן</h3>
          <div className="stack">
            {test.questions.map((question) => (
              <div className="question-block" key={question.id}>
                <strong>{question.isBonus ? "שאלת בונוס" : "שאלה"} {question.orderIndex}</strong>
                {question.isBonus ? <p className="muted">שאלה זו נוספה ממאגר יחידת המכ"ם כשאלת בונוס.</p> : null}
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
