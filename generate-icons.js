#!/usr/bin/env node
/**
 * 音轨 - 图标自动生成脚本
 * 在 Cordova 添加平台前，自动生成所有必需的图标文件
 * 确保构建不会因缺少图标而失败
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 所有需要生成的图标尺寸
const ICON_SIZES = {
  'mipmap-mdpi':    48,
  'mipmap-hdpi':    72,
  'mipmap-xhdpi':   96,
  'mipmap-xxhdpi':  144,
  'mipmap-xxxhdpi': 192,
};

// 前景图标尺寸
const FOREGROUND_SIZE = 432; // xxxhdpi foreground

// 颜色
const BG_COLOR = '#0a0a0a';
const FG_COLOR = '#c0392b';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 生成纯色 PNG 图标（不依赖任何外部库）
function generateSolidPNG(filePath, size, bgColor, fgColor) {
  // 使用 Node.js 内置 zlib 生成最简单的 PNG
  // 实际生成一个带圆形音符符号的简单图标
  
  // 先尝试使用 ImageMagick (CI 环境通常有)
  try {
    execSync(`convert -size ${size}x${size} xc:"${bgColor}" -fill "${fgColor}" -gravity center -pointsize ${Math.floor(size*0.6)} -annotate 0 "♪" "${filePath}"`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    // ImageMagick 不可用
  }

  // 尝试使用 Python PIL
  try {
    const script = `
from PIL import Image, ImageDraw
import math
img = Image.new('RGBA', (${size}, ${size}), (10, 10, 10, 255))
draw = ImageDraw.Draw(img)
r = int(${size} * 0.35)
cx, cy = ${size}//2, ${size}//2
# 画唱片
draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(3, 3, 3, 255), outline=(192, 57, 43, 255), width=max(2, ${size}//48))
# 中心孔
r2 = max(3, ${size}//24)
draw.ellipse([cx-r2, cy-r2, cx+r2, cy+r2], fill=(192, 57, 43, 255))
img.save("${filePath}")
`;
    execSync(`python3 -c '${script.replace(/'/g, "'\\''")}'`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    // Python PIL 不可用
  }

  // 兜底：生成 1x1 像素 PNG（合法的 PNG 文件）
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR length
    0x49, 0x48, 0x44, 0x52, // "IHDR"
    0x00, 0x00, 0x00, 0x01, // width=1
    0x00, 0x00, 0x00, 0x01, // height=1
    0x08, 0x02, 0x00, 0x00, 0x00, // bit depth=8, color type=2
    0x90, 0x77, 0x53, 0xDE, // CRC
    0x00, 0x00, 0x00, 0x0C, // IDAT length
    0x49, 0x44, 0x41, 0x54, // "IDAT"
    0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01,
    0xB3, 0x07, 0x9E, 0x3B, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND length
    0x49, 0x45, 0x4E, 0x44, // "IEND"
    0xAE, 0x42, 0x60, 0x82, // CRC
  ]);
  fs.writeFileSync(filePath, pngData);
  console.log('  (使用 1x1 兜底图标)');
  return false;
}

function main() {
  const projectRoot = process.cwd();
  const iconBase = path.join(projectRoot, 'res', 'icon', 'android');
  
  console.log('=== 音轨图标生成 ===');
  
  // 生成各尺寸启动图标
  for (const [dir, size] of Object.entries(ICON_SIZES)) {
    const dirPath = path.join(iconBase, dir);
    ensureDir(dirPath);
    
    const iconPath = path.join(dirPath, 'ic_launcher.png');
    if (!fs.existsSync(iconPath)) {
      console.log(`生成 ${dir}/ic_launcher.png (${size}x${size})`);
      generateSolidPNG(iconPath, size, BG_COLOR, FG_COLOR);
    } else {
      console.log(`已存在 ${dir}/ic_launcher.png`);
    }
    
    // 圆形图标（复制即可）
    const roundPath = path.join(dirPath, 'ic_launcher_round.png');
    if (!fs.existsSync(roundPath)) {
      fs.copyFileSync(iconPath, roundPath);
    }
  }
  
  // 生成前景图标
  const fgDir = path.join(iconBase, 'drawable');
  ensureDir(fgDir);
  const fgPath = path.join(fgDir, 'ic_launcher_foreground.png');
  if (!fs.existsSync(fgPath)) {
    console.log(`生成 drawable/ic_launcher_foreground.png (${FOREGROUND_SIZE}x${FOREGROUND_SIZE})`);
    generateSolidPNG(fgPath, FOREGROUND_SIZE, BG_COLOR, FG_COLOR);
  }
  
  // 确保自适应图标 XML 存在
  const anydpiDir = path.join(iconBase, 'mipmap-anydpi-v26');
  ensureDir(anydpiDir);
  
  const launcherXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>`;
  
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), launcherXml);
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), launcherXml);
  
  // 确保背景 XML 存在
  const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#0a0a0a"/>
</shape>`;
  fs.writeFileSync(path.join(fgDir, 'ic_launcher_background.xml'), bgXml);
  
  // 确保通知栏图标存在
  const notifIcons = {
    'ic_play.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24" android:tint="#FFFFFF"><path android:fillColor="#FFFFFF" android:pathData="M8,5v14l11,-7z"/></vector>`,
    'ic_pause.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24" android:tint="#FFFFFF"><path android:fillColor="#FFFFFF" android:pathData="M6,19h4V5H6v14zM14,5v14h4V5h-4z"/></vector>`,
    'ic_skip_next.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24" android:tint="#FFFFFF"><path android:fillColor="#FFFFFF" android:pathData="M6,18l8.5,-5L6,8v10zM16,6v12h2V6h-2z"/></vector>`,
    'ic_skip_prev.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24" android:tint="#FFFFFF"><path android:fillColor="#FFFFFF" android:pathData="M6,6h2v12H6zM9.5,12l8.5,6V6z"/></vector>`,
    'ic_music_note.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24" android:tint="#FFFFFF"><path android:fillColor="#FFFFFF" android:pathData="M12,3v10.55c-0.59,-0.34 -1.27,-0.55 -2,-0.55 -2.21,0 -4,1.79 -4,4s1.79,4 4,4 4,-1.79 4,-4V7h4V3h-6z"/></vector>`,
  };
  
  for (const [name, content] of Object.entries(notifIcons)) {
    const iconPath = path.join(fgDir, name);
    if (!fs.existsSync(iconPath)) {
      fs.writeFileSync(iconPath, content);
      console.log(`生成 ${name}`);
    }
  }
  
  // 确保 network_security_config.xml 存在
  const xmlDir = path.join(projectRoot, 'res', 'android');
  ensureDir(xmlDir);
  const nscPath = path.join(xmlDir, 'network_security_config.xml');
  if (!fs.existsSync(nscPath)) {
    fs.writeFileSync(nscPath, `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>`);
    console.log('生成 network_security_config.xml');
  }
  
  console.log('=== 图标生成完成 ===');
}

main();
