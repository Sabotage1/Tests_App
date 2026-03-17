import { createTestAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getDefaultTestDurationMinutes, getStages, getSubjects } from "@/lib/repository";

type NewTestPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewTestPage({ searchParams }: NewTestPageProps) {
  await requireUser();
  const params = await searchParams;
  const [subjects, stages, defaultDurationMinutes] = await Promise.all([
    getSubjects(),
    getStages(),
    getDefaultTestDurationMinutes(),
  ]);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>יצירת מבחן חדש</h2>
          <p>בחר כמות שאלות, סינון לפי subjects ו־stages, או יצירה אקראית מכל המאגר.</p>
        </div>
      </div>
      {params.error ? <div className="alert">{params.error}</div> : null}
      <div className="card">
        <form action={createTestAction}>
          <div className="grid grid-2">
            <label>
              כותרת מבחן
              <input name="title" defaultValue="מבחן חדש" required />
            </label>
            <label>
              כמות שאלות
              <input name="questionCount" type="number" min="1" defaultValue="10" required />
            </label>
            <label>
              משך זמן בדקות
              <input
                name="durationMinutes"
                type="number"
                min="0"
                placeholder={`ברירת מחדל: ${defaultDurationMinutes}`}
              />
            </label>
            <label>
              שיטת בחירה
              <select name="selectionMode" defaultValue="random">
                <option value="random">אקראי מכל המאגר</option>
                <option value="filtered">אקראי רק לפי subjects/stages שנבחרו</option>
              </select>
            </label>
            <label>
              שם נבחן
              <input name="studentName" placeholder="אופציונלי" />
            </label>
            <label>
              מייל תלמיד
              <input name="studentEmail" type="email" placeholder="אופציונלי" />
            </label>
            <label>
              תאריך ושעת שליחה
              <input name="sentAt" type="datetime-local" />
            </label>
          </div>

          <div className="stack">
            <strong>Subjects למבחן</strong>
            <div className="checkbox-grid">
              {subjects.map((subject) => (
                <label className="checkbox-card" key={subject.value}>
                  <input type="checkbox" name="subjectIds" value={subject.value} />
                  {subject.label}
                </label>
              ))}
            </div>
          </div>

          <div className="stack">
            <strong>Stages למבחן</strong>
            <div className="checkbox-grid">
              {stages.map((stage) => (
                <label className="checkbox-card" key={stage.value}>
                  <input type="checkbox" name="stageIds" value={stage.value} />
                  {stage.label}
                </label>
              ))}
            </div>
          </div>
          <p className="muted">
            אם לא יוזן זמן, יילקח ערך ברירת המחדל מהמערכת. אם יוזן 0, למבחן לא תהיה מגבלת זמן.
          </p>

          <button className="button button-primary" type="submit">
            יצירת מבחן
          </button>
        </form>
      </div>
    </div>
  );
}
