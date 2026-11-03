import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authenticate, createSession, ensureAuthTables, SESSION_COOKIE, SESSION_MAX_AGE } from "@/src/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }
  await ensureAuthTables();
  const user = await authenticate(email, password);
  if (!user) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }
  const token = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE
  });
  return NextResponse.json({ user });
}
