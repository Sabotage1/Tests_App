"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { QUESTION_UNIT_LABELS, type QuestionUnit } from "@/lib/constants";

type QuestionUnitSwitcherProps = {
  selectedUnit: QuestionUnit;
  unitOrder: QuestionUnit[];
};

export function QuestionUnitSwitcher({ selectedUnit, unitOrder }: QuestionUnitSwitcherProps) {
  const router = useRouter();
  const [pendingUnit, setPendingUnit] = useState<QuestionUnit | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSwitch = (unit: QuestionUnit) => {
    if (unit === selectedUnit || isPending) {
      return;
    }

    setPendingUnit(unit);
    startTransition(() => {
      router.push(`/questions?unit=${unit}`);
    });
  };

  return (
    <div className="stack">
      <div className="button-row" aria-busy={isPending}>
        {unitOrder.map((unit) => {
          const isActive = selectedUnit === unit;
          const isLoading = pendingUnit === unit && isPending;

          return (
            <button
              key={unit}
              type="button"
              className={`button ${isActive ? "unit-toggle-active" : "unit-toggle-idle"}${isLoading ? " unit-toggle-loading" : ""}`}
              onClick={() => handleSwitch(unit)}
              disabled={isPending}
            >
              {isLoading ? <span className="spinner" aria-hidden="true" /> : null}
              {QUESTION_UNIT_LABELS[unit]}
            </button>
          );
        })}
      </div>
      {isPending && pendingUnit ? (
        <div className="unit-switcher-status" role="status" aria-live="polite">
          טוען את מאגר השאלות עבור {QUESTION_UNIT_LABELS[pendingUnit]}...
        </div>
      ) : null}
    </div>
  );
}
