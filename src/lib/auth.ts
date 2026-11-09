import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sql, once } from "./db";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export interface AuthUser {
  id: number;
  email: string;
  premiumExpire: Date | null;
}

export const ensureAuthTables = once(async function ensureAuthTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_expire TIMESTAMPTZ`;
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;
});

export function isPremium(user: Pick<AuthUser, "premiumExpire"> | null): boolean {
  return !!user?.premiumExpire && user.premiumExpire.getTime() > Date.now();
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function authenticate(email: string, password: string): Promise<AuthUser | null> {
  const rows = await sql`SELECT id, email, password_hash, premium_expire FROM users WHERE email = ${email.trim().toLowerCase()}`;
  if (!rows[0] || !verifyPassword(password, rows[0].password_hash as string)) return null;
  return { id: rows[0].id as number, email: rows[0].email as string, premiumExpire: (rows[0].premium_expire as Date | null) ?? null };
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await sql`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${hashToken(token)}, ${userId}, NOW() + (${SESSION_MAX_AGE} || ' seconds')::interval)
  `;
  await sql`DELETE FROM sessions WHERE expires_at < NOW()`;
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await sql`
    SELECT u.id, u.email, u.premium_expire FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > NOW()
  `;
  if (!rows[0]) return null;
  return { id: rows[0].id as number, email: rows[0].email as string, premiumExpire: (rows[0].premium_expire as Date | null) ?? null };
}

export async function getUserId(): Promise<number | null> {
  return (await getCurrentUser())?.id ?? null;
}

export function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
