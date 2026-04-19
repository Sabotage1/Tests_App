import { redirect } from "next/navigation";

import { TestDraftReview } from "@/components/TestDraftReview";
import { requireEditor } from "@/lib/auth";
import type { QuestionUnit } from "@/lib/constants";
import { QUESTION_UNIT_LABELS } from "@/lib/constants";
import { getBonusQuestionDraft, getRecipientListById, getTestDraftQuestions } from "@/lib/repository";
import type { TestBuilderQuestion } from "@/lib/types";

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

function getOptionalUnitValue(value: string | string[] | undefined) {
  const normalized = getSingleValue(value);
  return normalized === "ifr" || normalized === "vfr" ? normalized : undefined;
}

function buildBackHref(params: Record<string, string | string[] | undefined>, unit: QuestionUnit) {
  const nextParams = new URLSearchParams();
  nextParams.set("unit", unit);
  nextParams.set("title", getSingleValue(params.title));
  nextParams.set("selectionMode", getSingleValue(params.selectionMode));
  nextParams.set("questionCount", getSingleValue(params.questionCount));
  nextParams.set("bonusQuestionCount", getSingleValue(params.bonusQuestionCount));
  nextParams.set("durationMinutes", getSingleValue(params.durationMinutes));
  nextParams.set("recipientMode", getSingleValue(params.recipientMode));
  nextParams.set("recipientListId", getSingleValue(params.recipientListId));
  nextParams.set("recipientData", getSingleValue(params.recipientData));
  nextParams.set("sentAt", getSingleValue(params.sentAt));
  nextParams.set("studentName", getSingleValue(params.studentName));
  nextParams.set("studentEmail", getSingleValue(params.studentEmail));

  if (getSingleValue(params.onlyAnswered) === "1") {
    nextParams.set("onlyAnswered", "1");
  }

  for (const subjectId of getManyValues(params.subjectIds)) {
    nextParams.append("subjectIds", subjectId);
  }

  for (const stageId of getManyValues(params.stageIds)) {
    nextParams.append("stageIds", stageId);
  }

  return `/tests/new?${nextParams.toString()}`;
}

function parseRecipientData(value: string | string[] | undefined) {
  const rawValue = getSingleValue(value);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((recipient) => ({
      name: typeof recipient?.name === "string" ? recipient.name : "",
      email: typeof recipient?.email === "string" ? recipient.email : "",
    }));
  } catch {
    return [];
  }
}

function getRecipientMode(value: string | string[] | undefined) {
  const normalized = getSingleValue(value);

  if (normalized === "saved_list") {
    return "saved_list" as const;
  }

  if (normalized === "manual_list" || normalized === "list") {
    return "manual_list" as const;
  }

  return "single" as const;
}

export default async function NewTestReviewPage({ searchParams }: ReviewPageProps) {
  await requireEditor();
  const params = await searchParams;
  const unit: QuestionUnit = getSingleValue(params.unit) === "ifr" ? "ifr" : "vfr";
  const selectionMode = getSingleValue(params.selectionMode) === "filtered" ? "filtered" : "random";
  const selectedQuestionIds = getManyValues(params.selectedQuestionIds);
  const bonusSelectedQuestionIds = getManyValues(params.bonusSelectedQuestionIds);
  const bonusSourceUnit = getOptionalUnitValue(params.bonusSourceUnit);
  const questionCount = Number(getSingleValue(params.questionCount) || "0");
  const bonusQuestionCount = Number(getSingleValue(params.bonusQuestionCount) || "0");
  const onlyAnswered = getSingleValue(params.onlyAnswered) === "1";
  const subjectIds = getManyValues(params.subjectIds);
  const stageIds = getManyValues(params.stageIds);
  const recipientMode = getRecipientMode(params.recipientMode);
  const recipientListId = getSingleValue(params.recipientListId);

  if (selectedQuestionIds.length === 0) {
    redirect(`/tests/new?unit=${unit}&error=${encodeURIComponent("לא נבחרו שאלות לתצוגה מקדימה.")}`);
  }

  let draft;
  let bonusDraft: { eligibleQuestions: TestBuilderQuestion[]; selectedQuestions: TestBuilderQuestion[]; sourceUnit?: QuestionUnit } = {
    eligibleQuestions: [],
    selectedQuestions: [],
  };
  let recipients = parseRecipientData(params.recipientData);
  let recipientListName = "";

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

    if (bonusQuestionCount > 0) {
      bonusDraft = await getBonusQuestionDraft({
        questionCount: bonusQuestionCount,
        sourceUnit: bonusSourceUnit,
        excludeQuestionIds: draft.selectedQuestions.map((question) => question.id),
        selectedQuestionIds: bonusSelectedQuestionIds.length > 0 ? bonusSelectedQuestionIds : undefined,
      });
    }

    if (recipientMode === "saved_list" && recipientListId) {
      const selectedRecipientList = await getRecipientListById(recipientListId);

      if (selectedRecipientList) {
        recipients = selectedRecipientList.recipients.map((recipient) => ({
          name: recipient.name,
          email: recipient.email,
        }));
        recipientListName = selectedRecipientList.name;
      }
    }
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
        backHref={buildBackHref(params, unit)}
        durationMinutes={getSingleValue(params.durationMinutes)}
        bonusEligibleQuestions={bonusDraft.eligibleQuestions}
        bonusQuestionCount={bonusDraft.selectedQuestions.length}
        bonusSourceUnit={bonusQuestionCount > 0 ? bonusDraft.sourceUnit : undefined}
        initialSelectedBonusQuestionIds={bonusDraft.selectedQuestions.map((question) => question.id)}
        eligibleQuestions={draft.eligibleQuestions}
        initialSelectedQuestionIds={draft.selectedQuestions.map((question) => question.id)}
        onlyAnswered={onlyAnswered}
        questionCount={draft.selectedQuestions.length}
        recipientListId={recipientListId}
        recipientListName={recipientListName}
        recipientMode={recipientMode}
        recipients={recipients}
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
