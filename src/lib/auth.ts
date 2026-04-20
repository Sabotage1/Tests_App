import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { nanoid } from "nanoid";

import { QUESTION_UNITS, SESSION_COOKIE, type QuestionUnit } from "@/lib/constants";
import { query } from "@/lib/db";
import type { User } from "@/lib/types";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  role: "admin" | "editor" | "viewer";
  review_notifications_enabled: boolean;
  units: QuestionUnit[] | null;
};

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    reviewNotificationsEnabled: row.review_notifications_enabled,
    units: row.units ?? ["vfr", "ifr"],
  };
}

const getUserBySessionToken = cache(async (token: string): Promise<User | null> => {
  const result = await query<UserRow>(
    `
      SELECT u.id, u.username, u.display_name, u.email, u.role, u.review_notifications_enabled, u.units
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > NOW()
    `,
    [token],
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return mapUser(row);
});

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return getUserBySessionToken(token);
}

function isQuestionUnit(value: string | undefined): value is QuestionUnit {
  return value === "vfr" || value === "ifr";
}

export function getAccessibleUnitsForUser(user: Pick<User, "units">): QuestionUnit[] {
  const accessibleUnits = QUESTION_UNITS.filter((unit) => user.units.includes(unit));
  return accessibleUnits.length > 0 ? accessibleUnits : ["vfr"];
}

export function canUserAccessUnit(user: Pick<User, "units">, unit: QuestionUnit) {
  return getAccessibleUnitsForUser(user).includes(unit);
}

export function getDefaultUnitForUser(user: Pick<User, "units">): QuestionUnit {
  return getAccessibleUnitsForUser(user)[0] ?? "vfr";
}

export function getSelectedUnitForUser(user: Pick<User, "units">, requestedUnit?: string): QuestionUnit {
  return isQuestionUnit(requestedUnit) && canUserAccessUnit(user, requestedUnit)
    ? requestedUnit
    : getDefaultUnitForUser(user);
}

export function getUnitOrderForUser(user: Pick<User, "units">): QuestionUnit[] {
  const accessibleUnits = getAccessibleUnitsForUser(user);
  const defaultUnit = getDefaultUnitForUser(user);
  return [defaultUnit, ...accessibleUnits.filter((unit) => unit !== defaultUnit)];
}

export function assertUserCanAccessUnit(
  user: Pick<User, "units">,
  unit: QuestionUnit,
  errorMessage = "אין הרשאה ליחידה שנבחרה.",
) {
  if (!canUserAccessUnit(user, unit)) {
    throw new Error(errorMessage);
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  return user;
}

export async function requireEditor() {
  const user = await requireUser();

  if (user.role === "viewer") {
    redirect("/dashboard");
  }

  return user;
}

export async function createSession(userId: string) {
  const token = nanoid(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
  const isProduction = process.env.NODE_ENV === "production";

  await query(
    `
      INSERT INTO sessions (token, user_id, created_at, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [token, userId, now.toISOString(), expiresAt.toISOString()],
  );

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: expiresAt,
  });
}

export async function clearSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const isProduction = process.env.NODE_ENV === "production";
  if (token) {
    await query("DELETE FROM sessions WHERE token = $1", [token]);
  }

  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    expires: new Date(0),
  });
}
