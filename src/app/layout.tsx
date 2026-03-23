import type { Metadata } from "next";
import Link from "next/link";

import { logoutAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME, APP_VERSION } from "@/lib/constants";
import { getPendingReviewCount } from "@/lib/repository";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "מערכת לניהול שאלות, יצירת מבחנים, שיתוף ובדיקת מבחנים לפקחי טיסה.",
};

export const dynamic = "force-dynamic";

const ROLE_LABELS = {
  admin: "אדמין",
  editor: "אחראית הדרכה",
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
  const pendingReviewCount = await getPendingReviewCount();
  const reviewBadge = pendingReviewCount > 99 ? "99+" : String(pendingReviewCount);

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
          <Link href="/dashboard">
            <span className="nav-link-content">
              <span>לוח בקרה</span>
            </span>
          </Link>
          <Link href="/questions">
            <span className="nav-link-content">
              <span>מאגר שאלות</span>
            </span>
          </Link>
          <Link href="/tests/library">
            <span className="nav-link-content">
              <span>מאגר מבחנים</span>
            </span>
          </Link>
          <Link href="/tests/review">
            <span className="nav-link-content">
              <span>בדיקת מבחנים</span>
              {pendingReviewCount > 0 ? <span className="nav-badge">{reviewBadge}</span> : null}
            </span>
          </Link>
          <Link href="/tests/graded">
            <span className="nav-link-content">
              <span>מבחנים שנבדקו</span>
            </span>
          </Link>
          <Link href="/tests/archive">
            <span className="nav-link-content">
              <span>ארכיון מבחנים</span>
            </span>
          </Link>
          <Link href="/tests/new">
            <span className="nav-link-content">
              <span>יצירת מבחן</span>
            </span>
          </Link>
          <Link href="/settings">
            <span className="nav-link-content">
              <span>הגדרות</span>
            </span>
          </Link>
        </nav>
        <form action={logoutAction}>
          <SubmitButton className="button button-secondary" pendingLabel="מתנתק...">
            התנתקות
          </SubmitButton>
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
