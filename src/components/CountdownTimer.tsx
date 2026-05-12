"use client";

import { useEffect, useRef, useState } from "react";

import { getCountdownWarningMessage, getCountdownWarningMinute } from "@/lib/countdown-warnings";

type CountdownTimerProps = {
  deadlineIso: string;
  formId: string;
  submissionModeFieldName?: string;
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

export function CountdownTimer({
  deadlineIso,
  formId,
  submissionModeFieldName = "submissionMode",
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => new Date(deadlineIso).getTime() - Date.now());
  const [warningMessage, setWarningMessage] = useState("");
  const previousRemainingRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const warnedMinutesRef = useRef(new Set<number>());

  useEffect(() => {
    function submitExpiredForm() {
      if (submittedRef.current) {
        return;
      }

      const form = document.getElementById(formId) as HTMLFormElement | null;
      if (!form) {
        return;
      }

      const submissionMode = form.elements.namedItem(submissionModeFieldName) as HTMLInputElement | null;
      if (submissionMode) {
        submissionMode.value = "timer";
      }

      submittedRef.current = true;
      form.requestSubmit();
    }

    const interval = window.setInterval(() => {
      const next = new Date(deadlineIso).getTime() - Date.now();
      setRemaining(next);

      if (next <= 0) {
        submitExpiredForm();
        window.clearInterval(interval);
        previousRemainingRef.current = next;
        return;
      }

      const warningMinute = getCountdownWarningMinute({
        previousRemainingMs: previousRemainingRef.current,
        nextRemainingMs: next,
        warnedMinutes: warnedMinutesRef.current,
      });

      if (warningMinute !== null) {
        warnedMinutesRef.current.add(warningMinute);
        const message = getCountdownWarningMessage(warningMinute);
        setWarningMessage(message);
        window.alert(message);
      }

      previousRemainingRef.current = next;
    }, 1000);

    return () => window.clearInterval(interval);
  }, [deadlineIso, formId, submissionModeFieldName]);

  return (
    <div className="timer-stack">
      <div className="timer">זמן נותר: {formatDuration(remaining)}</div>
      {warningMessage ? (
        <div className="timer-warning" role="alert">
          {warningMessage}
        </div>
      ) : null}
    </div>
  );
}
