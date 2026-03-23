import Link from "next/link";

import { NewTestForm } from "@/components/NewTestForm";
import { requireUser } from "@/lib/auth";
import { QUESTION_UNIT_LABELS, type QuestionUnit } from "@/lib/constants";
import { getBonusQuestionPoints, getDefaultTestDurationMinutes, getQuestions, getStages, getSubjects } from "@/lib/repository";

type NewTestPageProps = {
  searchParams: Promise<{ error?: string; unit?: string }>;
};

export default async function NewTestPage({ searchParams }: NewTestPageProps) {
  await requireUser();
  const params = await searchParams;
  const selectedUnit: QuestionUnit = params.unit === "ifr" ? "ifr" : "vfr";
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
        <Link
          className={selectedUnit === "vfr" ? "button unit-toggle-active" : "button unit-toggle-idle"}
          href="/tests/new?unit=vfr"
        >
          {QUESTION_UNIT_LABELS.vfr}
        </Link>
        <Link
          className={selectedUnit === "ifr" ? "button unit-toggle-active" : "button unit-toggle-idle"}
          href="/tests/new?unit=ifr"
        >
          {QUESTION_UNIT_LABELS.ifr}
        </Link>
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
