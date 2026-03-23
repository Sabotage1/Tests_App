import { notFound } from "next/navigation";

import { startSharedTestAction, submitSharedTestAction } from "@/app/actions";
import { CountdownTimer } from "@/components/CountdownTimer";
import { SubmitButton } from "@/components/SubmitButton";
import { getSharedTestByToken } from "@/lib/repository";

type SharePageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
};

export default async function SharePage({ params, searchParams }: SharePageProps) {
  const { token } = await params;
  const query = await searchParams;
  const test = await getSharedTestByToken(token);

  if (!test) {
    notFound();
  }

  if (query.submitted || test.status === "completed" || test.status === "graded") {
    return (
      <div className="login-wrap">
        <div className="card login-card">
          <h2>המבחן הוגש</h2>
          <p>התשובות נשמרו במערכת והועברו לבדיקה.</p>
          {query.error ? <div className="alert">{query.error}</div> : null}
          <p className="muted">
            {test.submittedAt
              ? `מועד הגשה: ${new Date(test.submittedAt).toLocaleString("he-IL")}`
              : null}
          </p>
        </div>
      </div>
    );
  }

  if (!test.startedAt) {
    return (
      <div className="login-wrap">
        <div className="card login-card">
          <h2>{test.title}</h2>
          {query.error ? <div className="alert">{query.error}</div> : null}
          <p className="muted">
            {test.sentAt ? `תאריך ושעת שליחה: ${new Date(test.sentAt).toLocaleString("he-IL")}` : null}
          </p>
          <p>
            {test.durationMinutes === 0
              ? "למבחן זה אין מגבלת זמן."
              : `משך המבחן הוא ${test.durationMinutes} דקות. הלחיצה על התחלה תפעיל את הטיימר.`}
          </p>
          <form action={startSharedTestAction}>
            <input type="hidden" name="token" value={token} />
            <label>
              שם מלא
              <input name="studentName" defaultValue={test.studentName ?? ""} required />
            </label>
            <label>
              אימייל
              <input name="studentEmail" type="email" defaultValue={test.studentEmail ?? ""} required />
            </label>
            <SubmitButton pendingLabel="פותח את המבחן...">
              התחלת מבחן
            </SubmitButton>
          </form>
        </div>
      </div>
    );
  }

  const deadline =
    test.durationMinutes === 0
      ? null
      : new Date(new Date(test.startedAt).getTime() + test.durationMinutes * 60 * 1000).toISOString();

  return (
    <div className="content" style={{ maxWidth: 960, margin: "0 auto" }}>
      {query.error ? <div className="alert">{query.error}</div> : null}
      <div className="page-header">
        <div>
          <h2>{test.title}</h2>
          <p className="muted">
            {test.sentAt ? `תאריך ושעת שליחה: ${new Date(test.sentAt).toLocaleString("he-IL")} | ` : ""}
            {`תחילת מענה: ${new Date(test.startedAt).toLocaleString("he-IL")}`}
          </p>
          <p>
            {deadline
              ? "יש להשיב על כל השאלות ולהגיש עד סיום הטיימר."
              : "זהו מבחן ללא מגבלת זמן. ניתן להגיש כשתסיים."}
          </p>
        </div>
        {deadline ? <CountdownTimer deadlineIso={deadline} formId="student-test-form" /> : null}
      </div>
      <form action={submitSharedTestAction} id="student-test-form">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="studentName" value={test.studentName ?? ""} />
        <input type="hidden" name="studentEmail" value={test.studentEmail ?? ""} />
        <div className="stack">
          {test.questions.map((question) => (
            <div className="card" key={question.id}>
              <input type="hidden" name="questionIds" value={question.id} />
              <strong>{question.isBonus ? "שאלת בונוס" : "שאלה"} {question.orderIndex}</strong>
              {question.isBonus ? <p className="muted">שאלה זו היא שאלת בונוס ממאגר יחידת המכ"ם.</p> : null}
              <p style={{ whiteSpace: "pre-wrap" }}>{question.prompt}</p>
              <label>
                תשובתך
                <textarea name={`answer:${question.id}`} defaultValue={question.studentAnswer ?? ""} />
              </label>
            </div>
          ))}
        </div>
        <SubmitButton pendingLabel="שולח את המבחן...">
          שליחת מבחן לבדיקה
        </SubmitButton>
      </form>
    </div>
  );
}
