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
  fs.writeFileSync("credentials.json", process.env.GOOGLE_CREDENTIALS.replace(/\\n/g, "\n"));
}
if (process.env.GOOGLE_TOKEN) {
  fs.writeFileSync("token.json", process.env.GOOGLE_TOKEN.replace(/\\n/g, "\n"));
}

// ===== VIRAL HOOK =====
const hooks = [
  "This dating mistake is destroying your chances silently.",
  "If they do this, they were never serious about you.",
  "Stop ignoring this red flag before it's too late.",
  "One truth about love nobody tells you.",
  "This will save you years of heartbreak."
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ===== 2 MIN SCRIPT =====
function generateScript() {
  const hook = pick(hooks);

  return `
${hook}

At first, it feels like attention.

They text you.
They show interest.

And you start believing
that something real is building.

But slowly,
things start changing.

Replies get slower.

Effort becomes inconsistent.

And confusion starts to grow.

You start questioning yourself.

You wonder,
maybe you're overthinking.

But you're not.

Here is the truth:

Confusion is never love.

People who truly want you
do not create emotional uncertainty.

They show consistency.

They show effort.

They show clarity.

Because real connection
does not leave you guessing.

If someone only shows up
when it benefits them,

that is not love.

That is convenience.

And convenience will never build
a real relationship.

Healthy love feels calm.

Not stressful.

Not confusing.

So ask yourself this:

Do they bring peace into your life?

Or do they bring anxiety?

Because your answer
will save you years.

And if this helped you,

make sure to like this video

and subscribe for more.
`.trim();
}

// ===== TITLE =====
function buildTitle(script) {
  return (script.split("\n")[0] + " #dating #relationship #viral #shorts").substring(0, 90);
}

// ===== IMAGES =====
function getImages() {
  const files = fs.readdirSync("images")
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f));

  if (files.length < 4) throw new Error("Need at least 4 images");

  return files.sort(() => Math.random() - 0.5).slice(0, 4).map(f => "images/" + f);
}

// ===== AUDIO CHECK =====
function okAudio(f) {
  try { return fs.statSync(f).size > 5000; }
  catch { return false; }
}

// ===== VIDEO (ULTRA STABLE) =====
function createVideo(images, audio, output) {
  return new Promise((resolve, reject) => {

    const musicFiles = fs.readdirSync("music").filter(f => f.endsWith(".mp3"));
    if (musicFiles.length === 0) return reject(new Error("No music"));

    const music = "music/" + musicFiles[Math.floor(Math.random() * musicFiles.length)];

    // 30s per image = 2 min total
    const inputs = images.map(img => `-loop 1 -t 30 -i "${img}"`).join(" ");

    const cmd = `"${ffmpegPath}" -y ${inputs} -i "${audio}" -i "${music}" \
-filter_complex "[0:v]scale=1080:1920,setsar=1[v0];[1:v]scale=1080:1920,setsar=1[v1];[2:v]scale=1080:1920,setsar=1[v2];[3:v]scale=1080:1920,setsar=1[v3];[v0][v1][v2][v3]concat=n=4:v=1:a=0[v];[4:a]volume=1[a1];[5:a]volume=0.1[a2];[a1][a2]amix=inputs=2:duration=first[a]" \
-map "[v]" -map "[a]" -shortest -preset ultrafast -r 24 -pix_fmt yuv420p "${output}"`;

    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
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

    if (!fs.existsSync(out)) throw new Error("Video missing");

    await notify("☁ Upload...");
    await uploadVideo(out, buildTitle(script), script);

    await notify("✅ Uploaded");

  } catch (e) {
    console.log("ERROR:", e.message);
    await notify("❌ ERROR: " + e.message);
  }
}

run();