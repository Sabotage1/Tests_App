import { redirect } from "next/navigation";

import { TestDraftReview } from "@/components/TestDraftReview";
import { requireEditor } from "@/lib/auth";
import type { QuestionUnit } from "@/lib/constants";
import { QUESTION_UNIT_LABELS } from "@/lib/constants";
import { getTestDraftQuestions } from "@/lib/repository";

type ReviewPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getManyValues(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value ? [value] : [];
}

export default async function NewTestReviewPage({ searchParams }: ReviewPageProps) {
  await requireEditor();
  const params = await searchParams;
  const unit: QuestionUnit = getSingleValue(params.unit) === "ifr" ? "ifr" : "vfr";
  const selectionMode = getSingleValue(params.selectionMode) === "filtered" ? "filtered" : "random";
  const selectedQuestionIds = getManyValues(params.selectedQuestionIds);
  const questionCount = Number(getSingleValue(params.questionCount) || "0");
  const onlyAnswered = getSingleValue(params.onlyAnswered) === "1";
  const subjectIds = getManyValues(params.subjectIds);
  const stageIds = getManyValues(params.stageIds);

  if (selectedQuestionIds.length === 0) {
    redirect(`/tests/new?unit=${unit}&error=${encodeURIComponent("לא נבחרו שאלות לתצוגה מקדימה.")}`);
  }

  let draft;

  try {
    draft = await getTestDraftQuestions({
      selectionMode,
      unit,
      questionCount,
      onlyAnswered,
      subjectIds,
      stageIds,
      selectedQuestionIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "טעינת טיוטת המבחן נכשלה";
    redirect(`/tests/new?unit=${unit}&error=${encodeURIComponent(message)}`);
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>בדיקת שאלות לפני יצירת מבחן</h2>
          <p>הטיוטה הוכנה עבור {QUESTION_UNIT_LABELS[unit]}. אפשר להחליף שאלות ולשמור את המבחן רק אחרי שההרכב מתאים.</p>
        </div>
      </div>

      <TestDraftReview
        backHref={`/tests/new?unit=${unit}`}
        durationMinutes={getSingleValue(params.durationMinutes)}
        eligibleQuestions={draft.eligibleQuestions}
        initialSelectedQuestionIds={draft.selectedQuestions.map((question) => question.id)}
        onlyAnswered={onlyAnswered}
        questionCount={draft.selectedQuestions.length}
        selectionMode={selectionMode}
        sentAt={getSingleValue(params.sentAt)}
        stageIds={stageIds}
        studentEmail={getSingleValue(params.studentEmail)}
        studentName={getSingleValue(params.studentName)}
        subjectIds={subjectIds}
        title={getSingleValue(params.title)}
        unit={unit}
      />
    </div>
  );
}
