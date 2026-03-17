import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { PrintButton } from "@/components/PrintButton";
import { getTestById } from "@/lib/repository";

type PrintPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PrintTestPage({ params }: PrintPageProps) {
  await requireUser();
  const { id } = await params;
  const test = await getTestById(id);

  if (!test) {
    notFound();
  }

  return (
    <div className="print-shell">
      <div className="no-print" style={{ marginBottom: 20 }}>
        <PrintButton />
      </div>
      <h1>{test.title}</h1>
      <p>משך: {test.durationMinutes} דקות</p>
      <div className="stack">
        {test.questions.map((question) => (
          <div key={question.id} style={{ marginBottom: 28 }}>
            <h3>שאלה {question.orderIndex}</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{question.prompt}</p>
            <div style={{ borderBottom: "1px solid #cfd6df", height: 60, marginTop: 12 }} />
            <div style={{ borderBottom: "1px solid #cfd6df", height: 60, marginTop: 12 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
