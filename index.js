require("dotenv").config();
const fs = require("fs");
const { exec } = require("child_process");
const TelegramBot = require("node-telegram-bot-api");
const { createVoice } = require("./createVoice");
const { uploadVideo } = require("./upload");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const CHAT_ID = process.env.CHAT_ID;
const ffmpegPath = "ffmpeg";

async function notify(msg) {
  try {
    if (CHAT_ID) await bot.sendMessage(CHAT_ID, msg);
  } catch {}
}

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
  "If they do this, they were never serious about you.",
  "Here’s the dating truth nobody wants to admit.",
  "If you keep getting hurt in dating, hear this.",
  "One relationship lesson that will save your heart.",
  "This is how emotionally unavailable people expose themselves."
];

const topics = [
  {
    problem: "They text you only when it’s convenient for them.",
    explain: "Consistency is effort. If someone likes you, you won’t need to wonder where you stand.",
    lesson: "Interest looks like clarity, not confusion."
  },
  {
    problem: "They say they miss you but never make plans.",
    explain: "Words without action are manipulation disguised as affection.",
    lesson: "Pay attention to behavior, not promises."
  },
  {
    problem: "They keep you around but avoid commitment.",
    explain: "Some people enjoy access to you without responsibility for you.",
    lesson: "Never stay where you are only an option."
  },
  {
    problem: "They disappear and come back when lonely.",
    explain: "That’s not love. That’s convenience.",
    lesson: "Do not confuse temporary attention with genuine care."
  }
];

const ctas = [
  "Remember this before your next relationship.",
  "Save this so you never forget your worth.",
  "The right person will never make you question where you stand.",
  "Protect your heart and choose people who choose you."
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateScript() {
  const hook = pick(hooks);
  const topic = pick(topics);
  const cta = pick(ctas);

  return `
${hook}

${topic.problem}

Most people ignore this red flag because they want potential more than reality.

But listen carefully:

${topic.explain}

When someone genuinely values you,
they create security, not anxiety.
They bring peace, not confusion.
They make effort without being asked.

${topic.lesson}

Stop romanticizing mixed signals.
Stop chasing people who only want partial access to you.

${cta}
`.trim();
}

/* =========================
   IMAGE ROTATION (4 LOOP)
========================= */

function getImages() {
  const files = fs.readdirSync("images")
    .filter(f => f.endsWith(".jpg") || f.endsWith(".png"));

  if (files.length < 4) throw new Error("Need at least 4 images");

  return files.slice(0, 4).map(f => "images/" + f);
}

function okAudio(f) {
  try { return fs.statSync(f).size > 5000; }
  catch { return false; }
}

function createVideo(images, audio, output) {
  return new Promise((resolve, reject) => {
    const inputs = images.map(img => `-loop 1 -t 20 -i "${img}"`).join(" ");

    const filter =
      "[0:v]scale=1080:1920,zoompan=z='min(zoom+0.001,1.1)':d=500[v0];" +
      "[1:v]scale=1080:1920,zoompan=z='min(zoom+0.001,1.1)':d=500[v1];" +
      "[2:v]scale=1080:1920,zoompan=z='min(zoom+0.001,1.1)':d=500[v2];" +
      "[3:v]scale=1080:1920,zoompan=z='min(zoom+0.001,1.1)':d=500[v3];" +
      "[v0][v1][v2][v3]concat=n=4:v=1:a=0,format=yuv420p[v]";

    const cmd = `"${ffmpegPath}" -y ${inputs} -i "${audio}" -filter_complex "${filter}" -map "[v]" -map 4:a -c:v libx264 -preset veryfast -shortest -r 30 "${output}"`;

    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.log(stderr);
        reject(new Error("FFmpeg failed"));
      } else resolve();
    });
  });
}

function cleanTitle(t) {
  return t.replace(/\n/g, " ").substring(0, 90);
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
    const out = `output/video_${Date.now()}.mp4`;

    await createVideo(images, voice, out);

    await notify("☁ Upload...");
    await uploadVideo(out, cleanTitle(script), script);

    await notify("✅ Uploaded");
  } catch (e) {
    console.log(e);
    await notify("❌ ERROR: " + e.message);
    process.exit(1);
  }
}

run();