import { loginAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { APP_NAME } from "@/lib/constants";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; retryAfter?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const retryAfterSeconds = Number(params.retryAfter ?? "0");
  const retryAfterMinutes =
    Number.isNaN(retryAfterSeconds) || retryAfterSeconds <= 0 ? null : Math.max(1, Math.ceil(retryAfterSeconds / 60));

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="page-header">
          <div>
            <h2>{APP_NAME}</h2>
            <p>מערכת לניהול וייצור מבחנים</p>
          </div>
        </div>
        {params.error === "rate_limit" ? (
          <div className="alert">יותר מדי ניסיונות התחברות. נסה שוב בעוד {retryAfterMinutes ?? 15} דקות.</div>
        ) : params.error ? (
          <div className="alert">שם המשתמש או הסיסמה אינם תקינים.</div>
        ) : null}
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
