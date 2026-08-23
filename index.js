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
const ffprobePath = process.env.FFPROBE_PATH || "ffprobe";
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
function cleanup(voiceFile, subtitlesFile) {
  for (const file of [voiceFile, subtitlesFile]) {
    try {
      if (file && fs.existsSync(file)) fs.unlinkSync(file);
    } catch (e) {
      console.log("Cleanup warning:", e.message);
    }
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
function getEditingPreset(format, seed = Date.now()) {
  const presets = {
    myth_reality: {
      transitions: ["wipeleft", "slideright", "fade"],
      zooms: ["in", "out", "in", "hold"],
      labels: ["THE ASSUMPTION", "LOOK CLOSER", "TRY THIS", "REFLECT"],
    },
    mini_case: {
      transitions: ["dissolve", "circleopen", "fadeblack"],
      zooms: ["out", "in", "hold", "out"],
      labels: ["THE MOMENT", "THE PATTERN", "THE SKILL", "THE TEST"],
    },
    conversation_script: {
      transitions: ["slideright", "wipeleft", "fade"],
      zooms: ["hold", "in", "out", "in"],
      labels: ["NOTICE", "SAY THIS", "WHY IT HELPS", "CHECK IN"],
    },
    practical_checklist: {
      transitions: ["fadeblack", "wipeleft", "slideright"],
      zooms: ["in", "hold", "out", "in"],
      labels: ["STEP 1", "STEP 2", "STEP 3", "REVIEW"],
    },
    reflective_letter: {
      transitions: ["fade", "dissolve", "circleclose"],
      zooms: ["out", "hold", "in", "out"],
      labels: ["PAUSE", "REMEMBER", "LEARN", "ONE NEXT STEP"],
    },
    three_part_lesson: {
      transitions: ["wipeleft", "dissolve", "slideright"],
      zooms: ["in", "out", "hold", "in"],
      labels: ["PART 1", "PART 2", "PART 3", "PRACTICE"],
    },
    journal_prompt: {
      transitions: ["circleopen", "fadeblack", "wipeleft"],
      zooms: ["hold", "out", "in", "hold"],
      labels: ["NOTICE", "NAME IT", "WRITE", "TAKE IT WITH YOU"],
    },
  };
  const base = presets[format] || presets.myth_reality;
  const seedText = String(seed);
  const variant = [...seedText].reduce((total, character) => total + character.charCodeAt(0), 0) % 3;
  const rotate = (items, amount) => items.map((_, index) => items[(index + amount) % items.length]);
  return {
    ...base,
    variant,
    transitions: rotate(base.transitions, variant),
    zooms: rotate(base.zooms, (variant + 1) % base.zooms.length),
  };
}

function escapeDrawText(text) {
  return String(text).replace(/([\\':])/g, "\\$1");
}

function escapeSubtitlePath(file) {
  return String(file).replace(/([\\:'])/g, "\\$1");
}

function zoomExpression(mode) {
  if (mode === "out") return "if(eq(on,0),1.12,max(zoom-0.0008,1.0))";
  if (mode === "hold") return "1.045";
  return "min(zoom+0.0008,1.12)";
}

async function getMediaDuration(file) {
  const { stdout } = await execFileAsync(ffprobePath, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Invalid media duration: ${file}`);
  return duration;
}

async function createVideo(images, audio, music, output, subtitlesPath, brief) {
  if (!Array.isArray(images) || images.length !== 4) throw new Error("Exactly four images are required");
  const width = Number(process.env.VIDEO_WIDTH || 1080);
  const height = Number(process.env.VIDEO_HEIGHT || 1920);
  const fps = Number(process.env.VIDEO_FPS || 24);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 360 || height < 640) {
    throw new Error("VIDEO_WIDTH/VIDEO_HEIGHT must be valid vertical dimensions");
  }
  const sourceWidth = Math.ceil(width * 4 / 3);
  const sourceHeight = Math.ceil(height * 4 / 3);
  const audioDuration = await getMediaDuration(audio);
  const transitionDuration = 1;
  const segmentSeconds = (audioDuration + transitionDuration * (images.length - 1)) / images.length;
  const framesPerSegment = Math.max(1, Math.round(segmentSeconds * fps));
  const preset = getEditingPreset(brief?.format, `${brief?.id || "video"}:${Date.now()}`);
  const args = ["-y"];
  for (const image of images) {
    // Feed one source frame; zoompan expands it to the calculated scene duration.
    args.push("-loop", "1", "-t", "1", "-framerate", "1", "-i", image);
  }
  args.push("-i", audio);
  if (music) args.push("-i", music);

  const filterParts = images.map((_, index) => {
    const label = escapeDrawText(preset.labels[index] || `SCENE ${index + 1}`);
    const fontSize = Math.max(28, Math.round(width / 25));
    const margin = Math.max(36, Math.round(width / 15));
    return `[${index}:v]scale=${sourceWidth}:${sourceHeight}:force_original_aspect_ratio=increase,crop=${sourceWidth}:${sourceHeight},zoompan=z='${zoomExpression(preset.zooms[index])}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${framesPerSegment}:s=${width}x${height}:fps=${fps},setsar=1,drawbox=x=0:y=0:w=iw:h=ih:color=black@0.10:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='${label}':fontcolor=white:fontsize=${fontSize}:borderw=3:bordercolor=black@0.75:x=${margin}:y=${margin}:enable='between(t,0,4)'[v${index}]`;
  });

  let currentVideo = "v0";
  for (let index = 1; index < images.length; index += 1) {
    const previous = currentVideo;
    const outputLabel = `x${index}`;
    const transition = preset.transitions[index - 1];
    const offset = Number(((segmentSeconds - transitionDuration) * index).toFixed(3));
    filterParts.push(`[${previous}][v${index}]xfade=transition=${transition}:duration=${transitionDuration}:offset=${offset}[${outputLabel}]`);
    currentVideo = outputLabel;
  }

  if (subtitlesPath && fs.existsSync(subtitlesPath)) {
    const subtitleFile = escapeSubtitlePath(subtitlesPath);
    const subtitleSize = Math.max(14, Math.round(width / 60));
    const subtitleMargin = Math.max(80, Math.round(height / 10));
    filterParts.push(`[${currentVideo}]subtitles='${subtitleFile}':force_style='FontName=DejaVu Sans,FontSize=${subtitleSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=${subtitleMargin}'[v]`);
  } else {
    filterParts.push(`[${currentVideo}]format=yuv420p[v]`);
  }

  const audioIndex = images.length;
  filterParts.push(
    music
      ? `[${audioIndex}:a]loudnorm=I=-16:TP=-1.5:LRA=11,acompressor=threshold=-18dB:ratio=2:attack=20:release=250[a1]`
      : `[${audioIndex}:a]loudnorm=I=-16:TP=-1.5:LRA=11,acompressor=threshold=-18dB:ratio=2:attack=20:release=250[a]`,
  );
  if (music) {
    filterParts.push(`[${audioIndex + 1}:a]volume=0.06[a2]`, "[a1][a2]amix=inputs=2:duration=first:dropout_transition=0[a]");
  }

  args.push(
    "-filter_complex", filterParts.join(";"),
    "-map", "[v]",
    "-map", "[a]",
    "-shortest",
    "-t", audioDuration.toFixed(3),
    "-c:v", "libx264",
    "-preset", process.env.FFMPEG_PRESET || "medium",
    "-crf", "20",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-pix_fmt", "yuv420p",
    output,
  );

  console.log(`Running FFmpeg with ${brief?.format || "default"} edit preset variant ${preset.variant}...`);
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
  let subtitlesFile = null;

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
    const voice = await createVoice(script);
    voiceFile = voice.audioPath;
    subtitlesFile = voice.subtitlesPath;
    console.log("Voice file:", voiceFile);
    console.log("Subtitle file:", subtitlesFile);

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

    await createVideo(images, voiceFile, music, out, subtitlesFile, brief);

    if (!fs.existsSync(out)) {
      throw new Error("Video file was not created");
    }

    const videoSize = (fs.statSync(out).size / (1024 * 1024)).toFixed(2);
    const sourceAudioDuration = await getMediaDuration(voiceFile);
    const renderedVideoDuration = await getMediaDuration(out);
    const durationDelta = Math.abs(renderedVideoDuration - sourceAudioDuration);
    console.log(`Video created: ${out} (${videoSize} MB, ${renderedVideoDuration.toFixed(3)}s)`);
    if (durationDelta > 1.5) {
      throw new Error(`Video duration mismatch: audio=${sourceAudioDuration.toFixed(3)}s video=${renderedVideoDuration.toFixed(3)}s`);
    }

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
    cleanup(voiceFile, subtitlesFile);
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