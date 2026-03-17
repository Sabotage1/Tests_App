import { saveLookupAction, saveUserAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getStages, getSubjects, getUsers } from "@/lib/repository";

export default async function SettingsPage() {
  const user = await requireUser();
  const [subjects, stages, users] = await Promise.all([getSubjects(), getStages(), getUsers()]);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>הגדרות</h2>
          <p>ניהול subjects, stages ומשתמשים. לעורך מותר להוסיף ולעדכן נושאים ושלבים.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Subjects</h3>
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
          <h3>Stages</h3>
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
        <div className="card">
          <h3>משתמשים והרשאות</h3>
          <table className="table">
            <thead>
              <tr>
                <th>שם</th>
                <th>Username</th>
                <th>תפקיד</th>
                <th>מייל</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td>{item.displayName}</td>
                  <td>{item.username}</td>
                  <td>{item.role}</td>
                  <td>{item.email || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <form action={saveUserAction}>
            <div className="grid grid-3">
              <label>
                שם תצוגה
                <input name="displayName" required />
              </label>
              <label>
                Username
                <input name="username" required />
              </label>
              <label>
                אימייל
                <input name="email" type="email" />
              </label>
              <label>
                תפקיד
                <select name="role" defaultValue="editor">
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label>
                סיסמה
                <input name="password" type="password" required />
              </label>
            </div>
            <button className="button button-primary" type="submit">
              הוספת משתמש
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
