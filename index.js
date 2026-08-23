require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const TelegramBot = require("node-telegram-bot-api");
const { createVoice } = require("./createVoice");
const { uploadVideo } = require("./upload");
const { downloadFreshImages } = require("./image-source");

const bot = process.env.BOT_TOKEN ? new TelegramBot(process.env.BOT_TOKEN, { polling: false }) : null;
const CHAT_ID = process.env.CHAT_ID;
const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
const ROOT = __dirname;
const CONTENT_NOTE = "This video contains original commentary generated with AI-assisted tools and synthetic narration. The topic is presented for general reflection and is not professional advice.";
const CONTENT_BRIEFS_PATH = path.join(ROOT, "content-briefs.json");

// ===== GOOGLE AUTH =====
if (process.env.GOOGLE_CREDENTIALS) {
  fs.writeFileSync(path.join(ROOT, "credentials.json"), process.env.GOOGLE_CREDENTIALS.replace(/\\n/g, "\n"));
}
if (process.env.GOOGLE_TOKEN) {
  fs.writeFileSync(path.join(ROOT, "token.json"), process.env.GOOGLE_TOKEN.replace(/\\n/g, "\n"));
}

// ===== NOTIFY =====
async function notify(msg) {
  try {
    if (CHAT_ID && bot) await bot.sendMessage(CHAT_ID, msg);
  } catch (e) {
    console.log("Notify failed:", e.message);
  }
}

// ===== SETUP =====
["voice", "output"].forEach(d => {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});



// ===== HELPERS =====
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ✅ FIX: Shuffle array randomly
function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ===== SCRIPT ENGINE =====
function loadContentBriefs() {
  if (!fs.existsSync(CONTENT_BRIEFS_PATH)) {
    throw new Error('content-briefs.json is required');
  }

  const data = JSON.parse(fs.readFileSync(CONTENT_BRIEFS_PATH, 'utf8'));
  if (!Array.isArray(data.briefs) || data.briefs.length < 4) {
    throw new Error('content-briefs.json must contain at least four editorial briefs');
  }
  const requiredFields = ['id', 'format', 'topic', 'opening', 'scene', 'lesson', 'insight', 'action', 'question'];
  for (const brief of data.briefs) {
    for (const field of requiredFields) {
      const minimumLength = field === 'format' ? 1 : field === 'topic' ? 3 : 12;
      if (typeof brief[field] !== 'string' || brief[field].trim().length < minimumLength) {
        throw new Error(`Brief ${brief.id || 'unknown'} is missing an educational ${field}`);
      }
    }
  }
  return data.briefs;
}

function pickBrief(briefs) {
  const requestedFormat = process.env.CONTENT_FORMAT;
  const pool = requestedFormat
    ? briefs.filter(brief => brief.format === requestedFormat)
    : briefs;
  if (pool.length === 0) throw new Error(`No briefs found for format: ${requestedFormat}`);
  return pick(pool);
}

function renderBrief(brief) {
  const formatSections = {
    myth_reality: [
      brief.opening,
      'Let us slow down and separate the feeling from the conclusion.',
      `The common assumption is easy to make: ${brief.scene}`,
      `The practical lesson is this: ${brief.lesson}`,
      `A more careful reading is this: ${brief.insight}`,
      `Instead of rushing to a verdict, try this: ${brief.action}`,
      `Keep this question with you: ${brief.question}`,
    ],
    mini_case: [
      'Here is a small situation that is easy to recognize.',
      brief.scene,
      `At first, the story seems to be about the moment. The deeper issue may be this: ${brief.insight}`,
      `The skill being taught is: ${brief.lesson}`,
      `The next useful move is simple: ${brief.action}`,
      `Before you decide what it means, ask yourself: ${brief.question}`,
    ],
    conversation_script: [
      brief.opening,
      brief.scene,
      `You could say: “${brief.action}”`,
      `Why this helps: ${brief.lesson}`,
      `That sentence creates room for a real conversation because it focuses on your boundary rather than trying to control the other person. ${brief.insight}`,
      `If the conversation starts again, return to this question: ${brief.question}`,
    ],
    practical_checklist: [
      brief.opening,
      `First, notice the evidence instead of the story you are telling yourself: ${brief.scene}`,
      `Second, name the pattern without exaggerating it: ${brief.insight}`,
      `Why this checklist matters: ${brief.lesson}`,
      `Third, choose one small experiment: ${brief.action}`,
      `Then review what you learned by asking: ${brief.question}`,
    ],
    reflective_letter: [
      brief.opening,
      'Dear you,',
      brief.scene,
      `What this moment can teach you: ${brief.lesson}`,
      `You are allowed to hold two truths at once: ${brief.insight}`,
      `For today, let your next step be gentle and specific: ${brief.action}`,
      `When nostalgia or fear gets loud, come back to this question: ${brief.question}`,
    ],
    three_part_lesson: [
      brief.opening,
      `First, look at the situation itself: ${brief.scene}`,
      `Second, learn the principle underneath it: ${brief.lesson}`,
      `Third, look at the pattern underneath it: ${brief.insight}`,
      `Finally, choose a response that protects clarity and dignity: ${brief.action}`,
      `The question that connects all three parts is: ${brief.question}`,
    ],
    journal_prompt: [
      brief.opening,
      brief.scene,
      `The lesson behind this prompt is: ${brief.lesson}`,
      `Write without trying to sound reasonable: ${brief.insight}`,
      `Now complete this prompt: “The next honest step I can take is…” ${brief.action}`,
      `End with this question: ${brief.question}`,
    ],
  };

  const sections = formatSections[brief.format];
  if (!sections) throw new Error(`Unsupported content format: ${brief.format}`);
  return sections.join('\n\n');
}

function generateContent() {
  const brief = pickBrief(loadContentBriefs());
  return { brief, script: renderBrief(brief) };
}

function generateScript() {
  return generateContent().script;
}

// ===== TITLE & DESCRIPTION =====
function buildTitle(script, brief) {
  const hook = script.split("\n")[0].replace(/[.!?]+$/, "").trim();
  const label = brief?.topic ? ` | ${brief.topic.replace(/\b\w/g, letter => letter.toUpperCase())}` : " | Relationship Reflection";
  return `${hook}${label}`.substring(0, 100);
}

function buildDescription(script, manifest, brief) {
  const topics = brief?.topic ? ["relationships", brief.topic, "emotional wellbeing"] : ["relationships", "self-worth", "emotional wellbeing"];
  const assetCredits = manifest.credits || "All visual and audio assets are used under the permissions recorded in asset-licenses.json.";
  return [
    "A short, original reflection about relationships and self-worth.",
    "",
    script,
    "",
    "This is general reflection, not therapy, medical, legal, or professional advice. Please use your own judgment and seek qualified support when needed.",
    "",
    CONTENT_NOTE,
    "",
    assetCredits,
    "",
    `Topics: ${topics.join(", ")}`,
    "#relationships #selfworth #emotionalwellbeing",
  ].join("\n");
}

// ===== ASSETS =====
async function getFreshAssets() {
  return downloadFreshImages({ count: 4 });
}

// ===== AUDIO CHECK =====
function okAudio(f) {
  try {
    return fs.statSync(f).size > 5000;
  } catch {
    return false;
  }
}

// ===== CLEANUP =====
// ✅ NEW: Clean up old temp files to save space
function cleanup(voiceFile) {
  try {
    if (voiceFile && fs.existsSync(voiceFile)) fs.unlinkSync(voiceFile);
  } catch (e) {
    console.log("Cleanup warning:", e.message);
  }

  // Remove output videos older than 1 day
  try {
    const outputDir = path.join(ROOT, "output");
    const outputs = fs.readdirSync(outputDir).filter(f => f.endsWith(".mp4"));
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    outputs.forEach(f => {
      const fullPath = path.join(outputDir, f);
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs < oneDayAgo) {
        fs.unlinkSync(fullPath);
        console.log("Cleaned old video:", f);
      }
    });
  } catch (e) {
    console.log("Output cleanup warning:", e.message);
  }
}

// ===== VIDEO =====
async function createVideo(images, audio, music, output) {
  const args = ["-y"];
  for (const image of images) {
    args.push("-loop", "1", "-t", "30", "-framerate", "24", "-i", image);
  }
  args.push("-i", audio);
  if (music) args.push("-i", music);

  const filterParts = [
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=24[v0]",
    "[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=24[v1]",
    "[2:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=24[v2]",
    "[3:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=24[v3]",
    "[v0][v1]xfade=transition=fade:duration=1:offset=29[v01]",
    "[v01][v2]xfade=transition=fade:duration=1:offset=58[v02]",
    "[v02][v3]xfade=transition=fade:duration=1:offset=87,format=yuv420p[v]",
    music
      ? "[4:a]volume=1[a1]"
      : "[4:a]anull[a]",
    ...(music ? [
      "[5:a]volume=0.08[a2]",
      "[a1][a2]amix=inputs=2:duration=first:dropout_transition=0[a]",
    ] : []),
  ].join(";");

  args.push(
    "-filter_complex", filterParts,
    "-map", "[v]",
    "-map", "[a]",
    "-shortest",
    "-c:v", "libx264",
    "-preset", process.env.FFMPEG_PRESET || "medium",
    "-crf", "20",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-pix_fmt", "yuv420p",
    output,
  );

  console.log("Running FFmpeg...");
  try {
    await execFileAsync(ffmpegPath, args, { maxBuffer: 1024 * 1024 * 100 });
  } catch (error) {
    const detail = error.stderr || error.message;
    throw new Error(`FFmpeg failed: ${detail.slice(-500)}`);
  }
}

// ===== MAIN =====
async function run() {
  let voiceFile = null;

  try {
    console.log("===== START RUN =====");
    console.log("Time:", new Date().toISOString());

    // 1. Generate an original script from the channel's reviewed topic set.
    const content = generateContent();
    const { script, brief } = content;
    console.log("Brief:", brief.id, `(${brief.format})`);
    console.log("Hook:", script.split("\n")[0]);

    // 2. Create voice
    await notify("Generating narration...");
    voiceFile = await createVoice(script);
    console.log("Voice file:", voiceFile);

    if (!okAudio(voiceFile)) {
      throw new Error(`Audio file invalid or too small: ${voiceFile}`);
    }

    // 3. Download a fresh set of source-verified images for this run.
    const assets = await getFreshAssets();
    const images = assets.images;
    const music = null;
    console.log("Fresh images downloaded:", images);
    console.log("Music selected:", "none (narration-only mix)");

    // 4. Create video
    await notify("🎬 Creating video...");
    const out = path.join(ROOT, "output", `video_${Date.now()}.mp4`);

    await createVideo(images, voiceFile, music, out);

    if (!fs.existsSync(out)) {
      throw new Error("Video file was not created");
    }

    const videoSize = (fs.statSync(out).size / (1024 * 1024)).toFixed(2);
    console.log(`Video created: ${out} (${videoSize} MB)`);

    // 5. Upload
    await notify(`☁️ Uploading video (${videoSize} MB)...`);
    const title = buildTitle(script, brief);
    const description = buildDescription(script, assets, brief);
    console.log("Title:", title);

    if (process.env.SKIP_UPLOAD === "true") {
      console.log("SKIP_UPLOAD=true; keeping local preview without YouTube upload");
      await notify(`Preview ready (not uploaded).\nTitle: ${title}`);
    } else {
      const privacyStatus = process.env.UPLOAD_PRIVACY_STATUS || "private";
      await uploadVideo(out, {
        title,
        description,
        tags: ["relationships", "self-worth", "emotional wellbeing"],
        privacyStatus,
        containsSyntheticMedia: true,
      });
      await notify(`Upload complete (${privacyStatus}).\nTitle: ${title}`);
    }
    console.log("===== DONE =====");

  } catch (e) {
    console.log("ERROR:", e.message);
    await notify("❌ ERROR: " + e.message);
  } finally {
    // ✅ Always cleanup temp files
    cleanup(voiceFile);
  }
}

if (require.main === module) {
  run().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildDescription,
  buildTitle,
  createVideo,
  generateContent,
  generateScript,
  getFreshAssets,
  loadContentBriefs,
  renderBrief,
};