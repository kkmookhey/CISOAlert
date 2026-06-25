import fs from "fs";
import path from "path";
import sharp from "sharp";

// Source logo SVG. Machine-specific default; override with TRANSILIENCE_SVG on other machines/CI.
const SVG = process.env.TRANSILIENCE_SVG || "/Users/kkmookhey/Projects/StoryTeller/Videos/public/transilienceLogo.svg";
const ASSETS = path.resolve("../ios/CISOAlert/Assets.xcassets");
const NAVY = { r: 11, g: 16, b: 32 };

const svg = fs.readFileSync(SVG, "utf8");
const m = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
if (!m) { console.error("FATAL: no embedded mark PNG in SVG"); process.exit(1); }
const mark = Buffer.from(m[1], "base64");
const meta = await sharp(mark).metadata();
if (!meta.width || meta.width < 400) { console.error("FATAL: mark too small", meta.width); process.exit(1); }
console.log(`mark ${meta.width}x${meta.height}`);

function writeJson(dir, obj) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "Contents.json"), JSON.stringify(obj, null, 2));
}

// 1) In-app mark (full res, transparent, single-scale; always rendered .resizable in SwiftUI)
const markDir = path.join(ASSETS, "TransilienceMark.imageset");
fs.mkdirSync(markDir, { recursive: true });
fs.writeFileSync(path.join(markDir, "mark.png"), mark);
writeJson(markDir, { images: [{ idiom: "universal", filename: "mark.png" }], info: { author: "xcode", version: 1 } });

// 2) Launch logo (@3x so intrinsic size ~= 1050/3 = 350pt wide, centered on navy launch screen)
const launchPng = await sharp(mark).resize({ width: 1050 }).png().toBuffer();
const launchDir = path.join(ASSETS, "LaunchLogo.imageset");
fs.mkdirSync(launchDir, { recursive: true });
fs.writeFileSync(path.join(launchDir, "launch.png"), launchPng);
writeJson(launchDir, { images: [{ idiom: "universal", filename: "launch.png", scale: "3x" }], info: { author: "xcode", version: 1 } });

// 3) App icon: mark fit to ~90% width, centered on a 1024 navy square, NO alpha (App Store rule).
// 0.90 vs the original 0.74 is ~1.5x larger by area (0.90^2 / 0.74^2 ≈ 1.48).
const SIZE = 1024;
const targetW = Math.round(SIZE * 0.90);
const resized = await sharp(mark).resize({ width: targetW }).toBuffer();
const rmeta = await sharp(resized).metadata();
const icon = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { ...NAVY, alpha: 1 } } })
  .composite([{ input: resized, top: Math.round((SIZE - rmeta.height) / 2), left: Math.round((SIZE - targetW) / 2) }])
  .flatten({ background: NAVY })   // flatten alpha onto navy
  .removeAlpha()                   // remove alpha channel so hasAlpha: no
  .png()
  .toBuffer();
const iconDir = path.join(ASSETS, "AppIcon.appiconset");
fs.mkdirSync(iconDir, { recursive: true });
fs.writeFileSync(path.join(iconDir, "icon-1024.png"), icon);
writeJson(iconDir, { images: [{ idiom: "universal", platform: "ios", size: "1024x1024", filename: "icon-1024.png" }], info: { author: "xcode", version: 1 } });

console.log("brand assets written to", ASSETS);
