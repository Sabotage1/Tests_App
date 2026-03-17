import { z } from "zod";

import { getTestById, gradeTest } from "@/lib/repository";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const gradeSchema = z.object({
  grades: z.array(
    z.object({
      id: z.string(),
      score: z.number(),
      feedback: z.string(),
    }),
  ),
  gradingNotes: z.string(),
});

function buildPrompt(input: {
  title: string;
  maxPerQuestion: number;
  questions: Array<{
    id: string;
    orderIndex: number;
    prompt: string;
    expectedAnswer: string;
    studentAnswer: string | null;
  }>;
}) {
  const questionsBlock = input.questions
    .map((question) => {
      return [
        `Question ID: ${question.id}`,
        `Question Number: ${question.orderIndex}`,
        `Prompt:`,
        question.prompt,
        `Expected Answer:`,
        question.expectedAnswer,
        `Student Answer:`,
        question.studentAnswer || "",
      ].join("\n");
    })
    .join("\n\n---\n\n");

  return `
You are grading an Air Traffic Control theory exam in Hebrew.
Return only JSON according to the provided schema.

Rules:
- Grade each question by comparing the student's answer to the expected answer.
- The maximum score for each question is ${input.maxPerQuestion}.
- The minimum score for each question is 0.
- Be strict but fair.
- If the expected answer is "צריך להוסיף תשובה לשאלה", give score 0 and explain that a model answer is missing.
- If the student answer is empty, give score 0 and explain that no answer was provided.
- Feedback must be in Hebrew, concise, and mention what was correct or missing.
- gradingNotes must be in Hebrew and summarize the student's overall performance.

Exam title: ${input.title}
Questions:
${questionsBlock}
`.trim();
}

function getResponseText(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "candidates" in payload &&
    Array.isArray((payload as { candidates?: unknown[] }).candidates)
  ) {
    const firstCandidate = (payload as { candidates: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
      .candidates[0];
    const text = firstCandidate?.content?.parts?.find((part) => typeof part.text === "string")?.text;
    return text ?? "";
  }

  return "";
}

export async function gradeTestWithAi(testId: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("יש להגדיר GEMINI_API_KEY כדי להשתמש בבדיקת AI.");
  }

  const test = await getTestById(testId);
  if (!test) {
    throw new Error("המבחן לא נמצא.");
  }

  if (test.questions.length === 0) {
    throw new Error("לא ניתן לבדוק מבחן ללא שאלות.");
  }

  const maxPerQuestion = Number((100 / test.questions.length).toFixed(2));
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: buildPrompt({
                title: test.title,
                maxPerQuestion,
                questions: test.questions.map((question) => ({
                  id: question.id,
                  orderIndex: question.orderIndex,
                  prompt: question.prompt,
                  expectedAnswer: question.expectedAnswer,
                  studentAnswer: question.studentAnswer,
                })),
              }),
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            grades: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  score: { type: "number", minimum: 0, maximum: maxPerQuestion },
                  feedback: { type: "string" },
                },
                required: ["id", "score", "feedback"],
              },
            },
            gradingNotes: { type: "string" },
          },
          required: ["grades", "gradingNotes"],
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`קריאת Gemini נכשלה: ${message}`);
  }

  const payload = await response.json();
  const responseText = getResponseText(payload);
  const parsed = gradeSchema.parse(JSON.parse(responseText));

  const existingIds = new Set(test.questions.map((question) => question.id));
  const grades = parsed.grades
    .filter((grade) => existingIds.has(grade.id))
    .map((grade) => ({
      id: grade.id,
      score: grade.score,
      feedback: grade.feedback,
    }));

  if (grades.length !== test.questions.length) {
    throw new Error("Gemini החזיר תשובות חלקיות ולא ניתן לשמור את הבדיקה.");
  }

  await gradeTest({
    testId,
    gradingNotes: parsed.gradingNotes,
    grades,
  });
}
