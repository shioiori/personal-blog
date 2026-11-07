import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";
import { sql, once } from "./db";

// Shared chat-completion helper: tries Groq first (fast, generous free
// tier), and falls back to Gemini only when Groq fails for a reason that
// looks like exhausted quota/rate limiting — not for e.g. a malformed
// request, which should surface normally.
//
// Both providers are asked for a JSON object response so callers can treat
// the result uniformly regardless of which one answered.
//
// Once Groq is seen exhausted, that's cached (DB-backed, since API routes
// run as separate serverless invocations with no shared memory) so every
// later call skips straight to Gemini instead of paying for a doomed Groq
// request first. The cache expires at the start of the next calendar day
// (Postgres server date), matching Groq's daily quota reset.

const GEMINI_MODEL = "gemini-2.5-flash";

const ensureAiStateTable = once(async function ensureAiStateTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS ai_provider_state (
      provider       TEXT PRIMARY KEY,
      exhausted_date DATE
    )
  `;
});

async function isGroqExhaustedToday(): Promise<boolean> {
  await ensureAiStateTable();
  const rows = await sql`SELECT (exhausted_date = CURRENT_DATE) AS exhausted FROM ai_provider_state WHERE provider = 'groq'`;
  return rows[0]?.exhausted === true;
}

async function markGroqExhausted(): Promise<void> {
  await ensureAiStateTable();
  await sql`
    INSERT INTO ai_provider_state (provider, exhausted_date) VALUES ('groq', CURRENT_DATE)
    ON CONFLICT (provider) DO UPDATE SET exhausted_date = CURRENT_DATE
  `;
}

export interface AiCompleteOptions {
  groqModel: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  reasoningEffort?: "low" | "medium" | "high";
}

export interface AiCompleteResult {
  raw: string;
  provider: "groq" | "gemini";
}

function isQuotaOrRateLimitError(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  if (status === 429) return true;
  const message = String((e as { message?: unknown })?.message ?? e ?? "").toLowerCase();
  return message.includes("quota") || message.includes("rate limit") || message.includes("rate_limit");
}

async function completeWithGroq(opts: AiCompleteOptions): Promise<string> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await groq.chat.completions.create({
    model: opts.groqModel,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    ...(opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } : {}),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
  });
  return completion.choices[0]?.message?.content ?? "{}";
}

async function completeWithGemini(opts: AiCompleteOptions): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
    config: {
      systemInstruction: opts.systemPrompt,
      temperature: opts.temperature,
      maxOutputTokens: opts.maxTokens,
      responseMimeType: "application/json",
    },
  });
  return response.text ?? "{}";
}

// Throws if neither provider is configured/succeeds — callers already wrap
// this in their own try/catch and return a graceful empty response.
export async function aiComplete(opts: AiCompleteOptions): Promise<AiCompleteResult> {
  if (!process.env.GROQ_API_KEY) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GROQ_API_KEY not configured");
    return { raw: await completeWithGemini(opts), provider: "gemini" };
  }

  if (process.env.GEMINI_API_KEY && (await isGroqExhaustedToday())) {
    return { raw: await completeWithGemini(opts), provider: "gemini" };
  }

  try {
    return { raw: await completeWithGroq(opts), provider: "groq" };
  } catch (e) {
    if (!process.env.GEMINI_API_KEY || !isQuotaOrRateLimitError(e)) throw e;
    console.warn("[ai-complete] Groq quota/rate-limit hit, caching for today and falling back to Gemini:", e);
    await markGroqExhausted();
    return { raw: await completeWithGemini(opts), provider: "gemini" };
  }
}
