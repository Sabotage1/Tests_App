import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { nanoid } from "nanoid";

import { SESSION_COOKIE } from "@/lib/constants";
import { query } from "@/lib/db";
import type { User } from "@/lib/types";

function mapUser(row: {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  role: "admin" | "editor";
}): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
  };
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const result = await query<{
    id: string;
    username: string;
    display_name: string;
    email: string | null;
    role: "admin" | "editor";
  }>(
    `
      SELECT u.id, u.username, u.display_name, u.email, u.role
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

export async function createSession(userId: string) {
  const token = nanoid(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);

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
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await query("DELETE FROM sessions WHERE token = $1", [token]);
  }

  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}
