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

// ===== TITLE =====
function cleanTitle(text) {
  return text.replace(/\n/g, " ").substring(0, 80);
}

// ===== SCRIPT =====
function generateScript() {
  return `
If they confuse you, they are not serious about you.

At first, it feels like attention.

But slowly, it turns into confusion.

Here is the truth:

Confusion is not love.

People who truly want you bring clarity.

They show consistency.

If someone only shows up when it benefits them,
that is not love.

That is convenience.

So ask yourself:

Do they bring peace, or confusion?

And if this helped you,
like and subscribe.
`.trim();
}

// ===== IMAGES =====
function getImages() {
  const files = fs.readdirSync("images")
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f));

  if (files.length < 4) throw new Error("Need 4 images");

  return files.sort(() => Math.random() - 0.5).slice(0, 4).map(f => "images/" + f);
}

// ===== AUDIO CHECK =====
function okAudio(f) {
  try { return fs.statSync(f).size > 5000; }
  catch { return false; }
}

// ===== VIDEO FIXED =====
function createVideo(images, audio, output) {
  return new Promise((resolve, reject) => {

    const musicFiles = fs.readdirSync("music").filter(f => f.endsWith(".mp3"));
    if (musicFiles.length === 0) return reject(new Error("No music"));

    const music = "music/" + musicFiles[Math.floor(Math.random() * musicFiles.length)];

    // subtitle file
    const subtitleFile = "sub.srt";

    const srt = `1
00:00:00,000 --> 00:00:05,000
Confusion is not love

2
00:00:05,000 --> 00:00:10,000
Real love brings clarity

3
00:00:10,000 --> 00:00:15,000
Consistency matters
`;

    fs.writeFileSync(subtitleFile, srt);

    // IMPORTANT: SAME DURATION PER IMAGE
    const duration = 15;

    const inputs = images.map(img => `-loop 1 -t ${duration} -i "${img}"`).join(" ");

    // FIXED FILTER (NO CONFLICT)
    const filter = `
[0:v]scale=1080:1920,setsar=1[v0];
[1:v]scale=1080:1920,setsar=1[v1];
[2:v]scale=1080:1920,setsar=1[v2];
[3:v]scale=1080:1920,setsar=1[v3];
[v0][v1][v2][v3]concat=n=4:v=1:a=0[vbase];
[vbase]subtitles=${subtitleFile}[v];

[4:a]volume=1[a1];
[5:a]volume=0.15[a2];
[a1][a2]amix=inputs=2:duration=first[a]
`;

    const cmd = `"${ffmpegPath}" -y ${inputs} -i "${audio}" -i "${music}" -filter_complex "${filter}" -map "[v]" -map "[a]" -shortest -r 24 -pix_fmt yuv420p "${output}"`;

    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.log("FFMPEG ERROR:", stderr);
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
    await uploadVideo(out, cleanTitle(script), script);

    await notify("✅ Uploaded");

  } catch (e) {
    console.log("ERROR:", e.message);
    await notify("❌ ERROR: " + e.message);
  }
}

run();