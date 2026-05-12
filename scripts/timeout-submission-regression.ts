import { query } from "@/lib/db";
import { submitTestByToken } from "@/lib/repository";

const CREATED_BY = "timeout-regression-user";
const MANUAL_TEST_ID = "timeout-regression-manual-test";
const TIMER_TEST_ID = "timeout-regression-timer-test";
const MANUAL_QUESTION_ID = "timeout-regression-manual-question";
const TIMER_QUESTION_ID = "timeout-regression-timer-question";
const MANUAL_TOKEN = "timeout-regression-manual-token";
const TIMER_TOKEN = "timeout-regression-timer-token";

async function cleanup() {
  await query("DELETE FROM tests WHERE id = ANY($1::text[])", [[MANUAL_TEST_ID, TIMER_TEST_ID]]);
  await query("DELETE FROM users WHERE id = $1", [CREATED_BY]);
}

async function insertExpiredTest(input: {
  testId: string;
  questionId: string;
  shareToken: string;
}) {
  await query(
    `
      INSERT INTO tests (
        id, title, created_by, status, selection_mode, unit, question_count, duration_minutes,
        share_token, student_name, student_email, sent_at, started_at, created_at, updated_at
      )
      VALUES (
        $1, 'Timeout regression', $2, 'sent', 'manual', 'vfr', 1, 1,
        $3, 'Timer Student', 'timer@example.com', NOW() - INTERVAL '3 minutes',
        NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '2 minutes'
      )
    `,
    [input.testId, CREATED_BY, input.shareToken],
  );

  await query(
    `
      INSERT INTO test_questions (
        id, test_id, question_id, order_index, is_bonus, prompt, question_type,
        choice_mode, choice_options, expected_answer, subject_names, stage_names
      )
      VALUES ($1, $2, NULL, 1, FALSE, 'Question?', 'open', NULL, NULL, 'Answer', ARRAY[]::text[], ARRAY[]::text[])
    `,
    [input.questionId, input.testId],
  );
}

async function main() {
  await cleanup();

  await query(
    `
      INSERT INTO users (id, username, display_name, email, role, units, password_hash, created_at)
      VALUES ($1, 'timeout-regression-user', 'Timeout Regression', NULL, 'admin', ARRAY['vfr']::text[], 'unused', NOW())
    `,
    [CREATED_BY],
  );

  try {
    await insertExpiredTest({
      testId: MANUAL_TEST_ID,
      questionId: MANUAL_QUESTION_ID,
      shareToken: MANUAL_TOKEN,
    });

    let manualRejected = false;
    try {
      await submitTestByToken({
        token: MANUAL_TOKEN,
        answers: [{ id: MANUAL_QUESTION_ID, answer: "manual late answer" }],
      });
    } catch (error) {
      manualRejected = error instanceof Error && error.message.includes("זמן המבחן הסתיים");
    }

    if (!manualRejected) {
      throw new Error("Manual submission after the deadline should still be rejected.");
    }

    await insertExpiredTest({
      testId: TIMER_TEST_ID,
      questionId: TIMER_QUESTION_ID,
      shareToken: TIMER_TOKEN,
    });

    await submitTestByToken({
      token: TIMER_TOKEN,
      answers: [{ id: TIMER_QUESTION_ID, answer: "timer answer" }],
      submittedByTimer: true,
    });

    const result = await query<{
      status: string;
      saved_answer: string | null;
      submitted_at_matches_deadline: boolean;
    }>(
      `
        SELECT
          t.status,
          tq.student_answer AS saved_answer,
          t.submitted_at = t.started_at + (t.duration_minutes || ' minutes')::interval AS submitted_at_matches_deadline
        FROM tests t
        JOIN test_questions tq ON tq.test_id = t.id
        WHERE t.id = $1
      `,
      [TIMER_TEST_ID],
    );

    const row = result.rows[0];
    if (row?.status !== "completed") {
      throw new Error(`Timer submission should complete the test, got ${row?.status ?? "missing row"}.`);
    }

    if (row.saved_answer !== "timer answer") {
      throw new Error(`Timer submission should save the current answer, got ${row.saved_answer ?? "null"}.`);
    }

    if (!row.submitted_at_matches_deadline) {
      throw new Error("Timer submission should record the deadline as the submitted_at timestamp.");
    }
  } finally {
    await cleanup();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
