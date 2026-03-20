import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { DEFAULT_DURATION_MINUTES } from "@/lib/constants";
import { getSeedQuestions, getSeedStages, getSeedSubjects } from "@/lib/seed";

const DEVELOPMENT_INITIAL_USERS = [
  { username: "roy", displayName: "Roy", password: "Roy123!", role: "admin" as const },
  { username: "neta", displayName: "Neta", password: "Neta123!", role: "editor" as const },
];

declare global {
  // eslint-disable-next-line no-var
  var __atcPool__: Pool | undefined;
  // eslint-disable-next-line no-var
  var __atcDbInit__: Promise<void> | undefined;
}

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:55432/atc_tests";
const QUESTION_SEED_COMPLETED_KEY = "question_seed_completed";

function getInitialUsers() {
  if (process.env.NODE_ENV !== "production") {
    return DEVELOPMENT_INITIAL_USERS;
  }

  const users: Array<{
    username: string;
    displayName: string;
    password: string;
    role: "admin" | "editor";
  }> = [];

  const adminUsername = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD?.trim();
  const adminDisplayName = process.env.INITIAL_ADMIN_DISPLAY_NAME?.trim() || "Admin";

  if (adminUsername && adminPassword) {
    users.push({
      username: adminUsername,
      displayName: adminDisplayName,
      password: adminPassword,
      role: "admin",
    });
  }

  const editorUsername = process.env.INITIAL_EDITOR_USERNAME?.trim().toLowerCase();
  const editorPassword = process.env.INITIAL_EDITOR_PASSWORD?.trim();
  const editorDisplayName = process.env.INITIAL_EDITOR_DISPLAY_NAME?.trim() || "Editor";

  if (editorUsername && editorPassword) {
    users.push({
      username: editorUsername,
      displayName: editorDisplayName,
      password: editorPassword,
      role: "editor",
    });
  }

  return users;
}

function getPool() {
  if (!global.__atcPool__) {
    global.__atcPool__ = new Pool({
      connectionString,
    });
  }

  return global.__atcPool__;
}

async function createSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL,
      review_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      answer TEXT NOT NULL,
      question_type TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'vfr',
      source TEXT NOT NULL,
      source_reference TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS question_subjects (
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      PRIMARY KEY (question_id, subject_id)
    );

    CREATE TABLE IF NOT EXISTS question_stages (
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
      PRIMARY KEY (question_id, stage_id)
    );

    CREATE TABLE IF NOT EXISTS tests (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL,
      selection_mode TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'vfr',
      question_count INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      share_token TEXT UNIQUE,
      student_name TEXT,
      student_email TEXT,
      sent_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ,
      submitted_at TIMESTAMPTZ,
      graded_at TIMESTAMPTZ,
      graded_by_name TEXT,
      grade NUMERIC(5,2),
      grading_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS test_questions (
      id TEXT PRIMARY KEY,
      test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      question_id TEXT REFERENCES questions(id) ON DELETE SET NULL,
      order_index INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      expected_answer TEXT NOT NULL,
      subject_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      stage_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      student_answer TEXT,
      score NUMERIC(5,2),
      feedback TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    ALTER TABLE tests ADD COLUMN IF NOT EXISTS graded_by_name TEXT;
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'vfr';
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'vfr';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS review_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await client.query(`
    UPDATE questions
    SET unit = 'vfr'
    WHERE unit IS NULL OR unit = '';

    UPDATE tests
    SET unit = 'vfr'
    WHERE unit IS NULL OR unit = '';
  `);
}

async function seedUsers(client: PoolClient) {
  const result = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users");
  if (Number(result.rows[0]?.count ?? 0) > 0) {
    return;
  }

  const initialUsers = getInitialUsers();
  if (initialUsers.length === 0) {
    return;
  }

  const now = new Date();
  const insertQuery = `
    INSERT INTO users (id, username, display_name, email, role, password_hash, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (username) DO NOTHING
  `;

  for (const user of initialUsers) {
    await client.query(insertQuery, [
      nanoid(),
      user.username,
      user.displayName,
      null,
      user.role,
      bcrypt.hashSync(user.password, 10),
      now,
    ]);
  }
}

async function seedLookupTable(client: PoolClient, table: "subjects" | "stages", values: string[]) {
  const now = new Date();
  const insertQuery = `
    INSERT INTO ${table} (id, name, created_at, updated_at)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (name) DO NOTHING
  `;

  for (const value of values) {
    await client.query(insertQuery, [nanoid(), value, now, now]);
  }
}

async function upsertAppSetting(client: PoolClient, key: string, value: string) {
  await client.query(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [key, value],
  );
}

async function seedQuestions(client: PoolClient) {
  const seedStatus = await client.query<{ value: string }>("SELECT value FROM app_settings WHERE key = $1", [
    QUESTION_SEED_COMPLETED_KEY,
  ]);
  if (seedStatus.rows[0]?.value === "true") {
    return;
  }

  const result = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM questions");
  if (Number(result.rows[0]?.count ?? 0) > 0) {
    await upsertAppSetting(client, QUESTION_SEED_COMPLETED_KEY, "true");
    return;
  }

  const subjectsResult = await client.query<{ id: string; name: string }>("SELECT id, name FROM subjects");
  const stagesResult = await client.query<{ id: string; name: string }>("SELECT id, name FROM stages");
  const subjectMap = new Map(subjectsResult.rows.map((row) => [row.name, row.id]));
  const stageMap = new Map(stagesResult.rows.map((row) => [row.name, row.id]));
  const now = new Date();

  for (const question of getSeedQuestions()) {
    const questionId = nanoid();
    await client.query(
      `
        INSERT INTO questions (
          id, text, answer, question_type, source, source_reference, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8)
      `,
      [
        questionId,
        question.text,
        question.answer,
        question.questionType,
        question.source,
        question.sourceReference,
        now,
        now,
      ],
    );

    for (const subjectName of question.subjectNames) {
      const subjectId = subjectMap.get(subjectName);
      if (subjectId) {
        await client.query(
          "INSERT INTO question_subjects (question_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [questionId, subjectId],
        );
      }
    }

    for (const stageName of question.stageNames) {
      const stageId = stageMap.get(stageName);
      if (stageId) {
        await client.query(
          "INSERT INTO question_stages (question_id, stage_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [questionId, stageId],
        );
      }
    }
  }

  await upsertAppSetting(client, QUESTION_SEED_COMPLETED_KEY, "true");
}

async function seedSettings(client: PoolClient) {
  await client.query(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO NOTHING
    `,
    ["default_test_duration_minutes", String(DEFAULT_DURATION_MINUTES)],
  );
}

async function initializeDatabase() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await createSchema(client);
    await seedUsers(client);
    await seedLookupTable(client, "subjects", getSeedSubjects());
    await seedLookupTable(client, "stages", getSeedStages());
    await seedQuestions(client);
    await seedSettings(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureDatabaseInitialized() {
  if (!global.__atcDbInit__) {
    global.__atcDbInit__ = initializeDatabase();
  }

  return global.__atcDbInit__;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  await ensureDatabaseInitialized();
  return getPool().query<T>(text, values);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  await ensureDatabaseInitialized();
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
