"use server";

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function getAudioFiles() {
  try {
    const audioDir = path.join(process.cwd(), "public/assets/audio");

    try {
      await fs.access(audioDir);
    } catch {
      await fs.mkdir(audioDir, { recursive: true });
      return NextResponse.json({ files: [] });
    }

    const allFiles = await fs.readdir(audioDir);

    const mp3Files = allFiles.filter((file) =>
      file.toLowerCase().endsWith(".mp3")
    );

    console.log(`Found ${mp3Files.length} MP3 files in assets/audio/`);
    mp3Files.forEach((file) => console.log(`- ${file}`));

    return NextResponse.json({
      files: mp3Files,
      count: mp3Files.length
    });
  } catch (error) {
    console.error("Error scanning audio directory:", error);
    return NextResponse.json(
      { error: "Failed to scan audio directory", files: [] },
      { status: 500 }
    );
  }
}
