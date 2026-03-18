import {
  changeOwnPasswordAction,
  deleteAllTestsAction,
  saveDefaultDurationAction,
  saveLookupAction,
  saveUserAction,
  updateUserAction,
} from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getDefaultTestDurationMinutes, getStages, getSubjects, getUsers } from "@/lib/repository";

type SettingsPageProps = {
  searchParams: Promise<{
    durationSaved?: string;
    passwordSaved?: string;
    passwordError?: string;
    userSaved?: string;
    testsCleared?: string;
    testsClearError?: string;
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const [subjects, stages, users, defaultDurationMinutes] = await Promise.all([
    getSubjects(),
    getStages(),
    getUsers(),
    getDefaultTestDurationMinutes(),
  ]);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>הגדרות</h2>
          <p>ניהול נושאים, שלבים ומשתמשים. לעורך מותר להוסיף ולעדכן נושאים ושלבים.</p>
        </div>
      </div>

      {params.durationSaved ? <div className="alert">ברירת המחדל למשך מבחן נשמרה.</div> : null}
      {params.passwordSaved ? <div className="alert">הסיסמה עודכנה בהצלחה.</div> : null}
      {params.passwordError ? <div className="alert">עדכון הסיסמה נכשל. בדוק את הסיסמה הנוכחית ואת האימות.</div> : null}
      {params.userSaved ? <div className="alert">פרטי המשתמש נשמרו.</div> : null}
      {params.testsCleared ? <div className="alert">כל המבחנים נמחקו מהמערכת.</div> : null}
      {params.testsClearError ? <div className="alert">כדי למחוק את כל המבחנים יש להקליד בדיוק: מחק הכל</div> : null}

      <div className="card">
        <h3>ברירת מחדל למשך מבחן</h3>
        <form action={saveDefaultDurationAction}>
          <div className="grid grid-2">
            <label>
              משך ברירת מחדל בדקות
              <input
                name="defaultDurationMinutes"
                type="number"
                min="0"
                defaultValue={defaultDurationMinutes}
              />
            </label>
          </div>
          <p className="muted">השארת שדה ריק תשאיר את ערך ברירת המחדל הקיים. ערך 0 יגדיר מבחנים ללא מגבלת זמן.</p>
          <button className="button button-primary" type="submit">
            שמירת ברירת מחדל
          </button>
        </form>
      </div>

      <div className="card">
        <h3>שינוי סיסמה</h3>
        <form action={changeOwnPasswordAction}>
          <div className="grid grid-3">
            <label>
              סיסמה נוכחית
              <input name="currentPassword" type="password" required />
            </label>
            <label>
              סיסמה חדשה
              <input name="newPassword" type="password" minLength={6} required />
            </label>
            <label>
              אימות סיסמה חדשה
              <input name="confirmPassword" type="password" minLength={6} required />
            </label>
          </div>
          <button className="button button-primary" type="submit">
            עדכון סיסמה
          </button>
        </form>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>נושאים</h3>
          <div className="stack">
            {subjects.map((subject) => (
              <form key={subject.value} action={saveLookupAction}>
                <input type="hidden" name="type" value="subjects" />
                <input type="hidden" name="id" value={subject.value} />
                <label>
                  שם הנושא
                  <input name="name" defaultValue={subject.label} required />
                </label>
                <button className="button button-secondary" type="submit">
                  עדכון
                </button>
              </form>
            ))}
            <form action={saveLookupAction}>
              <input type="hidden" name="type" value="subjects" />
              <label>
                הוספת נושא
                <input name="name" placeholder="נושא חדש" required />
              </label>
              <button className="button button-primary" type="submit">
                הוספה
              </button>
            </form>
          </div>
        </div>

        <div className="card">
          <h3>שלבים</h3>
          <div className="stack">
            {stages.map((stage) => (
              <form key={stage.value} action={saveLookupAction}>
                <input type="hidden" name="type" value="stages" />
                <input type="hidden" name="id" value={stage.value} />
                <label>
                  שם השלב
                  <input name="name" defaultValue={stage.label} required />
                </label>
                <button className="button button-secondary" type="submit">
                  עדכון
                </button>
              </form>
            ))}
            <form action={saveLookupAction}>
              <input type="hidden" name="type" value="stages" />
              <label>
                הוספת שלב
                <input name="name" placeholder="שלב חדש" required />
              </label>
              <button className="button button-primary" type="submit">
                הוספה
              </button>
            </form>
          </div>
        </div>
      </div>

      {user.role === "admin" ? (
        <div className="grid grid-2">
          <div className="card">
            <h3>משתמשים קיימים</h3>
            <div className="stack">
              {users.map((item) => (
                <form key={item.id} action={updateUserAction} className="question-block">
                  <input type="hidden" name="id" value={item.id} />
                  <div className="grid grid-3">
                    <label>
                      שם תצוגה
                      <input name="displayName" defaultValue={item.displayName} required />
                    </label>
                    <label>
                      שם משתמש
                      <input name="username" defaultValue={item.username} required />
                    </label>
                    <label>
                      אימייל
                      <input name="email" type="email" defaultValue={item.email ?? ""} />
                    </label>
                    <label>
                      תפקיד
                      <select name="role" defaultValue={item.role}>
                        <option value="editor">עורך</option>
                        <option value="admin">אדמין</option>
                        <option value="viewer">צופה</option>
                      </select>
                    </label>
                    <label>
                      סיסמה חדשה
                      <input name="password" type="password" placeholder="להשאיר ריק ללא שינוי" />
                    </label>
                  </div>
                  <button className="button button-secondary" type="submit">
                    שמירת משתמש
                  </button>
                </form>
              ))}
            </div>
          </div>

          <div className="stack">
            <div className="card">
              <h3>הוספת משתמש</h3>
              <form action={saveUserAction}>
                <div className="grid grid-3">
                  <label>
                    שם תצוגה
                    <input name="displayName" required />
                  </label>
                  <label>
                    שם משתמש
                    <input name="username" required />
                  </label>
                  <label>
                    אימייל
                    <input name="email" type="email" />
                  </label>
                  <label>
                    תפקיד
                    <select name="role" defaultValue="editor">
                      <option value="editor">עורך</option>
                      <option value="admin">אדמין</option>
                      <option value="viewer">צופה</option>
                    </select>
                  </label>
                  <label>
                    סיסמה
                    <input name="password" type="password" minLength={6} required />
                  </label>
                </div>
                <button className="button button-primary" type="submit">
                  הוספת משתמש
                </button>
              </form>
            </div>

            <div className="card">
              <h3>ניקוי מערכת</h3>
              <p className="muted">
                פעולה זו תמחק את כל המבחנים שנוצרו, נשלחו, הוגשו או נבדקו. מאגר השאלות והמשתמשים לא יימחקו.
              </p>
              <form action={deleteAllTestsAction}>
                <label>
                  להקליד לאישור
                  <input name="confirmation" placeholder="מחק הכל" required />
                </label>
                <button className="button button-danger" type="submit">
                  מחיקת כל המבחנים
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
