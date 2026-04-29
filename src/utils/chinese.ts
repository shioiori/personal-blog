export function buildReviewPrompt(allowedList: string, compoundWords?: string[]): string {
  const compoundSection =
    compoundWords && compoundWords.length > 0
      ? `\nKNOWN COMPOUND WORDS: ${compoundWords.join("、")}\nYou SHOULD prioritize using these compound words in your passage when possible. These are pre-approved multi-character combinations — treat them as units.\n`
      : "";

  return `You are a strict Chinese language teacher. Write a short Chinese passage of 3-10 sentences using ONLY the allowed characters below. Use Simplified Chinese characters only (简体字).
${compoundSection}
STRICT RULES:
1. You may ONLY use Chinese characters from this exact list: ${allowedList}
2. Do NOT use any Chinese character outside this list — not even common particles like 的、了、吗 unless they appear in the list.
3. Every sentence must be grammatically correct Simplified Chinese.
4. Output ONLY the Chinese passage, no explanations, no pinyin, no translation.
5. Do NOT hallucinate or fabricate content. Only write what can be accurately expressed using the allowed characters. If the allowed characters are too limited to form meaningful sentences, write simpler sentences rather than inventing meaning.

Allowed characters: ${allowedList}

Write a grammatically correct Simplified Chinese passage using ONLY these characters.`;
}
