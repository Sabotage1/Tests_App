"use client";

import { type Dispatch, type SetStateAction, useState } from "react";

import { createTestAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { QUESTION_UNIT_LABELS } from "@/lib/constants";
import type { QuestionUnit } from "@/lib/constants";
import type { TestBuilderQuestion } from "@/lib/types";

type RecipientDraft = {
  email: string;
  name: string;
};

type TestDraftReviewProps = {
  backHref: string;
  bonusEligibleQuestions: TestBuilderQuestion[];
  bonusQuestionCount: number;
  bonusSourceUnit?: QuestionUnit;
  durationMinutes: string;
  eligibleQuestions: TestBuilderQuestion[];
  initialSelectedBonusQuestionIds: string[];
  initialSelectedQuestionIds: string[];
  onlyAnswered: boolean;
  questionCount: number;
  recipientMode: "single" | "list";
  recipients: RecipientDraft[];
  selectionMode: "random" | "filtered";
  sentAt: string;
  stageIds: string[];
  studentEmail: string;
  studentName: string;
  subjectIds: string[];
  title: string;
  unit: QuestionUnit;
};

const selectionModeLabels = {
  random: "אקראי מכל המאגר",
  filtered: "אקראי לפי נושאים ושלבים",
} as const;

export function TestDraftReview({
  backHref,
  bonusEligibleQuestions,
  bonusQuestionCount,
  bonusSourceUnit,
  durationMinutes,
  eligibleQuestions,
  initialSelectedBonusQuestionIds,
  initialSelectedQuestionIds,
  onlyAnswered,
  questionCount,
  recipientMode,
  recipients,
  selectionMode,
  sentAt,
  stageIds,
  studentEmail,
  studentName,
  subjectIds,
  title,
  unit,
}: TestDraftReviewProps) {
  const [selectedQuestionIds, setSelectedQuestionIds] = useState(initialSelectedQuestionIds);
  const [selectedBonusQuestionIds, setSelectedBonusQuestionIds] = useState(initialSelectedBonusQuestionIds);
  const questionsById = new Map(eligibleQuestions.map((question) => [question.id, question]));
  const bonusQuestionsById = new Map(bonusEligibleQuestions.map((question) => [question.id, question]));
  const totalQuestionCount = selectedQuestionIds.length + selectedBonusQuestionIds.length;
  const isSharedBonusPool = bonusSourceUnit === unit;
  const filledRecipientCount = recipients.filter((recipient) => recipient.name.trim() || recipient.email.trim()).length;

  function renderQuestionSection(input: {
    eligibleQuestions: TestBuilderQuestion[];
    questionsById: Map<string, TestBuilderQuestion>;
    selectedIds: string[];
    setSelectedIds: Dispatch<SetStateAction<string[]>>;
    blockedIds?: string[];
    title: string;
    replacementLabel: string;
    slotPrefix: string;
    isBonus?: boolean;
  }) {
    if (input.selectedIds.length === 0) {
      return null;
    }

    return (
      <div className="stack">
        <h3>{input.title}</h3>
        {input.selectedIds.map((questionId, index) => {
          const currentQuestion = input.questionsById.get(questionId);
          if (!currentQuestion) {
            return (
              <div className="alert" key={`missing-${input.slotPrefix}-${index}`}>
                אחת השאלות שנבחרו כבר לא זמינה. חזור למסך הקודם ובנה את הטיוטה מחדש.
              </div>
            );
          }

          return (
            <div className="card question-review-card" key={`${input.slotPrefix}-${currentQuestion.id}-${index}`}>
              <div className="page-header">
                <div>
                  <h3>{currentQuestion.sourceReference || `שאלה ${index + 1}`}</h3>
                  <p>
                    {currentQuestion.source} | {currentQuestion.questionType === "multiple_choice" ? "רב ברירה" : "פתוחה"}
                  </p>
                </div>
                <div className="question-review-slot">
                  {input.isBonus ? `בונוס ${index + 1}` : `מקום ${index + 1}`}
                </div>
              </div>

              <label>
                {input.replacementLabel}
                <select
                  value={questionId}
                  onChange={(event) => {
                    const nextQuestionId = event.target.value;
                    input.setSelectedIds((current) =>
                      current.map((id, currentIndex) => (currentIndex === index ? nextQuestionId : id)),
                    );
                  }}
                >
                  {input.eligibleQuestions.map((option) => {
                    const usedInAnotherSlot =
                      input.selectedIds.includes(option.id) && input.selectedIds[index] !== option.id;
                    const blockedByOtherSection =
                      input.blockedIds?.includes(option.id) && input.selectedIds[index] !== option.id;

                    return (
                      <option disabled={usedInAnotherSlot || blockedByOtherSection} key={option.id} value={option.id}>
                        {(option.sourceReference || "ללא סימוכין") + " | " + option.source}
                      </option>
                    );
                  })}
                </select>
              </label>

              <p style={{ whiteSpace: "pre-wrap" }}>{currentQuestion.text}</p>

              <div className="pill-row">
                {currentQuestion.subjectNames.map((subject) => (
                  <span className="pill" key={`subject-${currentQuestion.id}-${subject}`}>
                    {subject}
                  </span>
                ))}
                {currentQuestion.stageNames.map((stage) => (
                  <span className="pill" key={`stage-${currentQuestion.id}-${stage}`}>
                    {stage}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>תצוגה מקדימה לפני יצירת מבחן</h2>
          <p>
            אפשר לעבור על השאלות שנבחרו, ולהחליף כל שאלה לפני שמירת המבחן בפועל. שאלות שכבר נבחרו במקום אחר חסומות
            לבחירה כדי למנוע כפילויות.
          </p>
        </div>
        <div className="hero-banner" style={{ minWidth: 260 }}>
          <strong>{title || "מבחן חדש"}</strong>
          <p className="muted" style={{ marginTop: 6 }}>
            {QUESTION_UNIT_LABELS[unit]} | {selectionModeLabels[selectionMode]} | {questionCount} שאלות
            {bonusQuestionCount > 0 ? ` + ${bonusQuestionCount} בונוס` : ""}
          </p>
          {bonusSourceUnit ? <p className="muted">מאגר שאלות בונוס: {QUESTION_UNIT_LABELS[bonusSourceUnit]}</p> : null}
          {recipientMode === "list" ? (
            <p className="muted">השליחה תתבצע עבור {filledRecipientCount} נבחנים שונים עם קישור ייחודי לכל אחד.</p>
          ) : null}
        </div>
      </div>

      <form action={createTestAction}>
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="selectionMode" value={selectionMode} />
        <input type="hidden" name="unit" value={unit} />
        <input type="hidden" name="recipientMode" value={recipientMode} />
        <input type="hidden" name="recipientData" value={JSON.stringify(recipients)} />
        <input type="hidden" name="questionCount" value={String(selectedQuestionIds.length)} />
        <input type="hidden" name="bonusQuestionCount" value={String(selectedBonusQuestionIds.length)} />
        <input type="hidden" name="bonusSourceUnit" value={bonusSourceUnit ?? ""} />
        <input type="hidden" name="durationMinutes" value={durationMinutes} />
        <input type="hidden" name="sentAt" value={sentAt} />
        <input type="hidden" name="studentName" value={studentName} />
        <input type="hidden" name="studentEmail" value={studentEmail} />
        {onlyAnswered ? <input type="hidden" name="onlyAnswered" value="on" /> : null}
        {subjectIds.map((subjectId) => (
          <input key={subjectId} type="hidden" name="subjectIds" value={subjectId} />
        ))}
        {stageIds.map((stageId) => (
          <input key={stageId} type="hidden" name="stageIds" value={stageId} />
        ))}
        {selectedQuestionIds.map((questionId, index) => (
          <input key={`${questionId}-${index}`} type="hidden" name="selectedQuestionIds" value={questionId} />
        ))}
        {selectedBonusQuestionIds.map((questionId, index) => (
          <input key={`bonus-${questionId}-${index}`} type="hidden" name="bonusSelectedQuestionIds" value={questionId} />
        ))}

        <div className="stack">
          {renderQuestionSection({
            eligibleQuestions,
            questionsById,
            selectedIds: selectedQuestionIds,
            setSelectedIds: setSelectedQuestionIds,
            blockedIds: isSharedBonusPool ? selectedBonusQuestionIds : [],
            title: "שאלות המבחן",
            replacementLabel: "החלפת שאלה",
            slotPrefix: "regular",
          })}
          {renderQuestionSection({
            eligibleQuestions: bonusEligibleQuestions,
            questionsById: bonusQuestionsById,
            selectedIds: selectedBonusQuestionIds,
            setSelectedIds: setSelectedBonusQuestionIds,
            blockedIds: isSharedBonusPool ? selectedQuestionIds : [],
            title: bonusSourceUnit ? `שאלות בונוס שסומנו ב${QUESTION_UNIT_LABELS[bonusSourceUnit]}` : "שאלות בונוס",
            replacementLabel: "החלפת שאלת בונוס",
            slotPrefix: "bonus",
            isBonus: true,
          })}
        </div>

        <div className="button-row">
          <a className="button button-secondary" href={backHref}>
            חזרה לעריכת המבחן
          </a>
          <SubmitButton pendingLabel={recipientMode === "list" ? "יוצר ושולח מבחנים..." : "שומר מבחן..."}>
            {recipientMode === "list"
              ? `יצירה ושליחה ל-${filledRecipientCount} נבחנים`
              : `יצירת המבחן הסופי (${totalQuestionCount} שאלות)`}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
