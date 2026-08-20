package com.yingu.player;

import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;

import org.apache.cordova.CordovaActivity;

/**
 * 音轨 - 自定义 MainActivity
 * 关键：息屏时保持 WebView 运行，防止音频中断
 *
 * 原理：
 * 1. CordovaActivity.onPause() 会调用 appView.handlePause()，
 *    这会向 JS 发送 pause 事件并可能暂停 WebView 定时器
 * 2. 我们在 onPause 后立即调用 handleResume() "撤销"暂停，
 *    使 WebView 保持运行状态，音频继续播放
 * 3. 配合 MusicService 中的 PARTIAL_WAKE_LOCK，CPU 不会休眠
 */
public class MainActivity extends CordovaActivity {

    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 启用后台启动
        Bundle extras = getIntent().getExtras();
        if (extras != null && extras.getBoolean("cdvStartInBackground", false)) {
            moveTaskToBack(true);
        }

        loadUrl(launchUrl);
    }

    /**
     * 关键重写：息屏时不暂停 WebView
     *
     * CordovaActivity.onPause() 流程：
     *   super.onPause() → Activity.onPause()
     *   appView.handlePause(keepRunning) → 发送 pause 事件、通知插件
     *
     * 我们的策略：
     *   播放中 → 调用 super.onPause() 后立即 handleResume()，撤销暂停
     *   未播放 → 正常暂停
     */
    @Override
    protected void onPause() {
        if (MusicService.isPlaybackActive() && this.appView != null) {
            // 音乐正在播放：先执行标准暂停流程，再立即恢复
            super.onPause();
            // 撤销 handlePause 的效果：恢复定时器、清除 isPaused 标志
            this.appView.handleResume(this.keepRunning);
            Log.d(TAG, "息屏保活：WebView 保持运行，音频继续播放");
        } else {
            // 未播放：正常暂停
            super.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // 恢复时确保 WebView 处于运行状态
        if (this.appView != null) {
            this.appView.handleResume(this.keepRunning);
        }
    }
}
