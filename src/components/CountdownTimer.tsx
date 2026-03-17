"use client";

import { useEffect, useState } from "react";

type CountdownTimerProps = {
  deadlineIso: string;
  formId: string;
};

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
}

export function CountdownTimer({ deadlineIso, formId }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => new Date(deadlineIso).getTime() - Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      const next = new Date(deadlineIso).getTime() - Date.now();
      setRemaining(next);

      if (next <= 0) {
        const form = document.getElementById(formId) as HTMLFormElement | null;
        form?.requestSubmit();
        window.clearInterval(interval);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [deadlineIso, formId]);

  return <div className="timer">זמן נותר: {formatDuration(remaining)}</div>;
}
