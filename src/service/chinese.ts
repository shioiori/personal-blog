"use server";

import Groq from "groq-sdk";
import { ensureTables, getCardStates } from "@/src/lib/chinese-db";
import { getAllCharacters } from "@/src/data/chinese";

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

export async function generateReviewText(sessionId: string): Promise<ReviewResult> {
  await ensureTables();
  const states = await getCardStates(sessionId);

  const learnedChars = Object.entries(states)
    .filter(([, hidden]) => hidden)
    .map(([char]) => char);

  if (learnedChars.length === 0) return { status: "no_words" };
  if (learnedChars.length < MIN_WORDS) {
    return { status: "too_few", learnedCount: learnedChars.length, minWords: MIN_WORDS };
  }

  const allChars = getAllCharacters();
  const charMap = new Map(allChars.map((c) => [c.char, c]));
  const learnedWords = learnedChars
    .map((c) => charMap.get(c))
    .filter(Boolean)
    .map((c) => `${c!.char} (${c!.pinyin}: ${c!.meaning})`);

  const allowedSet = new Set(learnedChars);
  const allowedList = learnedChars.join("、");

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const systemPrompt = `You are a strict Chinese language teacher. Write a short Chinese passage of 3-5 sentences using ONLY the allowed characters below.

STRICT RULES:
1. You may ONLY use Chinese characters from this exact list: ${allowedList}
2. Do NOT use any Chinese character outside this list — not even common particles like 的、了、吗 unless they appear in the list.
3. Every sentence must be grammatically correct Chinese.
4. Output ONLY the Chinese passage, no explanations, no pinyin, no translation.`;

  const userPrompt = `Allowed characters with meanings:\n${learnedWords.join("\n")}\n\nWrite a grammatically correct Chinese passage using ONLY these characters.`;

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
      max_tokens: 512,
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
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content: `You are a Chinese grammar expert. Fix any grammatical errors in the passage below. You may ONLY use characters from this list: ${allowedList}. Do NOT add any new characters. Return only the corrected passage, no explanations.`,
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
