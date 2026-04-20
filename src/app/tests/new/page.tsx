import Link from "next/link";

import { NewTestForm, type NewTestFormInitialValues } from "@/components/NewTestForm";
import { getSelectedUnitForUser, getUnitOrderForUser, requireUser } from "@/lib/auth";
import { QUESTION_UNIT_LABELS, type QuestionUnit } from "@/lib/constants";
import { getBonusQuestionPoints, getDefaultTestDurationMinutes, getQuestions, getRecipientLists, getStages, getSubjects } from "@/lib/repository";

type NewTestPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseRecipientData(value: string) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
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

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getManyValues(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value ? [value] : [];
}

export default async function NewTestPage({ searchParams }: NewTestPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const selectedUnit: QuestionUnit = getSelectedUnitForUser(user, getSingleValue(params.unit));
  const unitOrder = getUnitOrderForUser(user);
  const [subjects, stages, defaultDurationMinutes, bonusQuestionPoints, questions, recipientLists] = await Promise.all([
    getSubjects(selectedUnit),
    getStages(selectedUnit),
    getDefaultTestDurationMinutes(),
    getBonusQuestionPoints(),
    getQuestions(selectedUnit),
    getRecipientLists(selectedUnit),
  ]);
  const recipientModeParam = getSingleValue(params.recipientMode);
  const activeQuestions = questions.filter((question) => question.isActive === 1 && question.unit === selectedUnit);
  const initialValues: NewTestFormInitialValues = {
    title: getSingleValue(params.title) || "מבחן חדש",
    questionCount: getSingleValue(params.questionCount) || "10",
    bonusQuestionCount: getSingleValue(params.bonusQuestionCount) || "0",
    durationMinutes: getSingleValue(params.durationMinutes),
    recipientMode:
      recipientModeParam === "saved_list"
        ? "saved_list"
        : recipientModeParam === "manual_list" || recipientModeParam === "list"
          ? "manual_list"
          : "single",
    recipientListId: getSingleValue(params.recipientListId),
    recipients: parseRecipientData(getSingleValue(params.recipientData)),
    selectionMode:
      getSingleValue(params.selectionMode) === "filtered"
        ? "filtered"
        : getSingleValue(params.selectionMode) === "manual"
          ? "manual"
          : "random",
    studentName: getSingleValue(params.studentName),
    studentEmail: getSingleValue(params.studentEmail),
    sentAt: getSingleValue(params.sentAt),
    subjectIds: getManyValues(params.subjectIds),
    stageIds: getManyValues(params.stageIds),
    questionIds: getManyValues(params.questionIds),
  };
  const formKey = JSON.stringify({
    unit: selectedUnit,
    title: initialValues.title,
    questionCount: initialValues.questionCount,
    bonusQuestionCount: initialValues.bonusQuestionCount,
    durationMinutes: initialValues.durationMinutes,
    recipientMode: initialValues.recipientMode,
    recipientListId: initialValues.recipientListId,
    recipients: initialValues.recipients,
    selectionMode: initialValues.selectionMode,
    studentName: initialValues.studentName,
    studentEmail: initialValues.studentEmail,
    sentAt: initialValues.sentAt,
    subjectIds: initialValues.subjectIds,
    stageIds: initialValues.stageIds,
    questionIds: initialValues.questionIds,
  });

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h2>יצירת מבחן חדש</h2>
          <p>בחר יחידה, ואז בנה מבחן אקראי או ידני רק מהשאלות הרלוונטיות לאותה יחידה.</p>
        </div>
      </div>
      <div className="button-row">
        {unitOrder.map((unit) => (
          <Link
            key={unit}
            className={selectedUnit === unit ? "button unit-toggle-active" : "button unit-toggle-idle"}
            href={`/tests/new?unit=${unit}`}
          >
            {QUESTION_UNIT_LABELS[unit]}
          </Link>
        ))}
      </div>
      {params.error ? <div className="alert">{params.error}</div> : null}
      <div className="card">
        <NewTestForm
          activeQuestions={activeQuestions}
          bonusQuestionPoints={bonusQuestionPoints}
          defaultDurationMinutes={defaultDurationMinutes}
          initialValues={initialValues}
          key={formKey}
          recipientLists={recipientLists}
          selectedUnit={selectedUnit}
          stages={stages}
          subjects={subjects}
        />
      </div>
    </div>
  );
}
