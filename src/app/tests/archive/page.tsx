import Link from "next/link";

import { resendArchivedTestAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getTests } from "@/lib/repository";

type ArchivePageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ArchiveTestsPage({ searchParams }: ArchivePageProps) {
  await requireUser();
  const params = await searchParams;
  const tests = await getTests();
  const archivedTests = tests.filter((test) => test.status !== "generated");

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>ארכיון מבחנים</h2>
          <p>מבחנים שנשלחו בעבר, עם אפשרות לשכפל ולשלוח מחדש לתלמיד חדש.</p>
        </div>
      </div>
      {params.error ? <div className="alert">{params.error}</div> : null}

      <div className="stack">
        {archivedTests.map((test) => (
          <div className="card" key={test.id}>
            <div className="page-header">
              <div>
                <h3>{test.title}</h3>
                <p>
                  סטטוס: {test.status} | נשלח: {test.sentAt ? new Date(test.sentAt).toLocaleString("he-IL") : "-"}
                </p>
              </div>
              <Link className="button button-secondary" href={`/tests/${test.id}`}>
                פתיחת מבחן מקור
              </Link>
            </div>

            <form action={resendArchivedTestAction}>
              <input type="hidden" name="sourceTestId" value={test.id} />
              <div className="grid grid-3">
                <label>
                  שם נבחן חדש
                  <input name="studentName" defaultValue="" required />
                </label>
                <label>
                  מייל תלמיד חדש
                  <input name="studentEmail" type="email" defaultValue="" />
                </label>
                <label>
                  תאריך ושעת שליחה
                  <input name="sentAt" type="datetime-local" />
                </label>
              </div>
              <button className="button button-primary" type="submit">
                שכפול ושליחה מחדש
              </button>
            </form>
          </div>
        ))}
        {archivedTests.length === 0 ? <div className="card">אין מבחנים בארכיון כרגע.</div> : null}
      </div>
    </div>
  );
}
