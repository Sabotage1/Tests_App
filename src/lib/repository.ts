import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import nodemailer from "nodemailer";
import type { PoolClient } from "pg";

import { DEFAULT_DURATION_MINUTES, MISSING_ANSWER_TEXT } from "@/lib/constants";
import { query, withTransaction } from "@/lib/db";
import type { DashboardStats, Option, QuestionRow, TestDetails, TestListItem, User } from "@/lib/types";

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  role: "admin" | "editor";
  password_hash: string;
};

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
  };
}

function toNumber(value: string | number | null) {
  if (value === null) {
    return null;
  }

  return typeof value === "number" ? value : Number(value);
}

function formatArray(values: string[] | null | undefined) {
  return values ?? [];
}

function isMissingDuration(value: number | undefined) {
  return value === undefined || Number.isNaN(value);
}

async function syncQuestionLinks(
  client: PoolClient,
  table: "question_subjects" | "question_stages",
  column: "subject_id" | "stage_id",
  questionId: string,
  ids: string[],
) {
  await client.query(`DELETE FROM ${table} WHERE question_id = $1`, [questionId]);
  for (const id of ids) {
    await client.query(
      `INSERT INTO ${table} (question_id, ${column}) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [questionId, id],
    );
  }
}

export async function authenticateUser(username: string, password: string) {
  const result = await query<UserRow>(
    `
      SELECT id, username, display_name, email, role, password_hash
      FROM users
      WHERE username = $1
    `,
    [username.trim().toLowerCase()],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  if (!bcrypt.compareSync(password, row.password_hash)) {
    return null;
  }

  return mapUser(row);
}

export async function getSubjects() {
  const result = await query<Option>("SELECT id AS value, name AS label FROM subjects ORDER BY name");
  return result.rows;
}

export async function getDefaultTestDurationMinutes() {
  const result = await query<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = $1",
    ["default_test_duration_minutes"],
  );

  const parsed = Number(result.rows[0]?.value ?? DEFAULT_DURATION_MINUTES);
  return Number.isNaN(parsed) ? DEFAULT_DURATION_MINUTES : parsed;
}

export async function setDefaultTestDurationMinutes(durationMinutes: number) {
  await query(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    ["default_test_duration_minutes", String(durationMinutes)],
  );
}

export async function getStages() {
  const result = await query<Option>("SELECT id AS value, name AS label FROM stages ORDER BY name");
  return result.rows;
}

export async function getUsers() {
  const result = await query<{
    id: string;
    username: string;
    display_name: string;
    email: string | null;
    role: "admin" | "editor";
  }>(`
    SELECT id, username, display_name, email, role
    FROM users
    ORDER BY role, display_name
  `);

  return result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
  }));
}

export async function createUser(input: {
  username: string;
  displayName: string;
  email?: string;
  role: "admin" | "editor";
  password: string;
}) {
  await query(
    `
      INSERT INTO users (id, username, display_name, email, role, password_hash, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `,
    [
      nanoid(),
      input.username.trim().toLowerCase(),
      input.displayName.trim(),
      input.email?.trim() || null,
      input.role,
      bcrypt.hashSync(input.password, 10),
    ],
  );
}

export async function updateUser(input: {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  role: "admin" | "editor";
  password?: string;
}) {
  if (input.password?.trim()) {
    await query(
      `
        UPDATE users
        SET username = $1,
            display_name = $2,
            email = $3,
            role = $4,
            password_hash = $5
        WHERE id = $6
      `,
      [
        input.username.trim().toLowerCase(),
        input.displayName.trim(),
        input.email?.trim() || null,
        input.role,
        bcrypt.hashSync(input.password.trim(), 10),
        input.id,
      ],
    );
    return;
  }

  await query(
    `
      UPDATE users
      SET username = $1,
          display_name = $2,
          email = $3,
          role = $4
      WHERE id = $5
    `,
    [input.username.trim().toLowerCase(), input.displayName.trim(), input.email?.trim() || null, input.role, input.id],
  );
}

export async function changeUserPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}) {
  const result = await query<UserRow>(
    `
      SELECT id, username, display_name, email, role, password_hash
      FROM users
      WHERE id = $1
    `,
    [input.userId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("המשתמש לא נמצא.");
  }

  if (!bcrypt.compareSync(input.currentPassword, row.password_hash)) {
    throw new Error("הסיסמה הנוכחית שגויה.");
  }

  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [
    bcrypt.hashSync(input.newPassword.trim(), 10),
    input.userId,
  ]);
}

export async function upsertLookup(type: "subjects" | "stages", id: string | null, name: string) {
  if (id) {
    await query(`UPDATE ${type} SET name = $1, updated_at = NOW() WHERE id = $2`, [name.trim(), id]);
    return;
  }

  await query(
    `INSERT INTO ${type} (id, name, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) ON CONFLICT (name) DO NOTHING`,
    [nanoid(), name.trim()],
  );
}

export async function getQuestionById(id: string) {
  const result = await query<QuestionRow>(
    `
      SELECT
        q.id,
        q.text,
        q.answer,
        q.question_type AS "questionType",
        q.source,
        q.source_reference AS "sourceReference",
        q.is_active::int AS "isActive",
        q.updated_at::text AS "updatedAt",
        COALESCE(array_remove(array_agg(DISTINCT s.id), NULL), ARRAY[]::TEXT[]) AS "subjectIds",
        COALESCE(array_remove(array_agg(DISTINCT st.id), NULL), ARRAY[]::TEXT[]) AS "stageIds",
        COALESCE(array_remove(array_agg(DISTINCT s.name), NULL), ARRAY[]::TEXT[]) AS "subjectNames",
        COALESCE(array_remove(array_agg(DISTINCT st.name), NULL), ARRAY[]::TEXT[]) AS "stageNames"
      FROM questions q
      LEFT JOIN question_subjects qs ON qs.question_id = q.id
      LEFT JOIN subjects s ON s.id = qs.subject_id
      LEFT JOIN question_stages qst ON qst.question_id = q.id
      LEFT JOIN stages st ON st.id = qst.stage_id
      WHERE q.id = $1
      GROUP BY q.id
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function getQuestions() {
  const result = await query<QuestionRow>(`
    SELECT
      q.id,
      q.text,
      q.answer,
      q.question_type AS "questionType",
      q.source,
      q.source_reference AS "sourceReference",
      q.is_active::int AS "isActive",
      q.updated_at::text AS "updatedAt",
      COALESCE(array_remove(array_agg(DISTINCT s.id), NULL), ARRAY[]::TEXT[]) AS "subjectIds",
      COALESCE(array_remove(array_agg(DISTINCT st.id), NULL), ARRAY[]::TEXT[]) AS "stageIds",
      COALESCE(array_remove(array_agg(DISTINCT s.name), NULL), ARRAY[]::TEXT[]) AS "subjectNames",
      COALESCE(array_remove(array_agg(DISTINCT st.name), NULL), ARRAY[]::TEXT[]) AS "stageNames"
    FROM questions q
    LEFT JOIN question_subjects qs ON qs.question_id = q.id
    LEFT JOIN subjects s ON s.id = qs.subject_id
    LEFT JOIN question_stages qst ON qst.question_id = q.id
    LEFT JOIN stages st ON st.id = qst.stage_id
    GROUP BY q.id
    ORDER BY q.updated_at DESC
  `);

  return result.rows;
}

export async function upsertQuestion(input: {
  id?: string | null;
  text: string;
  answer: string;
  questionType: string;
  source: string;
  sourceReference?: string | null;
  subjectIds: string[];
  stageIds: string[];
}) {
  const questionId = input.id ?? nanoid();

  await withTransaction(async (client) => {
    if (input.id) {
      await client.query(
        `
          UPDATE questions
          SET text = $1,
              answer = $2,
              question_type = $3,
              source = $4,
              source_reference = $5,
              updated_at = NOW()
          WHERE id = $6
        `,
        [
          input.text.trim(),
          input.answer.trim() || MISSING_ANSWER_TEXT,
          input.questionType,
          input.source.trim(),
          input.sourceReference?.trim() || null,
          questionId,
        ],
      );
    } else {
      await client.query(
        `
          INSERT INTO questions (
            id, text, answer, question_type, source, source_reference, is_active, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
        `,
        [
          questionId,
          input.text.trim(),
          input.answer.trim() || MISSING_ANSWER_TEXT,
          input.questionType,
          input.source.trim(),
          input.sourceReference?.trim() || null,
        ],
      );
    }

    await syncQuestionLinks(client, "question_subjects", "subject_id", questionId, input.subjectIds);
    await syncQuestionLinks(client, "question_stages", "stage_id", questionId, input.stageIds);
  });

  return questionId;
}

export async function archiveQuestion(id: string) {
  await query("UPDATE questions SET is_active = FALSE, updated_at = NOW() WHERE id = $1", [id]);
}

export async function getDashboardStats() {
  const [questionsResult, testsResult] = await Promise.all([
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM questions WHERE is_active = TRUE"),
    query<{ status: string; count: string }>(`
      SELECT status, COUNT(*)::text AS count
      FROM tests
      GROUP BY status
    `),
  ]);

  const statsMap = new Map(testsResult.rows.map((row) => [row.status, Number(row.count)]));

  const stats: DashboardStats = {
    questions: Number(questionsResult.rows[0]?.count ?? 0),
    generated: statsMap.get("generated") ?? 0,
    sent: statsMap.get("sent") ?? 0,
    completed: statsMap.get("completed") ?? 0,
    graded: statsMap.get("graded") ?? 0,
  };

  return stats;
}

export async function getTests() {
  const result = await query<{
    id: string;
    title: string;
    status: TestListItem["status"];
    created_at: string;
    updated_at: string;
    question_count: number;
    creator_name: string;
    student_name: string | null;
    student_email: string | null;
    grade: string | null;
  }>(`
    SELECT
      t.id,
      t.title,
      t.status,
      t.created_at::text,
      t.updated_at::text,
      t.question_count,
      u.display_name AS creator_name,
      t.student_name,
      t.student_email,
      t.grade::text
    FROM tests t
    JOIN users u ON u.id = t.created_by
    ORDER BY t.created_at DESC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    questionCount: row.question_count,
    creatorName: row.creator_name,
    studentName: row.student_name,
    studentEmail: row.student_email,
    grade: row.grade ? Number(row.grade) : null,
  }));
}

export async function createTest(input: {
  title: string;
  createdBy: string;
  selectionMode: "random" | "filtered";
  questionCount: number;
  durationMinutes?: number;
  subjectIds: string[];
  stageIds: string[];
  studentName?: string;
  studentEmail?: string;
}) {
  const durationMinutes = isMissingDuration(input.durationMinutes)
    ? await getDefaultTestDurationMinutes()
    : input.durationMinutes!;

  const result = await query<{
    id: string;
    text: string;
    answer: string;
    subject_ids: string[] | null;
    stage_ids: string[] | null;
    subject_names: string[] | null;
    stage_names: string[] | null;
  }>(
    `
      SELECT
        q.id,
        q.text,
        q.answer,
        COALESCE(array_remove(array_agg(DISTINCT s.id), NULL), ARRAY[]::TEXT[]) AS subject_ids,
        COALESCE(array_remove(array_agg(DISTINCT st.id), NULL), ARRAY[]::TEXT[]) AS stage_ids,
        COALESCE(array_remove(array_agg(DISTINCT s.name), NULL), ARRAY[]::TEXT[]) AS subject_names,
        COALESCE(array_remove(array_agg(DISTINCT st.name), NULL), ARRAY[]::TEXT[]) AS stage_names
      FROM questions q
      LEFT JOIN question_subjects qs ON qs.question_id = q.id
      LEFT JOIN subjects s ON s.id = qs.subject_id
      LEFT JOIN question_stages qst ON qst.question_id = q.id
      LEFT JOIN stages st ON st.id = qst.stage_id
      WHERE q.is_active = TRUE
      GROUP BY q.id
    `,
  );

  let pool = result.rows;

  if (input.selectionMode === "filtered") {
    pool = pool.filter((row) => {
      const subjectMatch =
        input.subjectIds.length === 0 ||
        input.subjectIds.some((subjectId) => formatArray(row.subject_ids).includes(subjectId));
      const stageMatch =
        input.stageIds.length === 0 ||
        input.stageIds.some((stageId) => formatArray(row.stage_ids).includes(stageId));

      return subjectMatch && stageMatch;
    });
  }

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, input.questionCount);

  if (selected.length < input.questionCount) {
    throw new Error("אין מספיק שאלות פעילות לבניית המבחן לפי הסינון שבחרת.");
  }

  const testId = nanoid();

  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO tests (
          id, title, created_by, status, selection_mode, question_count, duration_minutes,
          student_name, student_email, created_at, updated_at
        )
        VALUES ($1, $2, $3, 'generated', $4, $5, $6, $7, $8, NOW(), NOW())
      `,
      [
        testId,
        input.title.trim(),
        input.createdBy,
        input.selectionMode,
        selected.length,
        durationMinutes,
        input.studentName?.trim() || null,
        input.studentEmail?.trim() || null,
      ],
    );

    let orderIndex = 1;
    for (const question of selected) {
      await client.query(
        `
          INSERT INTO test_questions (
            id, test_id, question_id, order_index, prompt, expected_answer, subject_names, stage_names
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          nanoid(),
          testId,
          question.id,
          orderIndex,
          question.text,
          question.answer,
          formatArray(question.subject_names),
          formatArray(question.stage_names),
        ],
      );
      orderIndex += 1;
    }
  });

  return testId;
}

export async function updateTestDuration(input: {
  testId: string;
  durationMinutes?: number;
}) {
  const durationMinutes = isMissingDuration(input.durationMinutes)
    ? await getDefaultTestDurationMinutes()
    : input.durationMinutes!;

  await query(
    `
      UPDATE tests
      SET duration_minutes = $1,
          updated_at = NOW()
      WHERE id = $2
    `,
    [durationMinutes, input.testId],
  );
}

export async function getTestById(id: string) {
  const testResult = await query<{
    id: string;
    title: string;
    status: TestDetails["status"];
    selection_mode: string;
    question_count: number;
    duration_minutes: number;
    share_token: string | null;
    created_at: string;
    updated_at: string;
    sent_at: string | null;
    started_at: string | null;
    submitted_at: string | null;
    graded_at: string | null;
    grade: string | null;
    grading_notes: string | null;
    student_name: string | null;
    student_email: string | null;
    creator_name: string;
  }>(
    `
      SELECT
        t.id,
        t.title,
        t.status,
        t.selection_mode,
        t.question_count,
        t.duration_minutes,
        t.share_token,
        t.created_at::text,
        t.updated_at::text,
        t.sent_at::text,
        t.started_at::text,
        t.submitted_at::text,
        t.graded_at::text,
        t.grade::text,
        t.grading_notes,
        t.student_name,
        t.student_email,
        u.display_name AS creator_name
      FROM tests t
      JOIN users u ON u.id = t.created_by
      WHERE t.id = $1
    `,
    [id],
  );

  const test = testResult.rows[0];
  if (!test) {
    return null;
  }

  const questionsResult = await query<{
    id: string;
    order_index: number;
    prompt: string;
    expected_answer: string;
    student_answer: string | null;
    score: string | null;
    feedback: string | null;
    subject_names: string[] | null;
    stage_names: string[] | null;
  }>(
    `
      SELECT
        id,
        order_index,
        prompt,
        expected_answer,
        student_answer,
        score::text,
        feedback,
        subject_names,
        stage_names
      FROM test_questions
      WHERE test_id = $1
      ORDER BY order_index
    `,
    [id],
  );

  return {
    id: test.id,
    title: test.title,
    status: test.status,
    selectionMode: test.selection_mode,
    questionCount: test.question_count,
    durationMinutes: test.duration_minutes,
    shareToken: test.share_token,
    shareUrl: test.share_token ? `/share/${test.share_token}` : null,
    createdAt: test.created_at,
    updatedAt: test.updated_at,
    sentAt: test.sent_at,
    startedAt: test.started_at,
    submittedAt: test.submitted_at,
    gradedAt: test.graded_at,
    grade: test.grade ? Number(test.grade) : null,
    gradingNotes: test.grading_notes,
    studentName: test.student_name,
    studentEmail: test.student_email,
    creatorName: test.creator_name,
    questions: questionsResult.rows.map((row) => ({
      id: row.id,
      orderIndex: row.order_index,
      prompt: row.prompt,
      expectedAnswer: row.expected_answer,
      studentAnswer: row.student_answer,
      score: toNumber(row.score),
      feedback: row.feedback,
      subjectNames: formatArray(row.subject_names),
      stageNames: formatArray(row.stage_names),
    })),
  } satisfies TestDetails;
}

export async function ensureShareToken(testId: string) {
  const existing = await query<{ share_token: string | null }>(
    "SELECT share_token FROM tests WHERE id = $1",
    [testId],
  );

  const token = existing.rows[0]?.share_token ?? nanoid(20);
  await query(
    `
      UPDATE tests
      SET share_token = $1,
          status = CASE WHEN status = 'generated' THEN 'sent' ELSE status END,
          sent_at = COALESCE(sent_at, NOW()),
          updated_at = NOW()
      WHERE id = $2
    `,
    [token, testId],
  );

  return token;
}

export async function getSharedTestByToken(token: string) {
  const result = await query<{ id: string }>("SELECT id FROM tests WHERE share_token = $1", [token]);
  const testId = result.rows[0]?.id;
  if (!testId) {
    return null;
  }

  return getTestById(testId);
}

export async function startTestByToken(token: string, studentName?: string, studentEmail?: string) {
  await query(
    `
      UPDATE tests
      SET started_at = COALESCE(started_at, NOW()),
          student_name = COALESCE(NULLIF($1, ''), student_name),
          student_email = COALESCE(NULLIF($2, ''), student_email),
          updated_at = NOW()
      WHERE share_token = $3
    `,
    [studentName?.trim() ?? "", studentEmail?.trim() ?? "", token],
  );
}

export async function submitTestByToken(input: {
  token: string;
  answers: Array<{ id: string; answer: string }>;
  studentName?: string;
  studentEmail?: string;
}) {
  await withTransaction(async (client) => {
    for (const answer of input.answers) {
      await client.query("UPDATE test_questions SET student_answer = $1 WHERE id = $2", [
        answer.answer.trim(),
        answer.id,
      ]);
    }

    await client.query(
      `
        UPDATE tests
        SET status = 'completed',
            submitted_at = NOW(),
            student_name = COALESCE(NULLIF($1, ''), student_name),
            student_email = COALESCE(NULLIF($2, ''), student_email),
            updated_at = NOW()
        WHERE share_token = $3
      `,
      [input.studentName?.trim() ?? "", input.studentEmail?.trim() ?? "", input.token],
    );
  });
}

export async function gradeTest(input: {
  testId: string;
  gradingNotes?: string;
  grades: Array<{ id: string; score: number; feedback: string }>;
}) {
  await withTransaction(async (client) => {
    let total = 0;
    let count = 0;

    for (const grade of input.grades) {
      total += grade.score;
      count += 1;
      await client.query("UPDATE test_questions SET score = $1, feedback = $2 WHERE id = $3", [
        grade.score,
        grade.feedback.trim() || null,
        grade.id,
      ]);
    }

    const average = count ? Number((total / count).toFixed(2)) : 0;

    await client.query(
      `
        UPDATE tests
        SET status = 'graded',
            grade = $1,
            grading_notes = $2,
            graded_at = NOW(),
            updated_at = NOW()
        WHERE id = $3
      `,
      [average, input.gradingNotes?.trim() || null, input.testId],
    );
  });
}

function buildGradeEmailHtml(test: TestDetails) {
  const questionsHtml = test.questions
    .map((question) => {
      return `
        <div style="margin-bottom:24px;padding:16px;border:1px solid #d2d8e5;border-radius:12px">
          <div style="font-weight:700;margin-bottom:8px">שאלה ${question.orderIndex}</div>
          <div style="white-space:pre-wrap;margin-bottom:10px">${question.prompt}</div>
          <div style="margin-bottom:6px"><strong>תשובת תלמיד:</strong><br>${question.studentAnswer || "-"}</div>
          <div style="margin-bottom:6px"><strong>תשובה צפויה:</strong><br>${question.expectedAnswer}</div>
          <div style="margin-bottom:6px"><strong>ציון לשאלה:</strong> ${question.score ?? 0}</div>
          <div><strong>הערת בודק:</strong><br>${question.feedback || "-"}</div>
        </div>
      `;
    })
    .join("");

  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;background:#f5f7fb;padding:24px">
      <div style="max-width:800px;margin:0 auto;background:white;padding:24px;border-radius:18px">
        <h1 style="margin-top:0">${test.title}</h1>
        <p><strong>ציון סופי:</strong> ${test.grade ?? 0}</p>
        <p><strong>הערות כלליות:</strong> ${test.gradingNotes || "-"}</p>
        ${questionsHtml}
      </div>
    </div>
  `;
}

export async function sendGradeEmail(testId: string) {
  const test = await getTestById(testId);
  if (!test) {
    throw new Error("המבחן לא נמצא.");
  }

  if (!test.studentEmail) {
    throw new Error("לא מוגדרת כתובת מייל לתלמיד.");
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error("יש להגדיר GMAIL_USER ו-GMAIL_APP_PASSWORD כדי לשלוח ציונים.");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: test.studentEmail,
    subject: `תוצאות מבחן: ${test.title}`,
    html: buildGradeEmailHtml(test),
  });
}
