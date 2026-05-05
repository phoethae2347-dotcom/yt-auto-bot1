require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { exec } = require("child_process");
const fs = require("fs");
const { createVoice } = require("./createVoice");
const { uploadVideo } = require("./upload");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ffmpegPath = "ffmpeg";

// folders
["voice", "output", "temp", "images"].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// create google auth files from secrets
if (process.env.GOOGLE_CREDENTIALS) {
  fs.writeFileSync("credentials.json", process.env.GOOGLE_CREDENTIALS);
}
if (process.env.GOOGLE_TOKEN) {
  fs.writeFileSync("token.json", process.env.GOOGLE_TOKEN);
}

// image rotate
function getNextImage() {
  const files = fs.readdirSync("images").filter(f => f.endsWith(".jpg"));
  if (files.length === 0) throw new Error("No jpg images in images folder");

  let index = 0;
  if (fs.existsSync("index.txt")) {
    index = parseInt(fs.readFileSync("index.txt")) || 0;
  }

  const file = files[index % files.length];
  fs.writeFileSync("index.txt", (index + 1).toString());

  return `images/${file}`;
}

// ffmpeg create
function createVideo(imagePath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    const command = `"${ffmpegPath}" -y -loop 1 -i "${imagePath}" -i "${audioPath}" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.002,1.15)':d=125:s=1080x1920" -c:v libx264 -preset veryfast -tune stillimage -shortest -pix_fmt yuv420p -r 30 "${outputPath}"`;

    exec(command, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// telegram receive
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const script = msg.text;

  if (!script) return;

  try {
    await bot.sendMessage(chatId, "🎙 Creating AI voice...");

    const voiceFile = await createVoice(script);

    await bot.sendMessage(chatId, "🎬 Creating video...");

    const imagePath = getNextImage();
    const videoFile = `output/video_${Date.now()}.mp4`;

    await createVideo(imagePath, voiceFile, videoFile);

    await bot.sendMessage(chatId, "☁ Uploading to YouTube...");

    await uploadVideo(
      videoFile,
      script.substring(0, 80),
      script
    );

    await bot.sendVideo(chatId, fs.createReadStream(videoFile));
    await bot.sendMessage(chatId, "✅ Uploaded Successfully");

  } catch (err) {
    console.log("ERROR:", err);
    await bot.sendMessage(chatId, "❌ ERROR: " + err.message);
  }
});