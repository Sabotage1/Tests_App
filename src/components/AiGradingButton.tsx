"use client";

import { useFormStatus } from "react-dom";

export function AiGradingButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button button-success" type="submit" disabled={pending}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          הבדיקה האוטומטית רצה...
        </>
      ) : (
        "בדיקה אוטומטית עם בינה מלאכותית"
      )}
    </button>
  );
}
