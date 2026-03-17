import type { Metadata } from "next";
import Link from "next/link";

import { logoutAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "מערכת לניהול שאלות, יצירת מבחנים, שיתוף ובדיקת מבחנים לפקחי טיסה.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <html lang="he" dir="rtl">
      <body>
        {user ? (
          <div className="app-shell">
            <aside className="sidebar">
              <div className="brand">
                <small>ATC Training Suite</small>
                <h1>{APP_NAME}</h1>
                <p>
                  {user.displayName} | {user.role === "admin" ? "אדמין" : "עורך"}
                </p>
              </div>
              <nav className="nav">
                <Link href="/dashboard">דשבורד</Link>
                <Link href="/questions">מאגר שאלות</Link>
                <Link href="/tests/new">יצירת מבחן</Link>
                <Link href="/settings">הגדרות</Link>
              </nav>
              <form action={logoutAction}>
                <button className="button button-secondary" type="submit">
                  התנתקות
                </button>
              </form>
            </aside>
            <main className="content">{children}</main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
