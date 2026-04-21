import { getChoiceOptionLabel } from "@/lib/multiple-choice";
import type { ChoiceMode, ChoiceOption } from "@/lib/types";

type MultipleChoicePreviewProps = {
  choiceMode: ChoiceMode | null;
  options: ChoiceOption[];
  selectedOptionIds?: string[];
  showCorrectAnswers?: boolean;
  showMultipleHint?: boolean;
};

export function MultipleChoicePreview({
  choiceMode,
  options,
  selectedOptionIds = [],
  showCorrectAnswers = false,
  showMultipleHint = false,
}: MultipleChoicePreviewProps) {
  if (options.length === 0) {
    return null;
  }

  const selectedIds = new Set(selectedOptionIds);

  return (
    <div className="stack" style={{ gap: 10 }}>
      {showMultipleHint && choiceMode === "multiple" ? (
        <p className="muted">לתשובה זו יכולות להיות יותר מתשובה נכונה אחת.</p>
      ) : null}
      <div className="mcq-options">
        {options.map((option, index) => {
          const isSelected = selectedIds.has(option.id);

          return (
            <div
              className={[
                "mcq-option-card",
                showCorrectAnswers && option.isCorrect ? "is-correct" : "",
                isSelected ? "is-selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={option.id}
            >
              <div className="mcq-option-label">{getChoiceOptionLabel(index)}</div>
              <div className="stack" style={{ gap: 6 }}>
                <div className="mcq-option-text" style={{ whiteSpace: "pre-wrap" }}>
                  {option.text}
                </div>
                {(showCorrectAnswers && option.isCorrect) || isSelected ? (
                  <div className="pill-row">
                    {showCorrectAnswers && option.isCorrect ? <span className="pill pill-success">תשובה נכונה</span> : null}
                    {isSelected ? <span className="pill">סומן</span> : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
