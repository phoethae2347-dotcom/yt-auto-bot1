const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const ROOT = __dirname;
const TTS_COMMAND = process.env.EDGE_TTS_PATH || "edge-tts";
const NEWLINE = String.fromCharCode(10);
const CARRIAGE_RETURN = String.fromCharCode(13);

async function runTTS(text, output, subtitles) {
  await execFileAsync(TTS_COMMAND, [
    "--voice", process.env.TTS_VOICE || "en-US-JennyNeural",
    "--text", text,
    "--write-media", output,
    "--write-subtitles", subtitles,
  ], { maxBuffer: 1024 * 1024 * 10 });
}

function parseSrtTime(value) {
  const match = String(value).match(/([0-9]{2}):([0-9]{2}):([0-9]{2}),([0-9]{3})/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

function formatSrtTime(seconds) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const milliseconds = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

function normalizeSubtitles(input, output, maxWords = 7) {
  const raw = fs.readFileSync(input, "utf8").split(CARRIAGE_RETURN).join("").trim();
  const blocks = raw.split(new RegExp(NEWLINE + "[ ]*" + NEWLINE)).map(block => {
    const lines = block.split(NEWLINE);
    const timingIndex = lines.findIndex(line => line.includes(" --> "));
    if (timingIndex < 0) return null;
    const [startRaw, endRaw] = lines[timingIndex].split(" --> ");
    const start = parseSrtTime(startRaw);
    const end = parseSrtTime(endRaw);
    const text = lines.slice(timingIndex + 1).join(" ").replace(/<[^>]+>/g, " ").replace(/[ ]+/g, " ").trim();
    if (start === null || end === null || !text) return null;
    return { start, end, words: text.split(" ") };
  }).filter(Boolean);

  const normalized = [];
  for (const block of blocks) {
    const chunks = [];
    for (let index = 0; index < block.words.length; index += maxWords) {
      chunks.push(block.words.slice(index, index + maxWords).join(" "));
    }
    const duration = Math.max(0.2, block.end - block.start);
    const wordsTotal = block.words.length;
    let cursor = block.start;
    chunks.forEach((text, index) => {
      const remaining = chunks.length - index;
      const wordsInChunk = text.split(" ").length;
      const share = remaining === 1 ? block.end - cursor : Math.max(0.2, duration * wordsInChunk / wordsTotal);
      const end = Math.min(block.end, cursor + share);
      normalized.push({ start: cursor, end, text });
      cursor = end;
    });
  }

  const serialized = normalized
    .map((cue, index) => `${index + 1}${NEWLINE}${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}${NEWLINE}${cue.text}`)
    .join(NEWLINE + NEWLINE);
  fs.writeFileSync(output, serialized + NEWLINE);
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
      normalizeSubtitles(subtitles, subtitles);
      if (
        fs.existsSync(output) && fs.statSync(output).size > 5000 &&
        fs.existsSync(subtitles) && fs.statSync(subtitles).size > 100
      ) return { audioPath: output, subtitlesPath: subtitles };
      throw new Error("invalid audio or subtitle output");
    } catch (error) {
      console.log(`TTS retry ${attempts}:`, error.message || error);
      if (attempts < 3) await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  throw new Error("Edge TTS failed after 3 attempts");
}

module.exports = { createVoice, formatSrtTime, normalizeSubtitles, parseSrtTime, runTTS };
