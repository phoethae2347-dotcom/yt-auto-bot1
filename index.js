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

// google
if (process.env.GOOGLE_CREDENTIALS) {
  fs.writeFileSync("credentials.json", process.env.GOOGLE_CREDENTIALS);
}
if (process.env.GOOGLE_TOKEN) {
  fs.writeFileSync("token.json", process.env.GOOGLE_TOKEN);
}

// ===== SCRIPT =====
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateScript() {
  return `
If someone does this in dating, they were never serious about you.

They give you attention only when it's convenient.

At first, it feels good.
You think they care.

But slowly, confusion starts growing.

You start asking yourself questions.
You wonder if you're overthinking.

But you're not.

Here is the truth:

People who truly want you do not create confusion.

They show consistency.
They show effort.
They show clarity.

If someone only shows up when it benefits them,
that is not love.

That is convenience.

And convenience will never build a real relationship.

Healthy love feels calm, not confusing.

So before giving someone another chance,
ask yourself:

Do they bring peace,
or do they bring confusion?

Because that answer
can save you years.

And if this helped you,
like this video
and subscribe for more.
`.trim();
}

// ===== RANDOM 4 IMAGES =====
function getImages() {
  const files = fs.readdirSync("images")
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f));

  if (files.length < 4) throw new Error("Need 4 images");

  return files
    .sort(() => Math.random() - 0.5)
    .slice(0, 4)
    .map(f => "images/" + f);
}

// ===== AUDIO CHECK =====
function okAudio(f) {
  try { return fs.statSync(f).size > 5000; }
  catch { return false; }
}

// ===== VIDEO (FIXED LOOP) =====
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