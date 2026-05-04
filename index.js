require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { exec } = require("child_process");
const fs = require("fs");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});

// ✅ IMPORTANT (Render compatible)
const ffmpegPath = "ffmpeg";

// ===== SETUP =====
["voice", "output", "temp"].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// ===== IMAGE =====
function getNextImage() {
  const files = fs.readdirSync("images").filter(f => f.endsWith(".jpg"));
  if (files.length === 0) throw new Error("No images");

  let index = 0;
  if (fs.existsSync("index.txt")) {
    index = parseInt(fs.readFileSync("index.txt"));
  }

  const file = files[index % files.length];
  fs.writeFileSync("index.txt", (index + 1).toString());

  return `images/${file}`;
}

// ===== VIDEO =====
function createVideo(imagePath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {

    const command = `"${ffmpegPath}" -y -loop 1 -i "${imagePath}" -i "${audioPath}" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.002,1.2)':d=125:s=1080x1920" -c:v libx264 -preset veryfast -tune stillimage -shortest -pix_fmt yuv420p -r 30 "${outputPath}"`;

    exec(command, (error) => {
      if (error) {
        console.log("VIDEO ERROR:", error);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// ===== MAIN =====
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  try {
    bot.sendMessage(chatId, "Creating video... 🔥");

    const videoFile = `output/video_${Date.now()}.mp4`;

    // ✅ STEP 5 FIX: use sample audio
    const audioFile = "sample.mp3";

    if (!fs.existsSync(audioFile)) {
      throw new Error("sample.mp3 NOT FOUND");
    }

    // Image
    const imagePath = getNextImage();

    // Video create
    await createVideo(imagePath, audioFile, videoFile);

    if (!fs.existsSync(videoFile)) throw new Error("Video missing");

    // Send
    await bot.sendVideo(chatId, fs.createReadStream(videoFile));

    console.log("🔥 VIDEO OK");

  } catch (err) {
    console.log("ERROR:", err);
    bot.sendMessage(chatId, "ERROR ❌");
  }
});