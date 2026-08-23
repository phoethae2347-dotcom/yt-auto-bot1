require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const ROOT = __dirname;
const TTS_COMMAND = process.env.EDGE_TTS_PATH || "edge-tts";

async function runTTS(text, output, subtitles) {
  await execFileAsync(TTS_COMMAND, [
    "--voice", process.env.TTS_VOICE || "en-US-JennyNeural",
    "--text", text,
    "--write-media", output,
    "--write-subtitles", subtitles,
  ], { maxBuffer: 1024 * 1024 * 10 });
}

async function createVoice(text) {
  const voiceDir = path.join(ROOT, "voice");
  fs.mkdirSync(voiceDir, { recursive: true });
  const stamp = Date.now();
  const output = path.join(voiceDir, `voice_${stamp}.mp3`);
  const subtitles = path.join(voiceDir, `voice_${stamp}.srt`);

  for (let attempts = 1; attempts <= 3; attempts += 1) {
    try {
      await runTTS(text, output, subtitles);
      if (
        fs.existsSync(output) && fs.statSync(output).size > 5000 &&
        fs.existsSync(subtitles) && fs.statSync(subtitles).size > 100
      ) return { audioPath: output, subtitlesPath: subtitles };
      throw new Error("invalid audio");
    } catch (error) {
      console.log(`TTS retry ${attempts}:`, error.message || error);
      if (attempts < 3) await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  throw new Error("Edge TTS failed after 3 attempts");
}

module.exports = { createVoice, runTTS };
