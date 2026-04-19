import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import type { PoolClient, QueryResultRow } from "pg";

import {
  APP_NAME,
  APP_VERSION,
  DEFAULT_BONUS_QUESTION_POINTS,
  DEFAULT_DURATION_MINUTES,
  MISSING_ANSWER_TEXT,
  QUESTION_UNITS,
  type QuestionUnit,
  type UserRole,
} from "@/lib/constants";
import { query, withTransaction } from "@/lib/db";
import type {
  AuditLogEntry,
  DashboardStats,
  Option,
  QuestionRow,
  RecipientList,
  RecipientListMember,
  TestBuilderQuestion,
  TestDetails,
  TestListItem,
  User,
} from "@/lib/types";

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  role: "admin" | "editor" | "viewer";
  review_notifications_enabled: boolean;
  units: QuestionUnit[] | null;
  password_hash: string;
};

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    reviewNotificationsEnabled: row.review_notifications_enabled,
    units: formatArray(row.units) as QuestionUnit[],
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

function normalizeAuditDetails(details: Record<string, unknown> | null | undefined) {
  if (!details) {
    return null;
  }

  const normalizedEntries = Object.entries(details).filter(([, value]) => value !== undefined);
  return normalizedEntries.length > 0 ? Object.fromEntries(normalizedEntries) : null;
}

function normalizeDistinctIds(values: string[] | null | undefined) {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

function normalizeSourceReference(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized === "" ? null : normalized;
}

function isMissingDuration(value: number | undefined) {
  return value === undefined || Number.isNaN(value);
}

function hasExpectedAnswer(answer: string) {
  const normalizedAnswer = answer.trim();
  return normalizedAnswer !== "" && normalizedAnswer !== MISSING_ANSWER_TEXT;
}

function pickRandomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function getScoredQuestionCount(questions: Array<{ isBonus: boolean }>) {
  const regularCount = questions.filter((question) => !question.isBonus).length;
  return regularCount > 0 ? regularCount : questions.length;
}

export async function createAuditLog(input: CreateAuditLogInput) {
  await query(
    `
      INSERT INTO audit_logs (
        id,
        actor_user_id,
        actor_display_name,
        actor_role,
        action,
        entity_type,
        entity_id,
        entity_label,
        details,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    `,
    [
      nanoid(),
      input.actorUserId ?? null,
      input.actorDisplayName.trim(),
      input.actorRole ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.entityLabel?.trim() || null,
      normalizeAuditDetails(input.details),
    ],
  );
}

export async function getAuditLogs(input?: {
  entityType?: string;
  action?: string;
  limit?: number;
}) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (input?.entityType) {
    values.push(input.entityType);
    conditions.push(`entity_type = $${values.length}`);
  }

  if (input?.action) {
    values.push(input.action);
    conditions.push(`action = $${values.length}`);
  }

  values.push(Math.max(1, Math.min(input?.limit ?? 200, 500)));

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query<{
    id: string;
    actor_user_id: string | null;
    actor_display_name: string;
    actor_role: UserRole | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    entity_label: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
  }>(
    `
      SELECT
        id,
        actor_user_id,
        actor_display_name,
        actor_role,
        action,
        entity_type,
        entity_id,
        entity_label,
        details,
        created_at::text
      FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length}
    `,
    values,
  );

  return result.rows.map(
    (row) =>
      ({
        id: row.id,
        actorUserId: row.actor_user_id,
        actorDisplayName: row.actor_display_name,
        actorRole: row.actor_role,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        entityLabel: row.entity_label,
        details: row.details,
        createdAt: row.created_at,
      }) satisfies AuditLogEntry,
  );
}

function mapTestBuilderQuestion(row: QuestionSelectionRow): TestBuilderQuestion {
  return {
    id: row.id,
    text: row.text,
    answer: row.answer,
    questionType: row.question_type,
    isBonusSource: row.is_bonus_source,
    unit: row.unit,
    source: row.source,
    sourceReference: row.source_reference,
    subjectIds: formatArray(row.subject_ids),
    stageIds: formatArray(row.stage_ids),
    subjectNames: formatArray(row.subject_names),
    stageNames: formatArray(row.stage_names),
  };
}

type QueryFn = <T extends QueryResultRow>(text: string, values?: unknown[]) => Promise<{ rows: T[] }>;

type CreateAuditLogInput = {
  actorUserId?: string | null;
  actorDisplayName: string;
  actorRole?: UserRole | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  details?: Record<string, unknown> | null;
};

type QuestionSelectionRow = {
  id: string;
  text: string;
  answer: string;
  question_type: string;
  is_bonus_source: boolean;
  unit: QuestionUnit;
  source: string;
  source_reference: string | null;
  subject_ids: string[] | null;
  stage_ids: string[] | null;
  subject_names: string[] | null;
  stage_names: string[] | null;
};

type LookupExportRow = {
  id: string;
  name: string;
  unit: QuestionUnit;
  created_at: string;
  updated_at: string;
};

type RecipientListRow = {
  id: string;
  name: string;
  unit: QuestionUnit;
  created_by_name: string;
  created_at: string;
  updated_at: string;
};

type RecipientListMemberRow = {
  id: string;
  recipient_list_id: string;
  student_name: string;
  student_email: string;
  order_index: number;
};

type QuestionBankExportRow = {
  id: string;
  text: string;
  answer: string;
  questionType: string;
  isBonusSource: boolean;
  unit: QuestionUnit;
  source: string;
  sourceReference: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  subjectIds: string[] | null;
  stageIds: string[] | null;
  subjectNames: string[] | null;
  stageNames: string[] | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeRecipientListMembers(
  recipients: Array<{
    name: string;
    email: string;
  }>,
) {
  const normalizedRecipients = recipients
    .map((recipient) => ({
      name: recipient.name.trim(),
      email: recipient.email.trim(),
    }))
    .filter((recipient) => recipient.name || recipient.email);

  if (normalizedRecipients.length === 0) {
    throw new Error("יש להזין לפחות נבחן אחד ברשימה.");
  }

  const seenEmails = new Set<string>();

  for (const recipient of normalizedRecipients) {
    if (!recipient.name || !recipient.email) {
      throw new Error("לכל נבחן ברשימה חייבים להזין גם שם וגם כתובת מייל.");
    }

    const normalizedEmail = recipient.email.toLowerCase();
    if (seenEmails.has(normalizedEmail)) {
      throw new Error("אי אפשר לשמור פעמיים את אותה כתובת מייל באותה רשימה.");
    }

    seenEmails.add(normalizedEmail);
  }

  return normalizedRecipients;
}

async function getRecipientListsWithQuery(
  runQuery: QueryFn,
  input?: {
    id?: string;
    unit?: QuestionUnit;
  },
) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (input?.id) {
    values.push(input.id);
    conditions.push(`rl.id = $${values.length}`);
  }

  if (input?.unit) {
    values.push(input.unit);
    conditions.push(`rl.unit = $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const listsResult = await runQuery<RecipientListRow>(
    `
      SELECT
        rl.id,
        rl.name,
        rl.unit,
        u.display_name AS created_by_name,
        rl.created_at::text,
        rl.updated_at::text
      FROM recipient_lists rl
      JOIN users u ON u.id = rl.created_by
      ${whereClause}
      ORDER BY rl.name, rl.created_at DESC
    `,
    values,
  );

  const listIds = listsResult.rows.map((row) => row.id);

  if (listIds.length === 0) {
    return [];
  }

  const membersResult = await runQuery<RecipientListMemberRow>(
    `
      SELECT id, recipient_list_id, student_name, student_email, order_index
      FROM recipient_list_members
      WHERE recipient_list_id = ANY($1::text[])
      ORDER BY order_index ASC, created_at ASC
    `,
    [listIds],
  );

  const membersByListId = new Map<string, RecipientListMember[]>();

  for (const row of membersResult.rows) {
    const currentMembers = membersByListId.get(row.recipient_list_id) ?? [];
    currentMembers.push({
      id: row.id,
      name: row.student_name,
      email: row.student_email,
      orderIndex: row.order_index,
    });
    membersByListId.set(row.recipient_list_id, currentMembers);
  }

  return listsResult.rows.map(
    (row) =>
      ({
        id: row.id,
        name: row.name,
        unit: row.unit,
        createdByName: row.created_by_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        recipients: membersByListId.get(row.id) ?? [],
      }) satisfies RecipientList,
  );
}

function getAppBaseUrl() {
  return (
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    null
  );
}

function getMailFrom() {
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();

  if (!senderEmail) {
    throw new Error("יש להגדיר BREVO_SENDER_EMAIL כדי לשלוח מיילים.");
  }

  const name = process.env.BREVO_SENDER_NAME?.trim() || APP_NAME;
  return {
    email: senderEmail,
    name,
  };
}

function getMailFromAddress() {
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();

  if (!senderEmail) {
    throw new Error("יש להגדיר BREVO_SENDER_EMAIL כדי לשלוח מיילים.");
  }

  return senderEmail;
}

function getBrevoApiKey() {
  const apiKey = process.env.BREVO_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("יש להגדיר BREVO_API_KEY כדי לשלוח מיילים.");
  }

  return apiKey;
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
      SELECT id, username, display_name, email, role, review_notifications_enabled, password_hash
      , units
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

export async function getSubjects(unit?: QuestionUnit) {
  const result = await query<Option>(
    `
      SELECT id AS value, name AS label, unit
      FROM subjects
      ${unit ? "WHERE unit = $1" : ""}
      ORDER BY unit, name
    `,
    unit ? [unit] : [],
  );
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

export async function getBonusQuestionPoints() {
  const result = await query<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = $1",
    ["bonus_question_points"],
  );

  const parsed = Number(result.rows[0]?.value ?? DEFAULT_BONUS_QUESTION_POINTS);
  return Number.isNaN(parsed) ? DEFAULT_BONUS_QUESTION_POINTS : parsed;
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

export async function setBonusQuestionPoints(points: number) {
  await query(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    ["bonus_question_points", String(points)],
  );
}

export async function deleteAllTests() {
  const result = await query<{ id: string }>("DELETE FROM tests RETURNING id");
  return result.rows.length;
}

export async function getPendingReviewCount() {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM tests WHERE status = 'completed'",
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function getStages(unit?: QuestionUnit) {
  const result = await query<Option>(
    `
      SELECT id AS value, name AS label, unit
      FROM stages
      ${unit ? "WHERE unit = $1" : ""}
      ORDER BY unit, name
    `,
    unit ? [unit] : [],
  );
  return result.rows;
}

export async function getRecipientLists(unit?: QuestionUnit) {
  return getRecipientListsWithQuery((text, values) => query(text, values), {
    unit,
  });
}

export async function getRecipientListById(id: string) {
  const lists = await getRecipientListsWithQuery((text, values) => query(text, values), {
    id,
  });
  return lists[0] ?? null;
}

export async function upsertRecipientList(input: {
  id?: string | null;
  name: string;
  unit: QuestionUnit;
  createdBy: string;
  recipients: Array<{
    name: string;
    email: string;
  }>;
}) {
  const normalizedName = input.name.trim();
  if (!normalizedName) {
    throw new Error("יש להזין שם לרשימת השליחה.");
  }

  const normalizedRecipients = normalizeRecipientListMembers(input.recipients);

  return withTransaction(async (client) => {
    const duplicateResult = await client.query<{ id: string }>(
      `
        SELECT id
        FROM recipient_lists
        WHERE LOWER(name) = LOWER($1) AND unit = $2
      `,
      [normalizedName, input.unit],
    );
    const duplicateId = duplicateResult.rows[0]?.id ?? null;

    if (duplicateId && duplicateId !== (input.id ?? null)) {
      throw new Error("כבר קיימת רשימת שליחה בשם הזה עבור היחידה שנבחרה.");
    }

    const listId = input.id?.trim() || nanoid();

    if (input.id) {
      const updateResult = await client.query<{ id: string }>(
        `
          UPDATE recipient_lists
          SET name = $1,
              unit = $2,
              updated_at = NOW()
          WHERE id = $3
          RETURNING id
        `,
        [normalizedName, input.unit, listId],
      );

      if (!updateResult.rows[0]) {
        throw new Error("רשימת השליחה לא נמצאה.");
      }

      await client.query("DELETE FROM recipient_list_members WHERE recipient_list_id = $1", [listId]);
    } else {
      await client.query(
        `
          INSERT INTO recipient_lists (id, name, unit, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
        `,
        [listId, normalizedName, input.unit, input.createdBy],
      );
    }

    for (const [index, recipient] of normalizedRecipients.entries()) {
      await client.query(
        `
          INSERT INTO recipient_list_members (
            id,
            recipient_list_id,
            student_name,
            student_email,
            order_index,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, NOW())
        `,
        [nanoid(), listId, recipient.name, recipient.email, index + 1],
      );
    }

    const savedLists = await getRecipientListsWithQuery((text, values) => client.query(text, values), {
      id: listId,
    });
    return savedLists[0] ?? null;
  });
}

export async function deleteRecipientList(id: string) {
  return withTransaction(async (client) => {
    const listResult = await client.query<{
      id: string;
      name: string;
      unit: QuestionUnit;
    }>(
      `
        SELECT id, name, unit
        FROM recipient_lists
        WHERE id = $1
        FOR UPDATE
      `,
      [id],
    );

    const recipientList = listResult.rows[0];
    if (!recipientList) {
      throw new Error("רשימת השליחה לא נמצאה.");
    }

    const memberCountResult = await client.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM recipient_list_members
        WHERE recipient_list_id = $1
      `,
      [id],
    );

    await client.query("DELETE FROM recipient_lists WHERE id = $1", [id]);

    return {
      id: recipientList.id,
      name: recipientList.name,
      unit: recipientList.unit,
      memberCount: Number(memberCountResult.rows[0]?.count ?? 0),
    };
  });
}

export async function getQuestionBankExport() {
  const [subjectsResult, stagesResult, questionsResult] = await Promise.all([
    query<LookupExportRow>(
      `
        SELECT id, name, unit, created_at::text, updated_at::text
        FROM subjects
        ORDER BY unit, name
      `,
    ),
    query<LookupExportRow>(
      `
        SELECT id, name, unit, created_at::text, updated_at::text
        FROM stages
        ORDER BY unit, name
      `,
    ),
    query<QuestionBankExportRow>(`
      SELECT
        q.id,
        q.text,
        q.answer,
        q.question_type AS "questionType",
        q.is_bonus_source AS "isBonusSource",
        q.unit,
        q.source,
        q.source_reference AS "sourceReference",
        q.is_active AS "isActive",
        q.created_at::text AS "createdAt",
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
      ORDER BY
        q.unit ASC,
        q.source ASC,
        NULLIF(regexp_replace(COALESCE(q.source_reference, ''), '\\D', '', 'g'), '')::INTEGER NULLS LAST,
        q.source_reference ASC NULLS LAST,
        q.created_at ASC
    `),
  ]);

  return {
    schemaVersion: 1,
    exportType: "question-bank",
    appName: APP_NAME,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      subjects: subjectsResult.rows.length,
      stages: stagesResult.rows.length,
      questions: questionsResult.rows.length,
    },
    subjects: subjectsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      unit: row.unit,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    stages: stagesResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      unit: row.unit,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    questions: questionsResult.rows.map((row) => ({
      id: row.id,
      text: row.text,
      answer: row.answer,
      questionType: row.questionType,
      isBonusSource: row.isBonusSource,
      unit: row.unit,
      source: row.source,
      sourceReference: row.sourceReference,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      subjectIds: formatArray(row.subjectIds),
      stageIds: formatArray(row.stageIds),
      subjectNames: formatArray(row.subjectNames),
      stageNames: formatArray(row.stageNames),
    })),
  };
}

export async function getUsers() {
  const result = await query<{
    id: string;
    username: string;
    display_name: string;
    email: string | null;
    role: "admin" | "editor" | "viewer";
    review_notifications_enabled: boolean;
    units: QuestionUnit[] | null;
  }>(`
    SELECT id, username, display_name, email, role, review_notifications_enabled, units
    FROM users
    ORDER BY role, display_name
  `);

  return result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    reviewNotificationsEnabled: row.review_notifications_enabled,
    units: formatArray(row.units) as QuestionUnit[],
  }));
}

export async function createUser(input: {
  username: string;
  displayName: string;
  email?: string;
  role: "admin" | "editor" | "viewer";
  reviewNotificationsEnabled?: boolean;
  units: QuestionUnit[];
  password: string;
}) {
  const normalizedUnits = normalizeDistinctIds(input.units) as QuestionUnit[];
  if (normalizedUnits.length === 0) {
    throw new Error("יש לבחור לפחות יחידה אחת למשתמש.");
  }

  const result = await query<{
    id: string;
    username: string;
    display_name: string;
    role: "admin" | "editor" | "viewer";
  }>(
    `
      INSERT INTO users (
        id, username, display_name, email, role, review_notifications_enabled, units, password_hash, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, username, display_name, role
    `,
    [
      nanoid(),
      input.username.trim().toLowerCase(),
      input.displayName.trim(),
      input.email?.trim() || null,
      input.role,
      Boolean(input.reviewNotificationsEnabled),
      normalizedUnits,
      bcrypt.hashSync(input.password, 10),
    ],
  );

  return {
    id: result.rows[0].id,
    username: result.rows[0].username,
    displayName: result.rows[0].display_name,
    role: result.rows[0].role,
    units: normalizedUnits,
  };
}

export async function deleteUser(input: { id: string; actingUserId: string }) {
  if (input.id === input.actingUserId) {
    throw new Error("לא ניתן למחוק את המשתמש שמחובר כרגע.");
  }

  const userResult = await query<{
    id: string;
    username: string;
    display_name: string;
    role: "admin" | "editor" | "viewer";
  }>(
    "SELECT id, username, display_name, role FROM users WHERE id = $1",
    [input.id],
  );
  const user = userResult.rows[0];

  if (!user) {
    throw new Error("המשתמש לא נמצא.");
  }

  if (user.role === "admin") {
    const adminsResult = await query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM users WHERE role = 'admin'",
    );
    if (Number(adminsResult.rows[0]?.count ?? 0) <= 1) {
      throw new Error("לא ניתן למחוק את האדמין האחרון במערכת.");
    }
  }

  const testsResult = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM tests WHERE created_by = $1",
    [input.id],
  );
  if (Number(testsResult.rows[0]?.count ?? 0) > 0) {
    throw new Error("לא ניתן למחוק משתמש שכבר יצר מבחנים. מחק או נקה את המבחנים שלו קודם.");
  }

  await query("DELETE FROM users WHERE id = $1", [input.id]);

  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
  };
}

export async function updateUser(input: {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  role: "admin" | "editor" | "viewer";
  reviewNotificationsEnabled?: boolean;
  units: QuestionUnit[];
  password?: string;
}) {
  const normalizedUnits = normalizeDistinctIds(input.units) as QuestionUnit[];
  if (normalizedUnits.length === 0) {
    throw new Error("יש לבחור לפחות יחידה אחת למשתמש.");
  }

  if (input.password?.trim()) {
    const result = await query<{
      id: string;
      username: string;
      display_name: string;
      role: "admin" | "editor" | "viewer";
    }>(
      `
        UPDATE users
        SET username = $1,
            display_name = $2,
            email = $3,
            role = $4,
            review_notifications_enabled = $5,
            units = $6,
            password_hash = $7
        WHERE id = $8
        RETURNING id, username, display_name, role
      `,
      [
        input.username.trim().toLowerCase(),
        input.displayName.trim(),
        input.email?.trim() || null,
        input.role,
        Boolean(input.reviewNotificationsEnabled),
        normalizedUnits,
        bcrypt.hashSync(input.password.trim(), 10),
        input.id,
      ],
    );

    return {
      id: result.rows[0].id,
      username: result.rows[0].username,
      displayName: result.rows[0].display_name,
      role: result.rows[0].role,
      units: normalizedUnits,
    };
  }

  const result = await query<{
    id: string;
    username: string;
    display_name: string;
    role: "admin" | "editor" | "viewer";
  }>(
    `
      UPDATE users
      SET username = $1,
          display_name = $2,
          email = $3,
          role = $4,
          review_notifications_enabled = $5,
          units = $6
      WHERE id = $7
      RETURNING id, username, display_name, role
    `,
    [
      input.username.trim().toLowerCase(),
      input.displayName.trim(),
      input.email?.trim() || null,
      input.role,
      Boolean(input.reviewNotificationsEnabled),
      normalizedUnits,
      input.id,
    ],
  );

  return {
    id: result.rows[0].id,
    username: result.rows[0].username,
    displayName: result.rows[0].display_name,
    role: result.rows[0].role,
    units: normalizedUnits,
  };
}

export async function changeUserPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}) {
  const result = await query<UserRow>(
    `
      SELECT id, username, display_name, email, role, review_notifications_enabled, password_hash
      , units
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

export async function upsertLookup(
  type: "subjects" | "stages",
  id: string | null,
  name: string,
  unit: QuestionUnit,
) {
  const normalizedName = name.trim();
  const existingResult = await query<{ id: string }>(
    `SELECT id FROM ${type} WHERE LOWER(name) = LOWER($1) AND unit = $2`,
    [normalizedName, unit],
  );
  const existing = existingResult.rows[0];

  if (existing && existing.id !== id) {
    throw new Error("השם הזה כבר קיים ביחידה שנבחרה.");
  }

  if (id) {
    const result = await query<{ id: string; name: string; unit: QuestionUnit }>(
      `UPDATE ${type} SET name = $1, unit = $2, updated_at = NOW() WHERE id = $3 RETURNING id, name, unit`,
      [normalizedName, unit, id],
    );

    return {
      id: result.rows[0].id,
      name: result.rows[0].name,
      unit: result.rows[0].unit,
      isNew: false,
    };
  }

  const result = await query<{ id: string; name: string; unit: QuestionUnit }>(
    `
      INSERT INTO ${type} (id, name, unit, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (name, unit) DO NOTHING
      RETURNING id, name, unit
    `,
    [nanoid(), normalizedName, unit],
  );

  return {
    id: result.rows[0]?.id ?? existing?.id ?? null,
    name: result.rows[0]?.name ?? normalizedName,
    unit: result.rows[0]?.unit ?? unit,
    isNew: true,
  };
}

export async function deleteLookup(type: "subjects" | "stages", id: string) {
  const result = await query<{ id: string; name: string; unit: QuestionUnit }>(
    `DELETE FROM ${type} WHERE id = $1 RETURNING id, name, unit`,
    [id],
  );

  return result.rows[0] ?? null;
}

async function getQuestionPoolsForTestBuilder(input: {
  selectionMode: "random" | "filtered" | "manual";
  unit: QuestionUnit;
  bonusOnly?: boolean;
  excludeQuestionIds?: string[];
  onlyAnswered?: boolean;
  subjectIds: string[];
  stageIds: string[];
}) {
  const result = await query<QuestionSelectionRow>(
    `
      SELECT
        q.id,
        q.text,
        q.answer,
        q.question_type,
        q.is_bonus_source,
        q.unit,
        q.source,
        q.source_reference,
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
        AND q.unit = $1
      GROUP BY q.id
    `,
    [input.unit],
  );

  const basePool = result.rows;
  const excludedQuestionIds = new Set(normalizeDistinctIds(input.excludeQuestionIds));

  let eligiblePool = input.onlyAnswered ? basePool.filter((row) => hasExpectedAnswer(row.answer)) : basePool;

  if (input.bonusOnly) {
    eligiblePool = eligiblePool.filter((row) => row.is_bonus_source);
  }

  if (excludedQuestionIds.size > 0) {
    eligiblePool = eligiblePool.filter((row) => !excludedQuestionIds.has(row.id));
  }

  if (input.selectionMode === "filtered") {
    eligiblePool = eligiblePool.filter((row) => {
      const subjectMatch =
        input.subjectIds.length === 0 ||
        input.subjectIds.some((subjectId) => formatArray(row.subject_ids).includes(subjectId));
      const stageMatch =
        input.stageIds.length === 0 ||
        input.stageIds.some((stageId) => formatArray(row.stage_ids).includes(stageId));

      return subjectMatch && stageMatch;
    });
  }

  return {
    basePool,
    eligiblePool,
  };
}

function resolveExactQuestionSelection(
  pool: QuestionSelectionRow[],
  selectedIds: string[],
  missingMessage: string,
) {
  const normalizedIds = normalizeDistinctIds(selectedIds);
  const rawIdsCount = selectedIds.map((value) => value.trim()).filter(Boolean).length;

  if (normalizedIds.length !== rawIdsCount) {
    throw new Error("לא ניתן לבחור את אותה שאלה יותר מפעם אחת באותו מבחן.");
  }

  const rowsById = new Map(pool.map((row) => [row.id, row]));
  const selected = normalizedIds
    .map((questionId) => rowsById.get(questionId))
    .filter((row): row is QuestionSelectionRow => Boolean(row));

  if (selected.length !== normalizedIds.length) {
    throw new Error(missingMessage);
  }

  return selected;
}

export async function getTestDraftQuestions(input: {
  selectionMode: "random" | "filtered" | "manual";
  unit: QuestionUnit;
  questionCount: number;
  bonusOnly?: boolean;
  excludeQuestionIds?: string[];
  onlyAnswered?: boolean;
  subjectIds: string[];
  stageIds: string[];
  selectedQuestionIds?: string[];
}) {
  const { basePool, eligiblePool } = await getQuestionPoolsForTestBuilder(input);
  const explicitIds = normalizeDistinctIds(input.selectedQuestionIds);
  let selectedPool: QuestionSelectionRow[] = [];

  if (explicitIds.length > 0) {
    const explicitSelectionPool =
      input.selectionMode === "manual" && !input.bonusOnly ? basePool : eligiblePool;

    selectedPool = resolveExactQuestionSelection(
      explicitSelectionPool,
      explicitIds,
      input.bonusOnly
        ? "חלק משאלות הבונוס שנבחרו כבר לא זמינות יותר. יש לרענן את המסך ולנסות שוב."
        : "חלק מהשאלות שנבחרו אינן זמינות יותר לפי הסינון הנוכחי. יש לרענן את המסך ולנסות שוב.",
    );

    if (input.selectionMode === "manual" && input.onlyAnswered && selectedPool.some((row) => !hasExpectedAnswer(row.answer))) {
      throw new Error("בבחירה של שאלות עם תשובה צפויה בלבד, אי אפשר לבחור שאלות שחסרה להן תשובה.");
    }
  } else if (input.selectionMode === "manual") {
    throw new Error("בבחירה ידנית יש לסמן לפחות שאלה אחת מהמאגָר.");
  } else {
    const requiredCount = Number.isNaN(input.questionCount) ? 0 : input.questionCount;
    if (requiredCount < 1) {
      throw new Error("יש לבחור לפחות שאלה אחת למבחן.");
    }

    const shuffled = [...eligiblePool].sort(() => Math.random() - 0.5);
    selectedPool = shuffled.slice(0, requiredCount);

    if (selectedPool.length < requiredCount) {
      throw new Error(
        input.bonusOnly
          ? "אין מספיק שאלות בונוס פעילות שסומנו במאגר."
          : "אין מספיק שאלות פעילות לבניית המבחן לפי הסינון שבחרת.",
      );
    }
  }

  return {
    eligibleQuestions: eligiblePool.map(mapTestBuilderQuestion),
    selectedQuestions: selectedPool.map(mapTestBuilderQuestion),
  };
}

export async function getBonusQuestionDraft(input: {
  questionCount: number;
  excludeQuestionIds?: string[];
  selectedQuestionIds?: string[];
  sourceUnit?: QuestionUnit;
}) {
  const requiredCount = Number.isNaN(input.questionCount) ? 0 : Math.max(0, input.questionCount);
  const selectedQuestionIds = normalizeDistinctIds(input.selectedQuestionIds);
  const missingSelectionMessage = "חלק משאלות הבונוס שנבחרו כבר לא זמינות יותר. יש לרענן את המסך ולנסות שוב.";

  if (requiredCount < 1) {
    throw new Error("יש לבחור לפחות שאלת בונוס אחת.");
  }

  const pools = await Promise.all(
    QUESTION_UNITS.map(async (unit) => {
      const { eligiblePool } = await getQuestionPoolsForTestBuilder({
        selectionMode: "random",
        unit,
        bonusOnly: true,
        excludeQuestionIds: input.excludeQuestionIds,
        subjectIds: [],
        stageIds: [],
      });

      return { unit, eligiblePool };
    }),
  );

  const matchingPools = pools.filter(({ unit, eligiblePool }) => {
    if (input.sourceUnit && unit !== input.sourceUnit) {
      return false;
    }

    if (eligiblePool.length < requiredCount) {
      return false;
    }

    if (selectedQuestionIds.length === 0) {
      return true;
    }

    const eligibleIds = new Set(eligiblePool.map((row) => row.id));
    return selectedQuestionIds.every((questionId) => eligibleIds.has(questionId));
  });

  if (matchingPools.length === 0) {
    throw new Error(selectedQuestionIds.length > 0 ? missingSelectionMessage : "אין מספיק שאלות בונוס פעילות שסומנו במאגר.");
  }

  const selectedPoolCandidate = input.sourceUnit
    ? matchingPools[0]
    : pickRandomItem(matchingPools);

  if (!selectedPoolCandidate) {
    throw new Error("אין מספיק שאלות בונוס פעילות שסומנו במאגר.");
  }

  const selectedPool =
    selectedQuestionIds.length > 0
      ? resolveExactQuestionSelection(
          selectedPoolCandidate.eligiblePool,
          selectedQuestionIds,
          missingSelectionMessage,
        )
      : [...selectedPoolCandidate.eligiblePool].sort(() => Math.random() - 0.5).slice(0, requiredCount);

  return {
    sourceUnit: selectedPoolCandidate.unit,
    eligibleQuestions: selectedPoolCandidate.eligiblePool.map(mapTestBuilderQuestion),
    selectedQuestions: selectedPool.map(mapTestBuilderQuestion),
  };
}

export async function getQuestionById(id: string) {
  const result = await query<QuestionRow>(
    `
      SELECT
        q.id,
        q.text,
        q.answer,
        q.question_type AS "questionType",
        q.is_bonus_source AS "isBonusSource",
        q.unit,
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
      q.is_bonus_source AS "isBonusSource",
      q.unit,
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
    ORDER BY
      q.source ASC,
      NULLIF(regexp_replace(COALESCE(q.source_reference, ''), '\\D', '', 'g'), '')::INTEGER NULLS LAST,
      q.source_reference ASC NULLS LAST,
      q.created_at ASC
  `);

  return result.rows;
}

export async function upsertQuestion(input: {
  id?: string | null;
  text: string;
  answer: string;
  questionType: string;
  isBonusSource?: boolean;
  unit: QuestionUnit;
  source: string;
  sourceReference?: string | null;
  subjectIds: string[];
  stageIds: string[];
}) {
  const questionId = input.id ?? nanoid();
  const isBonusSource = Boolean(input.isBonusSource);

  await withTransaction(async (client) => {
    const normalizedReference = normalizeSourceReference(input.sourceReference);
    let referenceToSave = normalizedReference;

    if (!referenceToSave) {
      const nextReferenceResult = await client.query<{ max_number: string | number | null }>(
        `
          SELECT COALESCE(MAX(number_value), 0)::text AS max_number
          FROM (
            SELECT NULLIF(regexp_replace(COALESCE(source_reference, ''), '\\D', '', 'g'), '')::INTEGER AS number_value
            FROM questions
            WHERE unit = $1
              AND id <> $2
          ) numbered
        `,
        [input.unit, questionId],
      );

      const nextNumber = Number(nextReferenceResult.rows[0]?.max_number ?? 0) + 1;
      referenceToSave = `שאלה ${nextNumber}`;
    }

    if (referenceToSave) {
      const duplicateResult = await client.query<{ id: string }>(
        `
          SELECT id
          FROM questions
          WHERE unit = $1
            AND source_reference = $2
            AND id <> $3
          LIMIT 1
        `,
        [input.unit, referenceToSave, questionId],
      );

      if (duplicateResult.rows.length > 0) {
        throw new Error("מספר השאלה הזה כבר קיים ביחידה שנבחרה.");
      }
    }

    if (input.id) {
      await client.query(
        `
          UPDATE questions
          SET text = $1,
              answer = $2,
              question_type = $3,
              is_bonus_source = $4,
              unit = $5,
              source = $6,
              source_reference = $7,
              updated_at = NOW()
          WHERE id = $8
        `,
        [
          input.text.trim(),
          input.answer.trim() || MISSING_ANSWER_TEXT,
          input.questionType,
          isBonusSource,
          input.unit,
          input.source.trim(),
          referenceToSave,
          questionId,
        ],
      );
    } else {
      await client.query(
        `
          INSERT INTO questions (
            id, text, answer, question_type, is_bonus_source, unit, source, source_reference, is_active, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW(), NOW())
        `,
        [
          questionId,
          input.text.trim(),
          input.answer.trim() || MISSING_ANSWER_TEXT,
          input.questionType,
          isBonusSource,
          input.unit,
          input.source.trim(),
          referenceToSave,
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

export async function deleteQuestion(id: string) {
  await query("DELETE FROM questions WHERE id = $1", [id]);
}

export async function getDashboardStats() {
  const [questionsResult, testsResult, failedResult] = await Promise.all([
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM questions WHERE is_active = TRUE"),
    query<{ status: string; count: string }>(`
      SELECT status, COUNT(*)::text AS count
      FROM tests
      GROUP BY status
    `),
    query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM tests
      WHERE status = 'graded' AND grade < 60
    `),
  ]);

  const statsMap = new Map(testsResult.rows.map((row) => [row.status, Number(row.count)]));

  const stats: DashboardStats = {
    questions: Number(questionsResult.rows[0]?.count ?? 0),
    generated: statsMap.get("generated") ?? 0,
    sent: statsMap.get("sent") ?? 0,
    completed: statsMap.get("completed") ?? 0,
    graded: statsMap.get("graded") ?? 0,
    failed: Number(failedResult.rows[0]?.count ?? 0),
  };

  return stats;
}

export async function getTests() {
  const result = await query<{
    id: string;
    title: string;
    status: TestListItem["status"];
    selection_mode: string;
    unit: QuestionUnit;
    created_at: string;
    updated_at: string;
    sent_at: string | null;
    started_at: string | null;
    submitted_at: string | null;
    graded_at: string | null;
    question_count: number;
    creator_name: string;
    student_name: string | null;
    student_email: string | null;
    grade: string | null;
    subject_names: string[] | null;
    stage_names: string[] | null;
  }>(`
    SELECT
      t.id,
      t.title,
      t.status,
      t.selection_mode,
      t.unit,
      t.created_at::text,
      t.updated_at::text,
      t.sent_at::text,
      t.started_at::text,
      t.submitted_at::text,
      t.graded_at::text,
      t.question_count,
      u.display_name AS creator_name,
      t.student_name,
      t.student_email,
      t.grade::text,
      COALESCE((
        SELECT array_agg(DISTINCT subject_name ORDER BY subject_name)
        FROM test_questions tq
        CROSS JOIN LATERAL unnest(tq.subject_names) AS subject_name
        WHERE tq.test_id = t.id
      ), ARRAY[]::TEXT[]) AS subject_names,
      COALESCE((
        SELECT array_agg(DISTINCT stage_name ORDER BY stage_name)
        FROM test_questions tq
        CROSS JOIN LATERAL unnest(tq.stage_names) AS stage_name
        WHERE tq.test_id = t.id
      ), ARRAY[]::TEXT[]) AS stage_names
    FROM tests t
    JOIN users u ON u.id = t.created_by
    ORDER BY t.created_at DESC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    selectionMode: row.selection_mode,
    unit: row.unit,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at,
    questionCount: row.question_count,
    creatorName: row.creator_name,
    studentName: row.student_name,
    studentEmail: row.student_email,
    grade: row.grade ? Number(row.grade) : null,
    subjectNames: formatArray(row.subject_names),
    stageNames: formatArray(row.stage_names),
  }));
}

export async function deleteTest(id: string) {
  return withTransaction(async (client) => {
    const existingResult = await client.query<{
      id: string;
      title: string;
      unit: QuestionUnit;
      share_token: string | null;
      status: TestListItem["status"];
      student_name: string | null;
      student_email: string | null;
    }>(
      `
        SELECT id, title, unit, share_token, status, student_name, student_email
        FROM tests
        WHERE id = $1
        FOR UPDATE
      `,
      [id],
    );

    const test = existingResult.rows[0];
    if (!test) {
      throw new Error("המבחן לא נמצא.");
    }

    await client.query("DELETE FROM tests WHERE id = $1", [id]);

    return {
      id: test.id,
      title: test.title,
      unit: test.unit,
      shareToken: test.share_token,
      status: test.status,
      studentName: test.student_name,
      studentEmail: test.student_email,
    };
  });
}

export async function createTest(input: {
  title: string;
  createdBy: string;
  selectionMode: "random" | "filtered" | "manual";
  unit: QuestionUnit;
  questionCount: number;
  bonusQuestionCount?: number;
  bonusSourceUnit?: QuestionUnit;
  durationMinutes?: number;
  sentAt?: string;
  onlyAnswered?: boolean;
  subjectIds: string[];
  stageIds: string[];
  questionIds: string[];
  selectedQuestionIds?: string[];
  bonusSelectedQuestionIds?: string[];
  studentName?: string;
  studentEmail?: string;
}) {
  const durationMinutes = isMissingDuration(input.durationMinutes)
    ? await getDefaultTestDurationMinutes()
    : input.durationMinutes!;
  const bonusQuestionCount =
    !Number.isNaN(input.bonusQuestionCount ?? 0)
      ? Math.max(0, input.bonusQuestionCount ?? 0)
      : 0;
  const explicitSelection =
    input.selectionMode === "manual" ? input.questionIds : input.selectedQuestionIds;
  const { selectedQuestions } = await getTestDraftQuestions({
    selectionMode: input.selectionMode,
    unit: input.unit,
    questionCount: input.questionCount,
    onlyAnswered: input.onlyAnswered,
    subjectIds: input.subjectIds,
    stageIds: input.stageIds,
    selectedQuestionIds: explicitSelection,
  });
  const { selectedQuestions: bonusQuestions } =
    bonusQuestionCount > 0
      ? await getBonusQuestionDraft({
          questionCount: bonusQuestionCount,
          sourceUnit: input.bonusSourceUnit,
          selectedQuestionIds: input.bonusSelectedQuestionIds,
          excludeQuestionIds: selectedQuestions.map((question) => question.id),
        })
      : { selectedQuestions: [] };

  const testId = nanoid();

  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO tests (
          id, title, created_by, status, selection_mode, unit, question_count, duration_minutes,
          student_name, student_email, sent_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, 'generated', $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      `,
      [
        testId,
        input.title.trim(),
        input.createdBy,
        input.selectionMode,
        input.unit,
        selectedQuestions.length + bonusQuestions.length,
        durationMinutes,
        input.studentName?.trim() || null,
        input.studentEmail?.trim() || null,
        input.sentAt?.trim() || null,
      ],
    );

    let orderIndex = 1;
    for (const question of selectedQuestions) {
      await client.query(
        `
          INSERT INTO test_questions (
            id, test_id, question_id, order_index, is_bonus, prompt, expected_answer, subject_names, stage_names
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          nanoid(),
          testId,
          question.id,
          orderIndex,
          false,
          question.text,
          question.answer,
          question.subjectNames,
          question.stageNames,
        ],
      );
      orderIndex += 1;
    }

    for (const question of bonusQuestions) {
      await client.query(
        `
          INSERT INTO test_questions (
            id, test_id, question_id, order_index, is_bonus, prompt, expected_answer, subject_names, stage_names
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          nanoid(),
          testId,
          question.id,
          orderIndex,
          true,
          question.text,
          question.answer,
          question.subjectNames,
          question.stageNames,
        ],
      );
      orderIndex += 1;
    }
  });

  return testId;
}

export async function cloneTestForNewStudent(input: {
  sourceTestId: string;
  createdBy: string;
  studentName?: string;
  studentEmail?: string;
  sentAt?: string;
}) {
  const sourceTest = await getTestById(input.sourceTestId);
  if (!sourceTest) {
    throw new Error("המבחן המקורי לא נמצא.");
  }

  const newTestId = nanoid();

  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO tests (
          id, title, created_by, status, selection_mode, unit, question_count, duration_minutes,
          student_name, student_email, sent_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, 'generated', $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      `,
      [
        newTestId,
        sourceTest.title,
        input.createdBy,
        "archived_copy",
        sourceTest.unit,
        sourceTest.questionCount,
        sourceTest.durationMinutes,
        input.studentName?.trim() || null,
        input.studentEmail?.trim() || null,
        input.sentAt?.trim() || null,
      ],
    );

    for (const question of sourceTest.questions) {
      await client.query(
        `
          INSERT INTO test_questions (
            id, test_id, question_id, order_index, is_bonus, prompt, expected_answer, subject_names, stage_names
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          nanoid(),
          newTestId,
          null,
          question.orderIndex,
          question.isBonus,
          question.prompt,
          question.expectedAnswer,
          question.subjectNames,
          question.stageNames,
        ],
      );
    }
  });

  return newTestId;
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

async function getTestByIdWithQuery(runQuery: QueryFn, id: string) {
  const testResult = await runQuery<{
    id: string;
    title: string;
    status: TestDetails["status"];
    selection_mode: string;
    unit: QuestionUnit;
    question_count: number;
    duration_minutes: number;
    share_token: string | null;
    created_at: string;
    updated_at: string;
    sent_at: string | null;
    started_at: string | null;
    submitted_at: string | null;
    graded_at: string | null;
    graded_by_name: string | null;
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
        t.unit,
        t.question_count,
        t.duration_minutes,
        t.share_token,
        t.created_at::text,
        t.updated_at::text,
        t.sent_at::text,
        t.started_at::text,
        t.submitted_at::text,
        t.graded_at::text,
        t.graded_by_name,
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

  const questionsResult = await runQuery<{
    id: string;
    order_index: number;
    is_bonus: boolean;
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
        is_bonus,
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
    unit: test.unit,
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
    gradedByName: test.graded_by_name,
    grade: test.grade ? Number(test.grade) : null,
    gradingNotes: test.grading_notes,
    studentName: test.student_name,
    studentEmail: test.student_email,
    creatorName: test.creator_name,
    questions: questionsResult.rows.map((row) => ({
      id: row.id,
      orderIndex: row.order_index,
      isBonus: row.is_bonus,
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

export async function getTestById(id: string) {
  return getTestByIdWithQuery((text, values) => query(text, values), id);
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
  const result = await query(
    `
      UPDATE tests
      SET started_at = COALESCE(started_at, NOW()),
          student_name = COALESCE(NULLIF($1, ''), student_name),
          student_email = COALESCE(NULLIF($2, ''), student_email),
          updated_at = NOW()
      WHERE share_token = $3
        AND status IN ('generated', 'sent')
      RETURNING id
    `,
    [studentName?.trim() ?? "", studentEmail?.trim() ?? "", token],
  );

  if (result.rowCount === 0) {
    throw new Error("לא ניתן להתחיל מבחן שכבר הוגש או נבדק.");
  }

  return result.rows[0]?.id as string;
}

export async function submitTestByToken(input: {
  token: string;
  answers: Array<{ id: string; answer: string }>;
  studentName?: string;
  studentEmail?: string;
}) {
  return withTransaction(async (client) => {
    const testResult = await client.query<{
      id: string;
      status: string;
      started_at: string | null;
      duration_minutes: number;
    }>(
      `
        SELECT id, status, started_at::text, duration_minutes
        FROM tests
        WHERE share_token = $1
        FOR UPDATE
      `,
      [input.token],
    );

    const test = testResult.rows[0];
    if (!test) {
      throw new Error("המבחן לא נמצא.");
    }

    if (test.status === "completed" || test.status === "graded") {
      throw new Error("המבחן כבר הוגש ולא ניתן לשלוח אותו שוב.");
    }

    if (test.duration_minutes > 0 && test.started_at) {
      const deadline = new Date(test.started_at).getTime() + test.duration_minutes * 60 * 1000;
      if (Date.now() > deadline) {
        throw new Error("זמן המבחן הסתיים ולא ניתן להגיש אותו יותר.");
      }
    }

    for (const answer of input.answers) {
      const updateResult = await client.query(
        "UPDATE test_questions SET student_answer = $1 WHERE id = $2 AND test_id = $3",
        [answer.answer.trim(), answer.id, test.id],
      );

      if (updateResult.rowCount === 0) {
        throw new Error("נשלחו תשובות לא תקינות עבור מבחן זה.");
      }
    }

    await client.query(
      `
        UPDATE tests
        SET status = 'completed',
            submitted_at = NOW(),
            student_name = COALESCE(NULLIF($1, ''), student_name),
            student_email = COALESCE(NULLIF($2, ''), student_email),
            updated_at = NOW()
        WHERE id = $3
      `,
      [input.studentName?.trim() ?? "", input.studentEmail?.trim() ?? "", test.id],
    );

    return test.id;
  });
}

export async function gradeTest(input: {
  testId: string;
  gradedByName: string;
  gradingNotes?: string;
  grades: Array<{ id: string; score: number; feedback: string }>;
}) {
  return withTransaction(async (client) => {
    const [countResult, settingsResult, questionsMetaResult] = await Promise.all([
      client.query<{ total_count: string; regular_count: string }>(
        `
          SELECT
            COUNT(*)::text AS total_count,
            COUNT(*) FILTER (WHERE is_bonus = FALSE)::text AS regular_count
          FROM test_questions
          WHERE test_id = $1
        `,
        [input.testId],
      ),
      client.query<{ value: string }>(
        "SELECT value FROM app_settings WHERE key = $1",
        ["bonus_question_points"],
      ),
      client.query<{ id: string; is_bonus: boolean }>(
        "SELECT id, is_bonus FROM test_questions WHERE test_id = $1",
        [input.testId],
      ),
    ]);
    const totalQuestionCount = Number(countResult.rows[0]?.total_count ?? 0);
    const regularQuestionCount = Number(countResult.rows[0]?.regular_count ?? 0);
    const scoredQuestionCount = regularQuestionCount > 0 ? regularQuestionCount : totalQuestionCount;
    const maxPerRegularQuestion = scoredQuestionCount > 0 ? 100 / scoredQuestionCount : 0;
    const bonusQuestionPoints = Number(settingsResult.rows[0]?.value ?? DEFAULT_BONUS_QUESTION_POINTS);
    const safeBonusQuestionPoints = Number.isNaN(bonusQuestionPoints)
      ? DEFAULT_BONUS_QUESTION_POINTS
      : bonusQuestionPoints;
    const questionMetaById = new Map(questionsMetaResult.rows.map((row) => [row.id, row.is_bonus]));
    let regularTotal = 0;
    let bonusTotal = 0;

    for (const grade of input.grades) {
      const isBonus = questionMetaById.get(grade.id) === true;
      const maxAllowed = isBonus ? safeBonusQuestionPoints : maxPerRegularQuestion;
      const safeScore = Math.min(maxAllowed, Math.max(0, Number.isNaN(grade.score) ? 0 : grade.score));

      if (isBonus) {
        bonusTotal += safeScore;
      } else {
        regularTotal += safeScore;
      }

      await client.query("UPDATE test_questions SET score = $1, feedback = $2 WHERE id = $3", [
        Number(safeScore.toFixed(2)),
        grade.feedback.trim() || null,
        grade.id,
      ]);
    }

    const finalGrade = Number((regularTotal + bonusTotal).toFixed(2));

    await client.query(
      `
        UPDATE tests
        SET status = 'graded',
            grade = $1,
            grading_notes = $2,
            graded_by_name = $3,
            graded_at = NOW(),
            updated_at = NOW()
        WHERE id = $4
      `,
      [finalGrade, input.gradingNotes?.trim() || null, input.gradedByName.trim(), input.testId],
    );

    const gradedTest = await getTestByIdWithQuery((text, values) => client.query(text, values), input.testId);

    if (!gradedTest) {
      throw new Error("המבחן לא נמצא לאחר שמירת הבדיקה.");
    }

    return gradedTest;
  });
}

function buildGradeEmailHtml(test: TestDetails) {
  const questionsHtml = test.questions
    .map((question) => {
      return `
        <div style="margin-bottom:24px;padding:16px;border:1px solid #d2d8e5;border-radius:12px">
          <div style="font-weight:700;margin-bottom:8px">${question.isBonus ? "שאלת בונוס" : "שאלה"} ${question.orderIndex}</div>
          <div style="white-space:pre-wrap;margin-bottom:10px">${question.prompt}</div>
          <div style="margin-bottom:6px"><strong>תשובת תלמיד:</strong><br>${question.studentAnswer || "-"}</div>
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

function buildTestInvitationEmailHtml(test: TestDetails, shareUrl: string) {
  const studentName = test.studentName ? escapeHtml(test.studentName) : "נבחן/ת";
  const sentAt = test.sentAt ? new Date(test.sentAt).toLocaleString("he-IL") : "מיידית";
  const durationLabel =
    test.durationMinutes === 0 ? "ללא מגבלת זמן" : `${test.durationMinutes} דקות`;

  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;background:#f5f7fb;padding:24px">
      <div style="max-width:720px;margin:0 auto;background:white;padding:24px;border-radius:18px">
        <h1 style="margin-top:0">הוזמנת למבחן</h1>
        <p>שלום ${studentName},</p>
        <p>נשלח אליך מבחן חדש מתוך ${escapeHtml(APP_NAME)}.</p>
        <p><strong>שם המבחן:</strong> ${escapeHtml(test.title)}</p>
        <p><strong>משך המבחן:</strong> ${escapeHtml(durationLabel)}</p>
        <p><strong>מועד שליחה:</strong> ${escapeHtml(sentAt)}</p>
        <p style="margin-top:24px">
          <a
            href="${escapeHtml(shareUrl)}"
            style="display:inline-block;padding:12px 18px;border-radius:999px;background:#0070a8;color:#ffffff;text-decoration:none;font-weight:700"
          >
            לפתיחת המבחן
          </a>
        </p>
        <p style="margin-top:16px;color:#5a6c80">אם הכפתור לא נפתח, אפשר להעתיק את הקישור הבא:</p>
        <p style="word-break:break-all">${escapeHtml(shareUrl)}</p>
      </div>
    </div>
  `;
}

function buildReviewNotificationEmailHtml(test: TestDetails, reviewUrl: string | null) {
  const studentName = test.studentName ? escapeHtml(test.studentName) : "לא הוזן";
  const studentEmail = test.studentEmail ? escapeHtml(test.studentEmail) : "לא הוזן";
  const submittedAt = test.submittedAt ? new Date(test.submittedAt).toLocaleString("he-IL") : "לא זמין";
  const reviewAction = reviewUrl
    ? `
      <p style="margin-top:24px">
        <a
          href="${escapeHtml(reviewUrl)}"
          style="display:inline-block;padding:12px 18px;border-radius:999px;background:#0070a8;color:#ffffff;text-decoration:none;font-weight:700"
        >
          פתיחת בדיקת המבחן
        </a>
      </p>
    `
    : "";

  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;background:#f5f7fb;padding:24px">
      <div style="max-width:720px;margin:0 auto;background:white;padding:24px;border-radius:18px">
        <h1 style="margin-top:0">מבחן חדש ממתין לבדיקה</h1>
        <p><strong>מבחן:</strong> ${escapeHtml(test.title)}</p>
        <p><strong>נבחן:</strong> ${studentName}</p>
        <p><strong>מייל נבחן:</strong> ${studentEmail}</p>
        <p><strong>מועד הגשה:</strong> ${escapeHtml(submittedAt)}</p>
        <p><strong>כמות שאלות:</strong> ${test.questionCount}</p>
        <p>המבחן הוגש למערכת ומחכה לבדיקה על ידי אחד הבודקים.</p>
        ${reviewAction}
      </div>
    </div>
  `;
}

async function sendSystemEmail(input: {
  to: string[];
  subject: string;
  html: string;
}) {
  if (input.to.length === 0) {
    return;
  }

  const normalizedRecipients = input.to.map((address) => address.trim()).filter(Boolean);
  const sender = getMailFrom();

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": getBrevoApiKey(),
    },
    body: JSON.stringify({
      sender,
      to:
        normalizedRecipients.length === 1
          ? [{ email: normalizedRecipients[0] }]
          : [{ email: getMailFromAddress(), name: sender.name }],
      bcc:
        normalizedRecipients.length > 1
          ? normalizedRecipients.map((email) => ({ email }))
          : undefined,
      subject: input.subject,
      htmlContent: input.html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`שליחת המייל דרך Brevo נכשלה: ${response.status} ${responseText}`);
  }
}

export async function sendReviewNotificationEmails(testId: string) {
  const test = await getTestById(testId);

  if (!test) {
    throw new Error("המבחן לא נמצא.");
  }

  const recipientsResult = await query<{ email: string }>(
    `
      SELECT email
      FROM users
      WHERE review_notifications_enabled = TRUE
        AND email IS NOT NULL
        AND BTRIM(email) <> ''
        AND $1 = ANY(units)
      ORDER BY display_name
    `,
    [test.unit],
  );

  const recipients = recipientsResult.rows.map((row) => row.email.trim());
  if (recipients.length === 0) {
    return;
  }

  const baseUrl = getAppBaseUrl();
  const reviewUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/tests/${test.id}/grade` : null;

  await sendSystemEmail({
    to: recipients,
    subject: `מבחן חדש לבדיקה: ${test.title}`,
    html: buildReviewNotificationEmailHtml(test, reviewUrl),
  });
}

export async function sendTestInvitationEmail(testId: string) {
  const shareToken = await ensureShareToken(testId);
  const test = await getTestById(testId);

  if (!test) {
    throw new Error("המבחן לא נמצא.");
  }

  if (!test.studentEmail) {
    throw new Error("לא מוגדרת כתובת מייל לחניך.");
  }

  const baseUrl = getAppBaseUrl();
  if (!baseUrl) {
    throw new Error("יש להגדיר APP_BASE_URL כדי לשלוח קישור מבחן במייל.");
  }

  const shareUrl = `${baseUrl.replace(/\/$/, "")}/share/${shareToken}`;

  await sendSystemEmail({
    to: [test.studentEmail],
    subject: `מבחן חדש: ${test.title}`,
    html: buildTestInvitationEmailHtml(test, shareUrl),
  });
}

export async function sendGradeEmail(testOrDetails: string | TestDetails) {
  const test = typeof testOrDetails === "string" ? await getTestById(testOrDetails) : testOrDetails;
  if (!test) {
    throw new Error("המבחן לא נמצא.");
  }

  if (!test.studentEmail) {
    throw new Error("לא מוגדרת כתובת מייל לתלמיד.");
  }

  const sender = getMailFrom();
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": getBrevoApiKey(),
    },
    body: JSON.stringify({
      sender,
      to: [{ email: test.studentEmail }],
      subject: `תוצאות מבחן: ${test.title}`,
      htmlContent: buildGradeEmailHtml(test),
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`שליחת הציון דרך Brevo נכשלה: ${response.status} ${responseText}`);
  }
}
