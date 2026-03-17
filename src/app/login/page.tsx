import { loginAction } from "@/app/actions";
import { APP_NAME, DEFAULT_ADMIN, DEFAULT_EDITOR } from "@/lib/constants";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="page-header">
          <div>
            <h2>{APP_NAME}</h2>
            <p>מערכת בעברית ו־RTL לניהול שאלות, יצירת מבחנים, שיתוף לתלמידים ובדיקת תשובות.</p>
          </div>
        </div>
        {params.error ? <div className="alert">שם המשתמש או הסיסמה אינם תקינים.</div> : null}
        <form action={loginAction}>
          <label>
            שם משתמש
            <input name="username" placeholder="roy" required />
          </label>
          <label>
            סיסמה
            <input name="password" type="password" placeholder="Roy123!" required />
          </label>
          <button className="button button-primary" type="submit">
            כניסה למערכת
          </button>
        </form>
        <div className="hero-banner">
          <strong>משתמשי פתיחה</strong>
          <p className="muted">
            אדמין: {DEFAULT_ADMIN.username} / {DEFAULT_ADMIN.password}
          </p>
          <p className="muted">
            עורך: {DEFAULT_EDITOR.username} / {DEFAULT_EDITOR.password}
          </p>
        </div>
      </div>
    </div>
  );
}
