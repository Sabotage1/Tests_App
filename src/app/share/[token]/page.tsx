import { notFound } from "next/navigation";

import { startSharedTestAction, submitSharedTestAction } from "@/app/actions";
import { CountdownTimer } from "@/components/CountdownTimer";
import { getSharedTestByToken } from "@/lib/repository";

type SharePageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ submitted?: string }>;
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
        </div>
      </div>
    );
  }

  if (!test.startedAt) {
    return (
      <div className="login-wrap">
        <div className="card login-card">
          <h2>{test.title}</h2>
          <p>משך המבחן הוא {test.durationMinutes} דקות. הלחיצה על התחלה תפעיל את הטיימר.</p>
          <form action={startSharedTestAction}>
            <input type="hidden" name="token" value={token} />
            <label>
              שם מלא
              <input name="studentName" defaultValue={test.studentName ?? ""} required />
            </label>
            <label>
              אימייל
              <input name="studentEmail" type="email" defaultValue={test.studentEmail ?? ""} />
            </label>
            <button className="button button-primary" type="submit">
              התחלת מבחן
            </button>
          </form>
        </div>
      </div>
    );
  }

  const deadline = new Date(new Date(test.startedAt).getTime() + test.durationMinutes * 60 * 1000).toISOString();

  return (
    <div className="content" style={{ maxWidth: 960, margin: "0 auto" }}>
      <div className="page-header">
        <div>
          <h2>{test.title}</h2>
          <p>יש להשיב על כל השאלות ולהגיש עד סיום הטיימר.</p>
        </div>
        <CountdownTimer deadlineIso={deadline} formId="student-test-form" />
      </div>
      <form action={submitSharedTestAction} id="student-test-form">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="studentName" value={test.studentName ?? ""} />
        <input type="hidden" name="studentEmail" value={test.studentEmail ?? ""} />
        <div className="stack">
          {test.questions.map((question) => (
            <div className="card" key={question.id}>
              <input type="hidden" name="questionIds" value={question.id} />
              <strong>שאלה {question.orderIndex}</strong>
              <p style={{ whiteSpace: "pre-wrap" }}>{question.prompt}</p>
              <label>
                תשובתך
                <textarea name={`answer:${question.id}`} defaultValue={question.studentAnswer ?? ""} />
              </label>
            </div>
          ))}
        </div>
        <button className="button button-primary" type="submit">
          שליחת מבחן לבדיקה
        </button>
      </form>
    </div>
  );
}
