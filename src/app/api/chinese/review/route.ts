import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ensureTables, getCardStates } from "@/src/lib/chinese-db";
import { getAllCharacters } from "@/src/data/chinese";

const MIN_WORDS = 5;

function getSession(req: NextRequest): string {
  return req.cookies.get("chinese_session")?.value ?? crypto.randomUUID();
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    const sessionId = getSession(req);
    const states = await getCardStates(sessionId);

    const learnedChars = Object.entries(states)
      .filter(([, hidden]) => hidden)
      .map(([char]) => char);

    if (learnedChars.length === 0) {
      return NextResponse.json({ error: "no_words", learnedCount: 0 });
    }
    if (learnedChars.length < MIN_WORDS) {
      return NextResponse.json({ error: "too_few", learnedCount: learnedChars.length, minWords: MIN_WORDS });
    }

    const allChars = getAllCharacters();
    const charMap = new Map(allChars.map((c) => [c.char, c]));
    const learnedWords = learnedChars
      .map((c) => charMap.get(c))
      .filter(Boolean)
      .map((c) => `${c!.char} (${c!.pinyin}: ${c!.meaning})`);

    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: `Bạn là giáo viên tiếng Trung. Nhiệm vụ: tạo một đoạn văn ngắn 3-5 câu tiếng Trung đơn giản, đúng ngữ pháp, chỉ dùng các từ trong danh sách từ vựng được cung cấp. Bạn được phép dùng thêm các hư từ cơ bản (的、了、吗、是、在、有、和、也、都、不、很、吧、呢) nhưng không được thêm từ thực nào khác ngoài danh sách. Trả về chỉ đoạn văn tiếng Trung, không giải thích gì thêm.`,
      messages: [
        {
          role: "user",
          content: `Danh sách từ vựng đã học:\n${learnedWords.join("\n")}\n\nHãy tạo một đoạn văn ngắn 3-5 câu tiếng Trung chỉ dùng các từ trên.`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const res = NextResponse.json({ text, learnedCount: learnedChars.length });
    res.cookies.set("chinese_session", sessionId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
