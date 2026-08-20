#!/usr/bin/env node
/**
 * 音轨 - 图标自动生成 Hook
 * 作为 Cordova before_prepare Hook 运行，直接写入 Android 平台目录
 * 也可作为独立脚本运行（node scripts/generate-icons.js）
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

const FOREGROUND_SIZE = 432;
const BG_COLOR = '#0a0a0a';
const FG_COLOR = '#c0392b';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 生成 PNG 图标（三层兜底：ImageMagick → Python PIL → 最小合法 PNG）
function generatePNG(filePath, size, bgColor, fgColor) {
  ensureDir(path.dirname(filePath));

  // 方案1: ImageMagick
  try {
    execSync(`convert -size ${size}x${size} xc:"${bgColor}" -fill "${fgColor}" -gravity center -pointsize ${Math.floor(size*0.6)} -annotate 0 "♪" "${filePath}"`, { stdio: 'pipe' });
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) return true;
  } catch (e) {}

  // 方案2: Python PIL
  try {
    const script = `
from PIL import Image, ImageDraw
img = Image.new('RGBA', (${size}, ${size}), (10, 10, 10, 255))
draw = ImageDraw.Draw(img)
r = int(${size} * 0.35)
cx, cy = ${size}//2, ${size}//2
draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(3, 3, 3, 255), outline=(192, 57, 43, 255), width=max(2, ${size}//48))
r2 = max(3, ${size}//24)
draw.ellipse([cx-r2, cy-r2, cx+r2, cy+r2], fill=(192, 57, 43, 255))
img.save("${filePath.replace(/\\/g, '/')}")
`;
    execSync(`python3 -c '${script.replace(/'/g, "'\\''")}'`, { stdio: 'pipe' });
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) return true;
  } catch (e) {}

  // 方案3: 最小合法 PNG（1x1 红色像素）
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE,
    0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54,
    0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01,
    0xB3, 0x07, 0x9E, 0x3B,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
    0xAE, 0x42, 0x60, 0x82,
  ]);
  fs.writeFileSync(filePath, pngData);
  console.log('  (使用兜底 PNG)');
  return false;
}

// 通知栏图标 XML（矢量图，不依赖 PNG）
const VECTOR_ICONS = {
  'ic_play.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24" android:tint="#FFFFFF"><path android:fillColor="#FFFFFF" android:pathData="M8,5v14l11,-7z"/></vector>`,
  'ic_pause.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24" android:tint="#FFFFFF"><path android:fillColor="#FFFFFF" android:pathData="M6,19h4V5H6v14zM14,5v14h4V5h-4z"/></vector>`,
  'ic_skip_next.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24" android:tint="#FFFFFF"><path android:fillColor="#FFFFFF" android:pathData="M6,18l8.5,-5L6,8v10zM16,6v12h2V6h-2z"/></vector>`,
  'ic_skip_prev.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24" android:tint="#FFFFFF"><path android:fillColor="#FFFFFF" android:pathData="M6,6h2v12H6zM9.5,12l8.5,6V6z"/></vector>`,
  'ic_music_note.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24" android:tint="#FFFFFF"><path android:fillColor="#FFFFFF" android:pathData="M12,3v10.55c-0.59,-0.34 -1.27,-0.55 -2,-0.55 -2.21,0 -4,1.79 -4,4s1.79,4 4,4 4,-1.79 4,-4V7h4V3h-6z"/></vector>`,
};

function generateAllIcons(resDir) {
  console.log('[音轨] 生成图标到: ' + resDir);
  ensureDir(resDir);

  // 1. 生成启动图标 PNG
  for (const [dir, size] of Object.entries(ICON_SIZES)) {
    const dirPath = path.join(resDir, dir);
    ensureDir(dirPath);
    const iconPath = path.join(dirPath, 'ic_launcher.png');
    if (!fs.existsSync(iconPath) || fs.statSync(iconPath).size < 100) {
      console.log(`  生成 ${dir}/ic_launcher.png (${size}x${size})`);
      generatePNG(iconPath, size, BG_COLOR, FG_COLOR);
    }
    const roundPath = path.join(dirPath, 'ic_launcher_round.png');
    if (!fs.existsSync(roundPath) || fs.statSync(roundPath).size < 100) {
      fs.copyFileSync(iconPath, roundPath);
    }
  }

  // 2. 生成前景图标
  const drawableDir = path.join(resDir, 'drawable');
  ensureDir(drawableDir);
  const fgPath = path.join(drawableDir, 'ic_launcher_foreground.png');
  if (!fs.existsSync(fgPath) || fs.statSync(fgPath).size < 100) {
    console.log(`  生成 drawable/ic_launcher_foreground.png`);
    generatePNG(fgPath, FOREGROUND_SIZE, BG_COLOR, FG_COLOR);
  }

  // 3. 生成自适应图标 XML
  const anydpiDir = path.join(resDir, 'mipmap-anydpi-v26');
  ensureDir(anydpiDir);
  const launcherXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>`;
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), launcherXml);
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), launcherXml);

  // 4. 生成背景 XML
  const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#0a0a0a"/>
</shape>`;
  fs.writeFileSync(path.join(drawableDir, 'ic_launcher_background.xml'), bgXml);

  // 5. 生成通知栏图标 XML
  for (const [name, content] of Object.entries(VECTOR_ICONS)) {
    const iconPath = path.join(drawableDir, name);
    fs.writeFileSync(iconPath, content);
  }

  // 6. 网络安全配置
  const xmlDir = path.join(resDir, 'xml');
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
  }

  console.log('[音轨] 图标生成完成');
}

// Cordova Hook 入口
module.exports = function(context) {
  console.log('[音轨] before_prepare Hook 运行中...');

  let resDir = null;

  // 优先从 Cordova context 获取平台路径
  if (context && context.opts && context.opts.projectRoot) {
    const platformPath = path.join(context.opts.projectRoot, 'platforms', 'android');
    if (fs.existsSync(platformPath)) {
      resDir = path.join(platformPath, 'app', 'src', 'main', 'res');
    }
  }

  // 兜底：猜测常见路径
  if (!resDir) {
    const candidates = [
      path.join(process.cwd(), 'platforms', 'android', 'app', 'src', 'main', 'res'),
      path.join(process.cwd(), 'app', 'src', 'main', 'res'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.dirname(c))) {
        resDir = c;
        break;
      }
    }
  }

  if (!resDir) {
    // 如果平台还没添加，写到项目的 res/icon/android 目录
    resDir = path.join(process.cwd(), 'res', 'icon', 'android');
    console.log('[音轨] 平台未就绪，图标写入项目目录: ' + resDir);
  }

  generateAllIcons(resDir);

  // 同时也写到项目的 res/icon/android（供 config.xml 引用，虽然现在没声明）
  const projectIconDir = path.join(process.cwd(), 'res', 'icon', 'android');
  if (projectIconDir !== resDir) {
    try {
      generateAllIcons(projectIconDir);
    } catch (e) {
      console.log('[音轨] 项目目录图标生成跳过');
    }
  }
};

// 如果直接运行（非 Hook）
if (require.main === module) {
  const resDir = path.join(process.cwd(), 'platforms', 'android', 'app', 'src', 'main', 'res');
  if (fs.existsSync(path.dirname(resDir))) {
    generateAllIcons(resDir);
  } else {
    // 平台还没添加，写到项目目录
    generateAllIcons(path.join(process.cwd(), 'res', 'icon', 'android'));
  }
}
