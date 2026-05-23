export function getPassageLengthRange(learnedCount: number): { min: number; max: number } {
  if (learnedCount > 1000) return { min: 500, max: 700 };
  if (learnedCount > 750) return { min: 300, max: 500 };
  if (learnedCount > 250) return { min: 100, max: 300 };
  return { min: 50, max: 100 };
}

export function buildReviewPrompt(allowedList: string, compoundWords?: string[], learnedCount?: number, recentChars?: string[]): string {
  const compoundSection =
    compoundWords && compoundWords.length > 0
      ? `\nKNOWN COMPOUND WORDS: ${compoundWords.join("、")}\nYou SHOULD prioritize using these compound words in your passage when possible. These are pre-approved multi-character combinations — treat them as units.\n`
      : "";

  const recentSection =
    recentChars && recentChars.length > 0
      ? `\nRECENTLY LEARNED CHARACTERS (prioritize these): ${recentChars.join("、")}\nThese characters were learned most recently. You MUST use as many of these as possible in the passage. Build the story around them.\n`
      : "";

  const { min, max } = getPassageLengthRange(learnedCount ?? 0);

  return `You are a strict Chinese language teacher. Write a Chinese passage of ${min}-${max} Chinese characters using ONLY the allowed characters below. Use Simplified Chinese characters only (简体字).
${compoundSection}${recentSection}
STRICT RULES:
1. You may ONLY use Chinese characters from this exact list: ${allowedList}
2. Do NOT use any Chinese character outside this list — not even common particles like 的、了、吗 unless they appear in the list.
3. Every sentence must be grammatically correct Simplified Chinese.
4. The passage must be between ${min} and ${max} Chinese characters long.
5. Output ONLY the Chinese passage, no explanations, no pinyin, no translation.
6. Do NOT hallucinate or fabricate content. Only write what can be accurately expressed using the allowed characters. If the allowed characters are too limited to form meaningful sentences, write simpler sentences rather than inventing meaning.

Allowed characters: ${allowedList}

Write a grammatically correct Simplified Chinese passage of ${min}-${max} characters using ONLY these characters.`;
}
