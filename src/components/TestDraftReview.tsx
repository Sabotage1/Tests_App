"use client";

import { useState } from "react";

import { createTestAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { QUESTION_UNIT_LABELS } from "@/lib/constants";
import type { QuestionUnit } from "@/lib/constants";
import type { TestBuilderQuestion } from "@/lib/types";

type TestDraftReviewProps = {
  backHref: string;
  durationMinutes: string;
  eligibleQuestions: TestBuilderQuestion[];
  initialSelectedQuestionIds: string[];
  onlyAnswered: boolean;
  questionCount: number;
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
  durationMinutes,
  eligibleQuestions,
  initialSelectedQuestionIds,
  onlyAnswered,
  questionCount,
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
  const questionsById = new Map(eligibleQuestions.map((question) => [question.id, question]));

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
          </p>
        </div>
      </div>

      <form action={createTestAction}>
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="selectionMode" value={selectionMode} />
        <input type="hidden" name="unit" value={unit} />
        <input type="hidden" name="questionCount" value={String(selectedQuestionIds.length)} />
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

        <div className="stack">
          {selectedQuestionIds.map((questionId, index) => {
            const currentQuestion = questionsById.get(questionId);
            if (!currentQuestion) {
              return (
                <div className="alert" key={`missing-${index}`}>
                  אחת השאלות שנבחרו כבר לא זמינה. חזור למסך הקודם ובנה את הטיוטה מחדש.
                </div>
              );
            }

            return (
              <div className="card question-review-card" key={`${currentQuestion.id}-${index}`}>
                <div className="page-header">
                  <div>
                    <h3>{currentQuestion.sourceReference || `שאלה ${index + 1}`}</h3>
                    <p>
                      {currentQuestion.source} | {currentQuestion.questionType === "multiple_choice" ? "רב ברירה" : "פתוחה"}
                    </p>
                  </div>
                  <div className="question-review-slot">מקום {index + 1}</div>
                </div>

                <label>
                  החלפת שאלה
                  <select
                    value={questionId}
                    onChange={(event) => {
                      const nextQuestionId = event.target.value;
                      setSelectedQuestionIds((current) => current.map((id, currentIndex) => (currentIndex === index ? nextQuestionId : id)));
                    }}
                  >
                    {eligibleQuestions.map((option) => {
                      const usedInAnotherSlot =
                        selectedQuestionIds.includes(option.id) && selectedQuestionIds[index] !== option.id;

                      return (
                        <option disabled={usedInAnotherSlot} key={option.id} value={option.id}>
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

        <div className="button-row">
          <a className="button button-secondary" href={backHref}>
            חזרה לעריכת המבחן
          </a>
          <SubmitButton pendingLabel="שומר מבחן...">
            יצירת המבחן הסופי
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
