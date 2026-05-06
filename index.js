require("dotenv").config();
const fs = require("fs");
const { exec } = require("child_process");
const TelegramBot = require("node-telegram-bot-api");
const { createVoice } = require("./createVoice");
const { uploadVideo } = require("./upload");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const CHAT_ID = process.env.CHAT_ID;
const ffmpegPath = "ffmpeg";

// notify
async function notify(msg) {
  try {
    if (CHAT_ID) await bot.sendMessage(CHAT_ID, msg);
  } catch {}
}

// setup
["voice", "output", "images"].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d);
});

if (process.env.GOOGLE_CREDENTIALS) {
  fs.writeFileSync("credentials.json", process.env.GOOGLE_CREDENTIALS);
}
if (process.env.GOOGLE_TOKEN) {
  fs.writeFileSync("token.json", process.env.GOOGLE_TOKEN);
}

// ===== SCRIPT ENGINE =====
const hooks = [
  "If someone does this in dating, they were never serious about you.",
  "The biggest dating mistake people make is ignoring this red flag.",
  "Here’s how emotionally unavailable people reveal themselves early."
];

const scenarios = [
  {
    setup: "They text you constantly at night but disappear during the day.",
    twist: "That means they enjoy access to you, not commitment.",
    lesson: "People make time for what they value."
  },
  {
    setup: "They say they like you but avoid making real plans.",
    twist: "Words without effort are manipulation.",
    lesson: "Watch actions, not promises."
  }
];

const endings = [
  "Healthy love brings peace, not anxiety.",
  "Stop chasing people who confuse you."
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateScript() {
  const h = pick(hooks);
  const s = pick(scenarios);
  const e = pick(endings);

  return `
${h}

${s.setup}

Most people ignore this because they confuse attention with real interest.

But here is the truth:

${s.twist}

Someone who truly wants you creates clarity, not confusion.

${s.lesson}

${e}

Remember this before giving someone another chance.
`.trim();
}

// ===== IMAGE =====
function getImages() {
  const files = fs.readdirSync("images")
    .filter(f => /\.(jpg|png|jpeg)$/i.test(f));

  if (files.length < 4) throw new Error("Need 4 images");

  return files.slice(0, 4).map(f => "images/" + f);
}

// ===== AUDIO =====
function okAudio(f) {
  try { return fs.statSync(f).size > 5000; }
  catch { return false; }
}

// ===== VIDEO =====
function createVideo(images, audio, output) {
  return new Promise((resolve, reject) => {

    const inputs = images.map(img => `-loop 1 -t 20 -i "${img}"`).join(" ");

    const filter = `
[0:v]scale=1080:1920,setsar=1[v0];
[1:v]scale=1080:1920,setsar=1[v1];
[2:v]scale=1080:1920,setsar=1[v2];
[3:v]scale=1080:1920,setsar=1[v3];
[v0][v1][v2][v3]concat=n=4:v=1:a=0[v]
`;

    const cmd = `"${ffmpegPath}" -y ${inputs} -i "${audio}" -filter_complex "${filter}" -map "[v]" -map 4:a -shortest "${output}"`;

    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.log(stderr);
        reject(new Error("FFmpeg failed"));
      } else resolve();
    });
  });
}

// ===== TITLE =====
function cleanTitle(t) {
  return t.replace(/\n/g, " ").substring(0, 80);
}

// ===== MAIN =====
async function run() {
  try {
    const script = generateScript();

    await notify("🎙 Voice...");
    const voice = await createVoice(script);

    if (!okAudio(voice)) throw new Error("Audio invalid");

    await notify("🎬 Video...");
    const images = getImages();

    const out = `output/video_${Date.now()}.mp4`;

    await createVideo(images, voice, out);

    await notify("☁ Upload...");
    await uploadVideo(out, cleanTitle(script), script);

    await notify("✅ Uploaded");

  } catch (e) {
    console.log(e);
    await notify("❌ ERROR: " + e.message);
  }
}

run();