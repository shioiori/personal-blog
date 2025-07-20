const fs = require("fs");
const path = require("path");

const audioDir = path.join(process.cwd(), "public/assets/audio");
const outputPath = path.join(process.cwd(), "data/audio-files.json");

try {
  const files = fs.readdirSync(audioDir);
  const mp3Files = files.filter((file) => file.toLowerCase().endsWith(".mp3"));

  const dataDir = path.dirname(outputPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify({ files: mp3Files }));
  console.log(`Generated audio file list with ${mp3Files.length} files`);
} catch (error) {
  console.error("Error generating audio file list:", error);
}
