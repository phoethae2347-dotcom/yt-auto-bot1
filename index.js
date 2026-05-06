require("dotenv").config();
const fs = require("fs");
const { exec } = require("child_process");
const TelegramBot = require("node-telegram-bot-api");
const { createVoice } = require("./createVoice");
const { uploadVideo } = require("./upload");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const CHAT_ID = process.env.CHAT_ID;
const ffmpegPath = "ffmpeg";

/* =========================
   TELEGRAM NOTIFY
========================= */
async function notify(msg) {
  try {
    if (CHAT_ID) await bot.sendMessage(CHAT_ID, msg);
  } catch (e) {
    console.log("notify error:", e.message);
  }
}

/* =========================
   SETUP
========================= */
["voice", "output", "images"].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

if (process.env.GOOGLE_CREDENTIALS) {
  fs.writeFileSync("credentials.json", process.env.GOOGLE_CREDENTIALS);
}
if (process.env.GOOGLE_TOKEN) {
  fs.writeFileSync("token.json", process.env.GOOGLE_TOKEN);
}

/* =========================
   PRO SCRIPT ENGINE
========================= */
const hooks = [
  "If someone does this in dating, they were never serious about you.",
  "The biggest dating mistake people make is ignoring this red flag.",
  "Here’s how emotionally unavailable people reveal themselves early.",
  "If they make you feel this way, walk away immediately.",
  "One brutal dating truth that can save you years of heartbreak."
];

const scenarios = [
  {
    setup: "They text you constantly at night but disappear during the day.",
    twist: "That usually means they enjoy access to you, not commitment to you.",
    lesson: "People make time for what they value."
  },
  {
    setup: "They say they like you but avoid making real plans.",
    twist: "Words without effort are just manipulation with good marketing.",
    lesson: "Listen to patterns, not promises."
  },
  {
    setup: "They come back every time you start moving on.",
    twist: "Some people do not want you — they just do not want to lose access to you.",
    lesson: "Missing you is not the same as valuing you."
  },
  {
    setup: "They keep saying they are not ready for a relationship.",
    twist: "Often that means they are not ready for one with you.",
    lesson: "Do not wait around hoping someone chooses you later."
  }
];

const endings = [
  "The right person will never leave you confused about their intentions.",
  "Healthy love brings peace, not anxiety.",
  "Stop chasing clarity from people who benefit from your confusion.",
  "Protect your heart by believing actions over words."
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateScript() {
  const hook = pick(hooks);
  const s = pick(scenarios);
  const end = pick(endings);

  return 
${hook}

${s.setup}

Most people ignore this because they confuse attention with genuine interest.

But here is the truth:

${s.twist}

Someone who truly wants you does not create confusion.
They do not leave you wondering where you stand.
They do not make you question your worth.

Real interest creates consistency.
Real effort creates security.
Real love creates peace.

${s.lesson}

And if someone only shows up when it benefits them,
that is not connection—
that is convenience.

${end}

Remember this before giving someone another chance.
.trim();
}

/* =========================
   IMAGE PICKER
========================= */
function getImages() {
  const files = fs.readdirSync("images")
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f));

  if (files.length < 4) throw new Error("Need at least 4 images");

  // random 4 images
  return files
    .sort(() => Math.random() - 0.5)
    .slice(0, 4)
    .map(f => "images/" + f);
}

/* =========================
   AUDIO CHECK
========================= */
function okAudio(file) {
  try {
    return fs.statSync(file).size > 5000;
  } catch {
    return false;
  }
}
/* =========================
   SMOOTH CINEMATIC VIDEO
========================= */
function createVideo(images, audio, output) {
  return new Promise((resolve, reject) => {
    const inputs = images.map(img => -loop 1 -t 25 -i "${img}").join(" ");

    const filter = 
[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,zoompan=z='if(lte(on,375),1+0.0004*on,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=375:s=1080x1920[v0];
[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,zoompan=z='if(lte(on,375),1+0.0004*on,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=375:s=1080x1920[v1];
[2:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,zoompan=z='if(lte(on,375),1+0.0004*on,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=375:s=1080x1920[v2];
[3:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,zoompan=z='if(lte(on,375),1+0.0004*on,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=375:s=1080x1920[v3];
[v0][v1]xfade=transition=fade:duration=0.5:offset=12.0[x1];
[x1][v2]xfade=transition=fade:duration=0.5:offset=24.0[x2];
[x2][v3]xfade=transition=fade:duration=0.5:offset=36.0,format=yuv420p[v]
;

    const cmd = "${ffmpegPath}" -y ${inputs} -i "${audio}" -filter_complex "${filter}" -map "[v]" -map 4:a -c:v libx264 -preset veryfast -shortest -r 30 "${output}";

    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.log(stderr);
        reject(new Error("FFmpeg failed"));
      } else {
        resolve();
      }
    });
  });
}

/* =========================
   TITLE
========================= */
function cleanTitle(text) {
  return text
    .replace(/\n/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim()
    .substring(0, 90);
}

/* =========================
   MAIN
========================= */
async function run() {
  try {
    const script = generateScript();

    await notify("🎙 Voice...");
    const voice = await createVoice(script);

    if (!okAudio(voice)) throw new Error("Audio invalid");

    await notify("🎬 Video...");
    const images = getImages();
    const out = output/video_${Date.now()}.mp4;

    await createVideo(images, voice, out);

    if (!fs.existsSync(out)) throw new Error("Video missing");

    await notify("☁ Upload...");
    await uploadVideo(out, cleanTitle(script), script);

    await notify("✅ Uploaded");
  } catch (e) {
    console.log("ERR:", e.message);
    await notify("❌ ERROR: " + e.message);
    process.exit(1);
  }
}

run();