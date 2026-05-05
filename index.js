require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { exec } = require("child_process");
const fs = require("fs");
const { createVoice } = require("./createVoice");
const { uploadVideo } = require("./upload");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ffmpegPath = "ffmpeg";

// ===== FOLDERS =====
["voice", "output", "temp", "images"].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// ===== GOOGLE AUTH =====
if (process.env.GOOGLE_CREDENTIALS) {
  fs.writeFileSync("credentials.json", process.env.GOOGLE_CREDENTIALS);
}
if (process.env.GOOGLE_TOKEN) {
  fs.writeFileSync("token.json", process.env.GOOGLE_TOKEN);
}

// ===== IMAGE ROTATE =====
function getNextImage() {
  const files = fs.readdirSync("images").filter(f => f.endsWith(".jpg"));

  if (files.length === 0) throw new Error("No jpg images");

  let index = 0;
  if (fs.existsSync("index.txt")) {
    index = parseInt(fs.readFileSync("index.txt")) || 0;
  }

  const file = files[index % files.length];
  fs.writeFileSync("index.txt", (index + 1).toString());

  return `images/${file}`;
}

// ===== AUDIO CHECK =====
function isValidAudio(file) {
  try {
    const size = fs.statSync(file).size;
    return size > 5000;
  } catch {
    return false;
  }
}

// ===== VIDEO CREATE =====
function createVideo(imagePath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {

    const command = `"${ffmpegPath}" -y -loop 1 -i "${imagePath}" -i "${audioPath}" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.002,1.15)':d=125:s=1080x1920" -c:v libx264 -preset veryfast -tune stillimage -shortest -pix_fmt yuv420p -r 30 -movflags +faststart "${outputPath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log(stderr);
        reject(new Error("FFmpeg failed"));
      } else {
        resolve();
      }
    });
  });
}

// ===== SMART TITLE CLEAN =====
function cleanTitle(text) {
  return text
    .replace(/[#@]/g, "")   // remove unwanted symbols
    .replace(/\n/g, " ")
    .trim()
    .substring(0, 70);
}

// ===== HASHTAG BUILDER =====
function buildHashtags(text) {
  const base = ["#shorts", "#viral", "#fyp"];

  if (text.toLowerCase().includes("money")) base.push("#money");
  if (text.toLowerCase().includes("success")) base.push("#success");
  if (text.toLowerCase().includes("fact")) base.push("#facts");

  return base.join(" ");
}

// ===== MAIN =====
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const script = msg.text;

  if (!script) return;

  try {
    await bot.sendMessage(chatId, "🎙 Creating AI voice...");

    let voiceFile = await createVoice(script);

    if (!isValidAudio(voiceFile)) {
      throw new Error("Voice file corrupted");
    }

    await bot.sendMessage(chatId, "🎬 Creating video...");

    const imagePath = getNextImage();
    const videoFile = `output/video_${Date.now()}.mp4`;

    await createVideo(imagePath, voiceFile, videoFile);

    if (!fs.existsSync(videoFile)) {
      throw new Error("Video not created");
    }

    await bot.sendMessage(chatId, "☁ Uploading to YouTube...");

    // ===== BUILD FINAL TITLE + DESCRIPTION =====
    const title = cleanTitle(script);
    const hashtags = buildHashtags(script);

    const finalTitle = `${title} ${hashtags}`;
    const finalDescription = `${script}\n\n${hashtags}`;

    await uploadVideo(
      videoFile,
      finalTitle,
      finalDescription
    );

    await bot.sendVideo(chatId, fs.createReadStream(videoFile));
    await bot.sendMessage(chatId, "✅ Uploaded Successfully");

  } catch (err) {
    console.log("ERROR:", err);
    await bot.sendMessage(chatId, "❌ ERROR: " + err.message);
  }
});