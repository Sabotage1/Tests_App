"use client";

export function PrintButton() {
  return (
    <button type="button" className="button button-secondary" onClick={() => window.print()}>
      ייצוא / הדפסה ל־PDF
    </button>
  );
}
