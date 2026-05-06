require("dotenv").config();
const fs = require("fs");
const { exec } = require("child_process");
const TelegramBot = require("node-telegram-bot-api");
const { createVoice } = require("./createVoice");
const { uploadVideo } = require("./upload");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const CHAT_ID = process.env.CHAT_ID;
const ffmpegPath = "ffmpeg";

// ===== NOTIFY =====
async function notify(msg) {
  try {
    if (CHAT_ID) await bot.sendMessage(CHAT_ID, msg);
  } catch {}
}

// ===== SETUP =====
["voice", "output", "images", "music"].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d);
});

// ===== GOOGLE AUTH =====
if (process.env.GOOGLE_CREDENTIALS) {
  fs.writeFileSync("credentials.json", process.env.GOOGLE_CREDENTIALS);
}
if (process.env.GOOGLE_TOKEN) {
  fs.writeFileSync("token.json", process.env.GOOGLE_TOKEN);
}

// ===== TITLE =====
function cleanTitle(text) {
  return text
    .replace(/\n/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim()
    .substring(0, 80);
}

// ===== VIRAL SCRIPT ENGINE =====
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const hooks = [
  "If they do this, they were never serious about you.",
  "This is the biggest dating mistake people ignore.",
  "One sign someone is emotionally unavailable.",
  "If they make you feel this way, walk away immediately.",
  "This truth will save you years of heartbreak."
];

const patterns = [
  {
    setup: "They text you at night but ignore you during the day.",
    twist: "That is not love. That is convenience.",
    lesson: "Real interest shows consistency."
  },
  {
    setup: "They say they like you but never make real plans.",
    twist: "Words without effort are manipulation.",
    lesson: "Watch actions, not promises."
  },
  {
    setup: "They come back only when you start moving on.",
    twist: "They do not want you — they want access to you.",
    lesson: "Do not confuse attention with love."
  }
];

const endings = [
  "Healthy love feels peaceful, not confusing.",
  "You deserve clarity, not mixed signals.",
  "Stop chasing people who benefit from your confusion."
];

function generateScript() {
  const h = pick(hooks);
  const p = pick(patterns);
  const e = pick(endings);

  return `
${h}

${p.setup}

At first, it feels exciting.
You think they care.

But slowly,
confusion starts growing.

You begin questioning yourself.

But listen carefully:

${p.twist}

Someone who truly wants you
does not create confusion.

They show up.
They stay consistent.
They make things clear.

${p.lesson}

If someone only appears
when it benefits them,

that is not love.

That is convenience.

And convenience
will never build a real relationship.

${e}

So ask yourself:

Do they bring peace?

Or do they bring confusion?

Because that answer
can change your life.

And if this opened your eyes,

like this video
and subscribe for more.
`.trim();
}

// ===== IMAGES =====
function getImages() {
  const files = fs.readdirSync("images")
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f));

  if (files.length < 4) throw new Error("Need at least 4 images");

  return files
    .sort(() => Math.random() - 0.5)
    .slice(0, 4)
    .map(f => "images/" + f);
}

// ===== AUDIO CHECK =====
function okAudio(f) {
  try {
    return fs.statSync(f).size > 5000;
  } catch {
    return false;
  }
}

// ===== VIDEO =====
function createVideo(images, audio, output) {
  return new Promise((resolve, reject) => {

    const musicFiles = fs.readdirSync("music")
      .filter(f => f.endsWith(".mp3"));

    if (musicFiles.length === 0) {
      return reject(new Error("No background music found"));
    }

    const music = "music/" + musicFiles[Math.floor(Math.random() * musicFiles.length)];

    const inputs = images.map(img => `-loop 1 -t 20 -i "${img}"`).join(" ");

    const filter = `
[0:v]scale=1080:1920,setsar=1[v0];
[1:v]scale=1080:1920,setsar=1[v1];
[2:v]scale=1080:1920,setsar=1[v2];
[3:v]scale=1080:1920,setsar=1[v3];
[v0][v1][v2][v3]concat=n=4:v=1:a=0[v];

[4:a]volume=1.0[a1];
[5:a]volume=0.15[a2];
[a1][a2]amix=inputs=2:duration=first[a]
`;

    const cmd = `"${ffmpegPath}" -y ${inputs} -i "${audio}" -i "${music}" -filter_complex "${filter}" -map "[v]" -map "[a]" -shortest -preset ultrafast -r 24 -pix_fmt yuv420p "${output}"`;

    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.log(stderr);
        reject(new Error("FFmpeg failed"));
      } else resolve();
    });
  });
}

// ===== MAIN =====
async function run() {
  try {
    console.log("START RUN");

    const script = generateScript();

    await notify("🎙 Voice...");
    const voice = await createVoice(script);

    if (!okAudio(voice)) throw new Error("Audio invalid");

    await notify("🎬 Video...");
    const images = getImages();

    const out = `output/video_${Date.now()}.mp4`;

    await createVideo(images, voice, out);

    if (!fs.existsSync(out)) throw new Error("Video not created");

    await notify("☁ Upload...");
    await uploadVideo(out, cleanTitle(script), script);

    await notify("✅ Uploaded");
    console.log("DONE");

  } catch (e) {
    console.log("ERROR:", e.message);
    await notify("❌ ERROR: " + e.message);
    process.exit(1);
  }
}

run();