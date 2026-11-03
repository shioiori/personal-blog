import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth";

export async function GET() {
  try {
    return NextResponse.json({ user: await getCurrentUser() });
  } catch {
    return NextResponse.json({ user: null });
  }
}
