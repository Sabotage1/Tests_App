import {
  changeOwnPasswordAction,
  deleteAllTestsAction,
  deleteLookupAction,
  deleteUserAction,
  saveBonusQuestionPointsAction,
  saveDefaultDurationAction,
  saveLookupAction,
  saveUserAction,
  updateUserAction,
} from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth";
import { QUESTION_UNIT_LABELS, type QuestionUnit } from "@/lib/constants";
import { getBonusQuestionPoints, getDefaultTestDurationMinutes, getStages, getSubjects, getUsers } from "@/lib/repository";

type SettingsPageProps = {
  searchParams: Promise<{
    unit?: string;
    durationSaved?: string;
    bonusSaved?: string;
    passwordSaved?: string;
    passwordError?: string;
    userSaved?: string;
    userError?: string;
    userDeleted?: string;
    userDeleteError?: string;
    testsCleared?: string;
    testsClearError?: string;
    lookupError?: string;
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const selectedUnit: QuestionUnit = params.unit === "ifr" ? "ifr" : "vfr";
  const [subjects, stages, users, defaultDurationMinutes, bonusQuestionPoints] = await Promise.all([
    getSubjects(selectedUnit),
    getStages(selectedUnit),
    getUsers(),
    getDefaultTestDurationMinutes(),
    getBonusQuestionPoints(),
  ]);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>הגדרות</h2>
          <p>ניהול הגדרות מערכת, משתמשים, ונושאים/שלבים לפי יחידה. לאחראית הדרכה מותר להוסיף ולעדכן נושאים ושלבים.</p>
        </div>
      </div>

      <div className="button-row">
        <a
          className={selectedUnit === "vfr" ? "button unit-toggle-active" : "button unit-toggle-idle"}
          href="/settings?unit=vfr"
        >
          {QUESTION_UNIT_LABELS.vfr}
        </a>
        <a
          className={selectedUnit === "ifr" ? "button unit-toggle-active" : "button unit-toggle-idle"}
          href="/settings?unit=ifr"
        >
          {QUESTION_UNIT_LABELS.ifr}
        </a>
      </div>

      {params.durationSaved ? <div className="alert">ברירת המחדל למשך מבחן נשמרה.</div> : null}
      {params.bonusSaved ? <div className="alert">שווי שאלת הבונוס נשמר.</div> : null}
      {params.passwordSaved ? <div className="alert">הסיסמה עודכנה בהצלחה.</div> : null}
      {params.passwordError ? <div className="alert">עדכון הסיסמה נכשל. בדוק את הסיסמה הנוכחית ואת האימות.</div> : null}
      {params.userSaved ? <div className="alert">פרטי המשתמש נשמרו.</div> : null}
      {params.userError ? <div className="alert">{params.userError}</div> : null}
      {params.userDeleted ? <div className="alert">המשתמש נמחק מהמערכת.</div> : null}
      {params.userDeleteError ? <div className="alert">{params.userDeleteError}</div> : null}
      {params.testsCleared ? <div className="alert">כל המבחנים נמחקו מהמערכת.</div> : null}
      {params.testsClearError ? <div className="alert">כדי למחוק את כל המבחנים יש להקליד בדיוק: מחק הכל</div> : null}
      {params.lookupError ? <div className="alert">{params.lookupError}</div> : null}

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
          <SubmitButton pendingLabel="שומר ברירת מחדל...">
            שמירת ברירת מחדל
          </SubmitButton>
        </form>
      </div>

      {user.role === "admin" ? (
        <div className="card">
          <h3>שווי שאלת בונוס</h3>
          <form action={saveBonusQuestionPointsAction}>
            <div className="grid grid-2">
              <label>
                נקודות לכל שאלת בונוס
                <input
                  name="bonusQuestionPoints"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={bonusQuestionPoints}
                />
              </label>
            </div>
            <p className="muted">הנקודות האלה מתווספות מעל 100 ומחוץ לחישוב הרגיל של שאלות המבחן.</p>
            <SubmitButton pendingLabel="שומר נקודות בונוס...">
              שמירת שווי שאלת בונוס
            </SubmitButton>
          </form>
        </div>
      ) : null}

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
          <SubmitButton pendingLabel="מעדכן סיסמה...">
            עדכון סיסמה
          </SubmitButton>
        </form>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>נושאים עבור {QUESTION_UNIT_LABELS[selectedUnit]}</h3>
          <p className="muted">הנושאים שמופיעים כאן זמינים רק לשאלות ולמבחנים של היחידה שנבחרה למעלה.</p>
          <div className="stack">
            <form action={saveLookupAction} className="question-block">
              <input type="hidden" name="type" value="subjects" />
              <input type="hidden" name="lookupUnit" value={selectedUnit} />
              <label>
                הוספת נושא חדש
                <input name="name" placeholder="נושא חדש" required />
              </label>
              <SubmitButton pendingLabel="מוסיף נושא...">
                הוספת נושא
              </SubmitButton>
            </form>
            {subjects.map((subject) => (
              <form key={subject.value} action={saveLookupAction} className="question-block">
                <input type="hidden" name="type" value="subjects" />
                <input type="hidden" name="id" value={subject.value} />
                <input type="hidden" name="lookupUnit" value={selectedUnit} />
                <label>
                  שם הנושא
                  <input name="name" defaultValue={subject.label} required />
                </label>
                <div className="button-row">
                  <SubmitButton className="button button-secondary" pendingLabel="מעדכן נושא...">
                    עדכון
                  </SubmitButton>
                  {user.role === "admin" ? (
                    <SubmitButton
                      className="button button-danger"
                      formAction={deleteLookupAction}
                      pendingLabel="מוחק נושא..."
                    >
                      מחיקה
                    </SubmitButton>
                  ) : null}
                </div>
              </form>
            ))}
            {subjects.length === 0 ? <div className="muted">עדיין לא הוגדרו נושאים ליחידה הזאת.</div> : null}
          </div>
        </div>

        <div className="card">
          <h3>שלבים עבור {QUESTION_UNIT_LABELS[selectedUnit]}</h3>
          <p className="muted">השלבים כאן מופרדים לפי יחידה, כך שאפשר לנהל מסלולי הסמכה שונים למגדל ולמכ"ם.</p>
          <div className="stack">
            <form action={saveLookupAction} className="question-block">
              <input type="hidden" name="type" value="stages" />
              <input type="hidden" name="lookupUnit" value={selectedUnit} />
              <label>
                הוספת שלב חדש
                <input name="name" placeholder="שלב חדש" required />
              </label>
              <SubmitButton pendingLabel="מוסיף שלב...">
                הוספת שלב
              </SubmitButton>
            </form>
            {stages.map((stage) => (
              <form key={stage.value} action={saveLookupAction} className="question-block">
                <input type="hidden" name="type" value="stages" />
                <input type="hidden" name="id" value={stage.value} />
                <input type="hidden" name="lookupUnit" value={selectedUnit} />
                <label>
                  שם השלב
                  <input name="name" defaultValue={stage.label} required />
                </label>
                <div className="button-row">
                  <SubmitButton className="button button-secondary" pendingLabel="מעדכן שלב...">
                    עדכון
                  </SubmitButton>
                  {user.role === "admin" ? (
                    <SubmitButton
                      className="button button-danger"
                      formAction={deleteLookupAction}
                      pendingLabel="מוחק שלב..."
                    >
                      מחיקה
                    </SubmitButton>
                  ) : null}
                </div>
              </form>
            ))}
            {stages.length === 0 ? <div className="muted">עדיין לא הוגדרו שלבים ליחידה הזאת.</div> : null}
          </div>
        </div>
      </div>

      {user.role === "admin" ? (
        <div className="grid grid-2">
          <div className="card">
            <h3>משתמשים קיימים</h3>
            <p className="muted">התראות על מבחנים חדשים לבדיקה יישלחו רק למשתמשים שמסומנים כאן, שיש להם כתובת מייל, ושהיחידה של המבחן משויכת אליהם.</p>
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
                        <option value="editor">אחראית הדרכה</option>
                        <option value="admin">אדמין</option>
                        <option value="viewer">צופה</option>
                      </select>
                    </label>
                    <label>
                      סיסמה חדשה
                      <input name="password" type="password" placeholder="להשאיר ריק ללא שינוי" />
                    </label>
                    <label className="checkbox-card">
                      <input
                        name="reviewNotificationsEnabled"
                        type="checkbox"
                        defaultChecked={item.reviewNotificationsEnabled}
                      />
                      שלח התראות
                    </label>
                  </div>
                  <div className="stack">
                    <strong>שיוך יחידות</strong>
                    <div className="checkbox-grid">
                      <label className="checkbox-card">
                        <input name="units" type="checkbox" value="vfr" defaultChecked={item.units.includes("vfr")} />
                        {QUESTION_UNIT_LABELS.vfr}
                      </label>
                      <label className="checkbox-card">
                        <input name="units" type="checkbox" value="ifr" defaultChecked={item.units.includes("ifr")} />
                        {QUESTION_UNIT_LABELS.ifr}
                      </label>
                    </div>
                  </div>
                  <div className="button-row">
                    <SubmitButton className="button button-secondary" pendingLabel="שומר משתמש...">
                      שמירת משתמש
                    </SubmitButton>
                    <SubmitButton
                      className="button button-danger"
                      formAction={deleteUserAction}
                      pendingLabel="מוחק משתמש..."
                    >
                      מחיקת משתמש
                    </SubmitButton>
                  </div>
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
                      <option value="editor">אחראית הדרכה</option>
                      <option value="admin">אדמין</option>
                      <option value="viewer">צופה</option>
                    </select>
                  </label>
                  <label>
                    סיסמה
                    <input name="password" type="password" minLength={6} required />
                  </label>
                  <label className="checkbox-card">
                    <input name="reviewNotificationsEnabled" type="checkbox" />
                    שלח התראות
                  </label>
                </div>
                <div className="stack">
                  <strong>שיוך יחידות</strong>
                  <div className="checkbox-grid">
                    <label className="checkbox-card">
                      <input name="units" type="checkbox" value="vfr" defaultChecked />
                      {QUESTION_UNIT_LABELS.vfr}
                    </label>
                    <label className="checkbox-card">
                      <input name="units" type="checkbox" value="ifr" defaultChecked />
                      {QUESTION_UNIT_LABELS.ifr}
                    </label>
                  </div>
                </div>
                <SubmitButton pendingLabel="מוסיף משתמש...">
                  הוספת משתמש
                </SubmitButton>
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
                <SubmitButton className="button button-danger" pendingLabel="מוחק מבחנים...">
                  מחיקת כל המבחנים
                </SubmitButton>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
