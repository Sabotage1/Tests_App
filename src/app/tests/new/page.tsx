import Link from "next/link";

import { NewTestForm } from "@/components/NewTestForm";
import { getSelectedUnitForUser, getUnitOrderForUser, requireUser } from "@/lib/auth";
import { QUESTION_UNIT_LABELS, type QuestionUnit } from "@/lib/constants";
import { getBonusQuestionPoints, getDefaultTestDurationMinutes, getQuestions, getStages, getSubjects } from "@/lib/repository";

type NewTestPageProps = {
  searchParams: Promise<{ error?: string; unit?: string }>;
};

export default async function NewTestPage({ searchParams }: NewTestPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const selectedUnit: QuestionUnit = getSelectedUnitForUser(user, params.unit);
  const unitOrder = getUnitOrderForUser(user);
  const [subjects, stages, defaultDurationMinutes, bonusQuestionPoints, questions] = await Promise.all([
    getSubjects(selectedUnit),
    getStages(selectedUnit),
    getDefaultTestDurationMinutes(),
    getBonusQuestionPoints(),
    getQuestions(),
  ]);
  const activeQuestions = questions.filter((question) => question.isActive === 1 && question.unit === selectedUnit);

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
          selectedUnit={selectedUnit}
          stages={stages}
          subjects={subjects}
        />
      </div>
    </div>
  );
}
