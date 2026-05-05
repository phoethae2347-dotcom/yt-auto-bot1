const fs = require("fs");
const https = require("https");

function createVoice(text) {
  return new Promise((resolve, reject) => {
    const filePath = `voice/voice_${Date.now()}.mp3`;

    const url =
      "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=" +
      encodeURIComponent(text);

    const file = fs.createWriteStream(filePath);

    https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      },
      (res) => {
        res.pipe(file);

        file.on("finish", () => {
          file.close();
          resolve(filePath);
        });
      }
    ).on("error", (err) => {
      reject(err);
    });
  });
}

module.exports = { createVoice };