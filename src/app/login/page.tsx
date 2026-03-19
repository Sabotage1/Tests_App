import { loginAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { APP_NAME } from "@/lib/constants";

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
            <p>מערכת לניהול וייצור מבחנים</p>
          </div>
        </div>
        {params.error ? <div className="alert">שם המשתמש או הסיסמה אינם תקינים.</div> : null}
        <form action={loginAction}>
          <label>
            שם משתמש
            <input name="username" autoComplete="username" autoCapitalize="none" required />
          </label>
          <label>
            סיסמה
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <SubmitButton pendingLabel="נכנס למערכת...">
            כניסה למערכת
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
