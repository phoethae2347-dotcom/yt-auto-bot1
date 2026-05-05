const fs = require("fs");
const https = require("https");

function createVoice(text) {
  return new Promise((resolve, reject) => {

    const filePath = `voice/voice_${Date.now()}.mp3`;

    const url =
      "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=" +
      encodeURIComponent(text);

    const file = fs.createWriteStream(filePath);

    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*"
      }
    }, (res) => {

      // 🔥 CHECK CONTENT TYPE
      const contentType = res.headers["content-type"];

      if (!contentType || !contentType.includes("audio")) {
        file.close();
        fs.unlinkSync(filePath);
        return reject(new Error("TTS blocked / invalid response"));
      }

      res.pipe(file);

      file.on("finish", () => {
        file.close();

        // 🔥 CHECK FILE SIZE
        const size = fs.statSync(filePath).size;

        if (size < 5000) {
          fs.unlinkSync(filePath);
          return reject(new Error("Audio too small / corrupted"));
        }

        resolve(filePath);
      });

    }).on("error", (err) => {
      reject(err);
    });

  });
}

module.exports = { createVoice };