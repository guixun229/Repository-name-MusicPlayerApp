#!/usr/bin/env node
/**
 * 音轨 - Cordova Hook 脚本
 * 在构建前修改自动生成的 MainActivity.java
 * 实现息屏时保持 WebView 运行
 *
 * 用法：在 plugin.xml 中通过 <hook> 注册
 */

const fs = require('fs');
const path = require('path');

// 自定义 MainActivity 的完整内容
const CUSTOM_MAIN_ACTIVITY = `package PACKAGE_NAME;

import android.os.Bundle;
import android.util.Log;
import org.apache.cordova.CordovaActivity;

/**
 * 音轨 - 自定义 MainActivity
 * 息屏时保持 WebView 运行，防止音频中断
 */
public class MainActivity extends CordovaActivity {

    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Bundle extras = getIntent().getExtras();
        if (extras != null && extras.getBoolean("cdvStartInBackground", false)) {
            moveTaskToBack(true);
        }
        loadUrl(launchUrl);
    }

    @Override
    protected void onPause() {
        try {
            Class<?> serviceClass = Class.forName("com.yingu.player.MusicService");
            boolean isPlaying = false;
            try {
                java.lang.reflect.Method m = serviceClass.getMethod("isPlaybackActive");
                Object result = m.invoke(null);
                isPlaying = result instanceof Boolean && (Boolean) result;
            } catch (Exception e) {
                // MusicService not available, normal pause
            }

            if (isPlaying && this.appView != null) {
                super.onPause();
                this.appView.handleResume(this.keepRunning);
                Log.d(TAG, "息屏保活：WebView 保持运行");
            } else {
                super.onPause();
            }
        } catch (Exception e) {
            super.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (this.appView != null) {
            this.appView.handleResume(this.keepRunning);
        }
    }
}
`;

module.exports = function(context) {
    const projectRoot = context.opts.projectRoot || process.cwd();
    const platformPath = path.join(projectRoot, 'platforms', 'android');
    const manifestPath = path.join(platformPath, 'app', 'src', 'main', 'AndroidManifest.xml');

    // 从 AndroidManifest.xml 读取包名
    let packageName = 'com.yingu.player';
    try {
        if (fs.existsSync(manifestPath)) {
            const manifest = fs.readFileSync(manifestPath, 'utf8');
            const match = manifest.match(/package="([^"]+)"/);
            if (match) {
                packageName = match[1];
            }
        }
    } catch (e) {
        console.log('[音轨 Hook] 使用默认包名');
    }

    // 查找自动生成的 MainActivity.java
    const packagePath = packageName.replace(/\./g, '/');
    const mainActivityPath = path.join(
        platformPath,
        'app',
        'src',
        'main',
        'java',
        packagePath,
        'MainActivity.java'
    );

    if (!fs.existsSync(mainActivityPath)) {
        console.log('[音轨 Hook] 未找到 MainActivity.java: ' + mainActivityPath);
        console.log('[音轨 Hook] 尝试其他路径...');

        // 尝试搜索
        const javaDir = path.join(platformPath, 'app', 'src', 'main', 'java');
        if (fs.existsSync(javaDir)) {
            try {
                const findCmd = require('child_process').execSync(
                    'find "' + javaDir + '" -name "MainActivity.java" 2>/dev/null',
                    { encoding: 'utf8' }
                ).trim();
                if (findCmd) {
                    const found = findCmd.split('\n')[0].trim();
                    if (fs.existsSync(found)) {
                        console.log('[音轨 Hook] 找到: ' + found);
                        replaceMainActivity(found, packageName);
                        return;
                    }
                }
            } catch (e2) {}
        }
        console.log('[音轨 Hook] 跳过 MainActivity 修改');
        return;
    }

    replaceMainActivity(mainActivityPath, packageName);
};

function replaceMainActivity(filePath, packageName) {
    const content = CUSTOM_MAIN_ACTIVITY.replace(/PACKAGE_NAME/g, packageName);

    try {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('[音轨 Hook] MainActivity.java 已替换: ' + filePath);
        console.log('[音轨 Hook] 包名: ' + packageName);
    } catch (e) {
        console.error('[音轨 Hook] 写入失败: ' + e.message);
    }
}
