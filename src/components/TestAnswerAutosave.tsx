"use client";

import { useEffect, useRef, useState } from "react";

import { formatIsraelTime } from "@/lib/date-time";

type TestAnswerAutosaveProps = {
  formId: string;
  token: string;
};

export function TestAnswerAutosave({ formId, token }: TestAnswerAutosaveProps) {
  const [status, setStatus] = useState("");
  const timeoutRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) {
      return;
    }
    const autosaveForm = form;

    async function saveDraft() {
      if (savingRef.current) {
        pendingRef.current = true;
        return;
      }

      savingRef.current = true;
      pendingRef.current = false;

      try {
        const response = await fetch(`/api/share/${encodeURIComponent(token)}/draft`, {
          method: "POST",
          body: new FormData(autosaveForm),
        });

        if (response.ok) {
          setStatus(`טיוטה נשמרה ${formatIsraelTime(new Date())}`);
        } else {
          setStatus("");
        }
      } catch {
        setStatus("");
      } finally {
        savingRef.current = false;
        if (pendingRef.current) {
          window.setTimeout(saveDraft, 250);
        }
      }
    }

    function scheduleSave() {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(saveDraft, 800);
    }

    form.addEventListener("input", scheduleSave);
    form.addEventListener("change", scheduleSave);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      form.removeEventListener("input", scheduleSave);
      form.removeEventListener("change", scheduleSave);
    };
  }, [formId, token]);

  if (!status) {
    return null;
  }

  return (
    <div className="autosave-status muted" aria-live="polite">
      {status}
    </div>
  );
}
