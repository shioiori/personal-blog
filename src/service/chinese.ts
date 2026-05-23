"use server";

import Groq from "groq-sdk";
import { ensureTables, getCardStatesWithDate, getCompoundWords, ensureCompoundTables } from "@/src/lib/chinese-db";
import { buildReviewPrompt, getPassageLengthRange } from "@/src/utils/chinese";

const MIN_WORDS = 5;
const MAX_RETRIES = 3;

function isChinese(ch: string) {
  const code = ch.codePointAt(0)!;
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
}

function validateText(text: string, allowedChars: Set<string>): string[] {
  const violations: string[] = [];
  for (const ch of text) {
    if (isChinese(ch) && !allowedChars.has(ch)) {
      violations.push(ch);
    }
  }
  return [...new Set(violations)];
}

export type ReviewResult =
  | { status: "no_words" }
  | { status: "too_few"; learnedCount: number; minWords: number }
  | { status: "ok"; text: string; learnedCount: number };

// Top N recent chars to highlight in prompt
const RECENT_CHARS_LIMIT = 30;

export async function generateReviewText(prioritizeRecent = false): Promise<ReviewResult> {
  await ensureTables();
  await ensureCompoundTables();

  const [statesWithDate, compoundWords] = await Promise.all([getCardStatesWithDate(), getCompoundWords()]);

  const learnedRows = statesWithDate.filter((r) => r.hidden);

  if (learnedRows.length === 0) return { status: "no_words" };
  if (learnedRows.length < MIN_WORDS) {
    return { status: "too_few", learnedCount: learnedRows.length, minWords: MIN_WORDS };
  }

  const learnedChars = learnedRows.map((r) => r.char);
  const allowedSet = new Set(learnedChars);
  const allowedList = learnedChars.join("、");

  // Only include compound words whose characters are all in the learned set
  const eligibleCompounds = compoundWords
    .map((cw) => cw.word)
    .filter((word) => [...word].every((ch) => allowedSet.has(ch)));

  // Sort by updatedAt desc to get most recently learned chars
  const recentChars = prioritizeRecent
    ? learnedRows
        .slice()
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, RECENT_CHARS_LIMIT)
        .map((r) => r.char)
    : undefined;

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const systemPrompt = buildReviewPrompt(allowedList, eligibleCompounds, learnedChars.length, recentChars);
  const { min, max } = getPassageLengthRange(learnedChars.length);
  const recentNote = recentChars && recentChars.length > 0
    ? ` Prioritize using these recently learned characters: ${recentChars.join("、")}.`
    : "";
  const userPrompt = `Allowed characters: ${allowedList}\n\nWrite a grammatically correct Simplified Chinese passage of EXACTLY ${min}-${max} Chinese characters using ONLY these characters. The passage MUST contain at least ${min} Chinese characters.${recentNote}`;

  let text = "";
  let lastViolations: string[] = [];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    if (attempt > 0 && lastViolations.length > 0) {
      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content: `Your passage contains FORBIDDEN characters: ${lastViolations.join("、")}. These are NOT in the allowed list. Rewrite the entire passage from scratch without using any of these characters. Allowed characters only: ${allowedList}`,
      });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 2048,
      messages,
    });

    text = completion.choices[0]?.message?.content?.trim() ?? "";
    lastViolations = validateText(text, allowedSet);
    if (lastViolations.length === 0) break;
  }

  // Grammar check pass
  if (lastViolations.length === 0 && text) {
    const grammarCheck = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content: `You are a Simplified Chinese grammar expert. Fix any grammatical errors in the passage below. Use Simplified Chinese characters (简体字) only. You may ONLY use characters from this list: ${allowedList}. Do NOT add any new characters. Return only the corrected passage, no explanations.`,
        },
        { role: "user", content: text },
      ],
    });

    const corrected = grammarCheck.choices[0]?.message?.content?.trim() ?? "";
    if (corrected && validateText(corrected, allowedSet).length === 0) {
      text = corrected;
    }
  }

  return { status: "ok", text, learnedCount: learnedChars.length };
}
