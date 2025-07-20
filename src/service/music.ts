"use server";

import { NextResponse } from "next/server";

export async function getAudioFiles() {
  try {
    let audioFiles;
    try {
      audioFiles = await import("../../data/audio-files.json");
    } catch {
      return NextResponse.json({ files: [], count: 0 });
    }

    return NextResponse.json({
      files: audioFiles.default?.files || audioFiles.files || [],
      count: audioFiles.default?.files?.length || audioFiles.files?.length || 0
    });
  } catch (error) {
    console.error("Error loading audio files:", error);
    return NextResponse.json(
      { error: "Failed to load audio files", files: [] },
      { status: 500 }
    );
  }
}
