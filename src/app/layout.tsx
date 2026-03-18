import type { Metadata } from "next";
import Link from "next/link";

import { logoutAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME, APP_VERSION } from "@/lib/constants";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "מערכת לניהול שאלות, יצירת מבחנים, שיתוף ובדיקת מבחנים לפקחי טיסה.",
};

export const dynamic = "force-dynamic";

const ROLE_LABELS = {
  admin: "אדמין",
  editor: "עורך",
  viewer: "צופה",
} as const;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <html lang="he" dir="rtl">
        <body>{children}</body>
      </html>
    );
  }

  const currentUser = user;

  function SidebarContent() {
    return (
      <>
        <div className="brand">
          <small>מערכת הכשרת פקחי טיסה</small>
          <h1>{APP_NAME}</h1>
          <p>
            {currentUser.displayName} | {ROLE_LABELS[currentUser.role]}
          </p>
        </div>
        <nav className="nav">
          <Link href="/dashboard">לוח בקרה</Link>
          <Link href="/questions">מאגר שאלות</Link>
          <Link href="/tests/library">מאגר מבחנים</Link>
          <Link href="/tests/review">בדיקת מבחנים</Link>
          <Link href="/tests/graded">מבחנים שנבדקו</Link>
          <Link href="/tests/archive">ארכיון מבחנים</Link>
          <Link href="/tests/new">יצירת מבחן</Link>
          <Link href="/settings">הגדרות</Link>
        </nav>
        <form action={logoutAction}>
          <button className="button button-secondary" type="submit">
            התנתקות
          </button>
        </form>
        <small className="sidebar-version">גרסה {APP_VERSION}</small>
      </>
    );
  }

  return (
    <html lang="he" dir="rtl">
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <div className="sidebar-desktop">
              <SidebarContent />
            </div>
            <details className="sidebar-mobile">
              <summary className="mobile-menu-trigger">
                <span className="mobile-menu-title">{APP_NAME}</span>
                <span className="mobile-menu-icon" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </summary>
              <div className="sidebar-mobile-panel">
                <SidebarContent />
              </div>
            </details>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
