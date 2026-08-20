#!/usr/bin/env node
/**
 * 音轨 - 项目级图标生成脚本
 * 在 cordova platform add 之前运行，生成图标到 res/icon/android
 * 注意：插件 Hook 也会在 before_prepare 阶段再次生成到平台目录
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ICON_SIZES = {
  'mipmap-mdpi':    48,
  'mipmap-hdpi':    72,
  'mipmap-xhdpi':   96,
  'mipmap-xxhdpi':  144,
  'mipmap-xxxhdpi': 192,
};

const FOREGROUND_SIZE = 432;
const BG_COLOR = '#0a0a0a';
const FG_COLOR = '#c0392b';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function generatePNG(filePath, size, bgColor, fgColor) {
  ensureDir(path.dirname(filePath));
  try {
    execSync(`convert -size ${size}x${size} xc:"${bgColor}" -fill "${fgColor}" -gravity center -pointsize ${Math.floor(size*0.6)} -annotate 0 "♪" "${filePath}"`, { stdio: 'pipe' });
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) return;
  } catch (e) {}
  try {
    const script = `from PIL import Image, ImageDraw
img = Image.new('RGBA', (${size}, ${size}), (10, 10, 10, 255))
draw = ImageDraw.Draw(img)
r = int(${size} * 0.35)
cx, cy = ${size}//2, ${size}//2
draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(3, 3, 3, 255), outline=(192, 57, 43, 255), width=max(2, ${size}//48))
r2 = max(3, ${size}//24)
draw.ellipse([cx-r2, cy-r2, cx+r2, cy+r2], fill=(192, 57, 43, 255))
img.save("${filePath.replace(/\\/g, '/')}")`;
    execSync(`python3 -c '${script.replace(/'/g, "'\\''")}'`, { stdio: 'pipe' });
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) return;
  } catch (e) {}
  // 兜底 PNG
  const pngData = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,0xDE,0x00,0x00,0x00,0x0C,0x49,0x44,0x41,0x54,0x08,0xD7,0x63,0xF8,0xCF,0xC0,0x00,0x00,0x00,0x03,0x00,0x01,0xB3,0x07,0x9E,0x3B,0x00,0x00,0x00,0x00,0x49,0x45,0x4E,0x44,0xAE,0x42,0x60,0x82]);
  fs.writeFileSync(filePath, pngData);
  console.log('  (兜底PNG)');
}

function main() {
  const iconBase = path.join(process.cwd(), 'res', 'icon', 'android');
  console.log('=== 音轨图标生成 ===');
  for (const [dir, size] of Object.entries(ICON_SIZES)) {
    const dirPath = path.join(iconBase, dir);
    ensureDir(dirPath);
    const iconPath = path.join(dirPath, 'ic_launcher.png');
    if (!fs.existsSync(iconPath)) { console.log(`生成 ${dir}/ic_launcher.png`); generatePNG(iconPath, size, BG_COLOR, FG_COLOR); }
    const roundPath = path.join(dirPath, 'ic_launcher_round.png');
    if (!fs.existsSync(roundPath)) fs.copyFileSync(iconPath, roundPath);
  }
  const fgDir = path.join(iconBase, 'drawable');
  ensureDir(fgDir);
  const fgPath = path.join(fgDir, 'ic_launcher_foreground.png');
  if (!fs.existsSync(fgPath)) { console.log('生成 ic_launcher_foreground.png'); generatePNG(fgPath, FOREGROUND_SIZE, BG_COLOR, FG_COLOR); }
  const anydpiDir = path.join(iconBase, 'mipmap-anydpi-v26');
  ensureDir(anydpiDir);
  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@drawable/ic_launcher_background" />\n    <foreground android:drawable="@drawable/ic_launcher_foreground" />\n</adaptive-icon>`;
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), xml);
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), xml);
  fs.writeFileSync(path.join(fgDir, 'ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n    <solid android:color="#0a0a0a"/>\n</shape>`);
  console.log('=== 完成 ===');
}
main();
