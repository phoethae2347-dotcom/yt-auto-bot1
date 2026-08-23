# yt-auto-bot1

This project generates short-form relationship reflections with synthetic narration and uploads them through the YouTube Data API. It is designed to support original, viewer-useful content rather than impersonation, fake engagement, scraped material, or guaranteed monetization.

## Important publishing policy

The scheduled workflow is configured for three public uploads per day, spaced eight hours apart, after the code-level quality gates pass. The upload step still requires `ALLOW_PUBLIC_UPLOAD=true`, and the workflow sets it explicitly. A successful upload is not a guarantee of views, YPP acceptance, ad suitability, or revenue.

The description states that the commentary and narration use AI-assisted tools. The API request also sets YouTube's `status.containsSyntheticMedia=true`. This is appropriate for the current synthetic narration workflow, but the channel owner remains responsible for selecting the correct disclosure for the actual video in YouTube Studio.

YouTube monetization review expects original and authentic content and may reject repetitive, mass-produced, generic, or reused content. Randomly changing a hook, image, or background track does not by itself make a video sufficiently original. Add real editorial review, specific examples, varied formats, meaningful commentary, and viewer value before publishing.

## Asset rights gate

The old bundled `images/` and `music/` folders were removed. The renderer now applies format-specific zoom/pan motion, transition families, scene labels, animated subtitles, and audio loudness normalization. Every run now queries Openverse and downloads four fresh CC0 candidates into the ignored `.runtime/images/` directory. These files are not committed as a reusable image pool. The current run's source page, download URL, creator field, license URL, and SHA-256 hash are recorded in `.runtime/current-assets.json` and included in the YouTube description.

Openverse result IDs are stored in `state/image-history.json`, and the GitHub Actions workflow restores/saves that file through the Actions cache. A later run excludes result IDs already used by earlier runs, and selection prefers different creators within a video. If the API is unavailable or it cannot find enough new verified candidates, the run stops; it does not fall back to an old image or an unverified source. Background music is currently disabled, so the video uses narration-only audio.

CC0 addresses copyright licensing, but the channel owner should still check the source page and final edit for privacy, publicity/personality rights, trademarks, logos, private locations, misleading endorsement, and other local-law restrictions. Do not treat an asset as risk-free merely because it is found online or appears to be AI-generated.

## Required secrets

Configure these GitHub Actions secrets:

| Secret | Purpose |
| --- | --- |
| `GOOGLE_CREDENTIALS` | OAuth client JSON for the YouTube Data API |
| `GOOGLE_TOKEN` | Authorized token JSON with the YouTube upload scope |
| `BOT_TOKEN` | Optional Telegram bot token for status notifications |
| `CHAT_ID` | Optional Telegram chat ID for status notifications |

The OAuth token must be created with `https://www.googleapis.com/auth/youtube.upload`. If `token.json` is not present in a non-interactive workflow, the job fails rather than waiting for input.

## Runtime settings

The workflow passes public-upload and enhanced-editing defaults. Override these only after review:

| Variable | Default | Meaning |
| --- | --- | --- |
| `UPLOAD_PRIVACY_STATUS` | `public` in Actions | Upload visibility: `private`, `unlisted`, or `public` |
| `ALLOW_PUBLIC_UPLOAD` | `true` in Actions | Must be exactly `true` to permit public visibility |
| `VIDEO_WIDTH` | `1080` | Vertical render width; use `540` for a faster preview |
| `VIDEO_HEIGHT` | `1920` | Vertical render height; use `960` for a faster preview |
| `VIDEO_FPS` | `24` | Render frame rate |
| `SKIP_UPLOAD` | unset | Set to `true` for a local preview without YouTube upload |
| Schedule | `00:30`, `08:30`, `16:30` UTC | Three scheduled runs per day; in Myanmar time (UTC+6:30), approximately 07:00, 15:00, and 23:00 |
| `TTS_VOICE` | `en-US-JennyNeural` | Edge TTS voice |
| `DEFAULT_LANGUAGE` | `en` | Video metadata language |
| `DEFAULT_AUDIO_LANGUAGE` | `en-US` | Spoken audio language |
| `FFMPEG_PRESET` | `medium` | Encoding quality/speed trade-off |

## Local checks

Install dependencies with `npm ci`, install FFmpeg and `edge-tts`, and run `npm test`. A preview run that never calls YouTube uses `SKIP_UPLOAD=true node index.js`; it produces a local MP4 in `output/`. A real run requires valid Google credentials, network access to Openverse, and the dynamic source policy in `asset-licenses.json`. Keep generated `credentials.json`, `token.json`, `.runtime/`, `voice/`, and `output/` files out of version control.

## Content quality guidance

The generator reads `content-briefs.json` instead of selecting one long script template. Each brief must contain a distinct topic, format, scene, lesson, insight, action, and viewer question. The renderer uses different structures for myth-versus-reality, mini-case, conversation script, practical checklist, reflective letter, three-part lesson, and journal prompt. This creates real editorial variation while ensuring every video teaches one practical idea and gives the viewer one safe action to try.

Use the briefs as educational starting points, not as a substitute for editorial review. To add a new format, add a new brief with a new `format` value and add its narration structure to `renderBrief()` in `index.js`. Every new brief must explain one learnable principle, one practical action, and one reflection question; the runtime quality gate rejects briefs that omit those fields. To test one format locally, set `CONTENT_FORMAT` to a supported value. Avoid diagnosing viewers, making absolute claims about relationships, or presenting the script as therapy. A human should check factual tone, originality, readability, voice pronunciation, image suitability, licensing, and the final disclosure before a video is made public.

## Sources

1. [YouTube channel monetization policies](https://support.google.com/youtube/answer/1311392)
2. [Disclosing use of GenAI content](https://support.google.com/youtube/answer/14328491)
3. [YouTube Videos API reference](https://developers.google.com/youtube/v3/docs/videos)
