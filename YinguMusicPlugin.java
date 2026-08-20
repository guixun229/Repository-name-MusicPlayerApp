package com.yingu.player;

import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaWebView;
import org.apache.cordova.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.util.Log;

/**
 * 音轨 Cordova 插件
 * 桥接 Web 与 Native 音乐服务
 */
public class YinguMusicPlugin extends CordovaPlugin {

    private static final String TAG = "YinguMusicPlugin";
    private static CallbackContext controlCallback = null;

    private final BroadcastReceiver serviceControlReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent.hasExtra("control")) {
                String control = intent.getStringExtra("control");
                Log.d(TAG, "收到服务控制指令: " + control);
                sendControlToJs(control);
            }
        }
    };

    @Override
    public void initialize(CordovaInterface cordova, CordovaWebView webView) {
        super.initialize(cordova, webView);
        Log.d(TAG, "音轨插件初始化");

        IntentFilter filter = new IntentFilter("com.yingu.player.CONTROL");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            cordova.getActivity().registerReceiver(serviceControlReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            cordova.getActivity().registerReceiver(serviceControlReceiver, filter);
        }
    }

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        Log.d(TAG, "execute: " + action);

        if ("updatePlayback".equals(action)) {
            boolean isPlaying = args.getBoolean(0);
            String trackName = args.getString(1);
            int trackIndex = args.getInt(2);
            int trackTotal = args.getInt(3);
            updatePlaybackState(isPlaying, trackName, trackIndex, trackTotal);
            callbackContext.success();
            return true;

        } else if ("startService".equals(action)) {
            startMusicService();
            callbackContext.success();
            return true;

        } else if ("stopService".equals(action)) {
            stopMusicService();
            callbackContext.success();
            return true;

        } else if ("registerControl".equals(action)) {
            PluginResult result = new PluginResult(PluginResult.Status.NO_RESULT);
            result.setKeepCallback(true);
            callbackContext.sendPluginResult(result);
            controlCallback = callbackContext;
            return true;
        }

        return false;
    }

    private void updatePlaybackState(boolean isPlaying, String trackName, int trackIndex, int trackTotal) {
        Context context = cordova.getActivity();
        Intent intent = new Intent(context, MusicService.class);
        intent.setAction(MusicService.ACTION_UPDATE);
        intent.putExtra(MusicService.EXTRA_IS_PLAYING, isPlaying);
        intent.putExtra(MusicService.EXTRA_TRACK_NAME, trackName);
        intent.putExtra(MusicService.EXTRA_TRACK_INDEX, trackIndex);
        intent.putExtra(MusicService.EXTRA_TRACK_TOTAL, trackTotal);

        if (isPlaying) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } else {
            context.startService(intent);
        }
    }

    private void startMusicService() {
        Context context = cordova.getActivity();
        Intent intent = new Intent(context, MusicService.class);
        intent.setAction(MusicService.ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    private void stopMusicService() {
        Context context = cordova.getActivity();
        Intent intent = new Intent(context, MusicService.class);
        intent.setAction(MusicService.ACTION_STOP);
        context.startService(intent);
    }

    private void sendControlToJs(final String control) {
        cordova.getActivity().runOnUiThread(() -> {
            if (controlCallback != null) {
                PluginResult result = new PluginResult(PluginResult.Status.OK, control);
                result.setKeepCallback(true);
                controlCallback.sendPluginResult(result);
            }

            String js = "javascript:if(window.YinguMusic && window.YinguMusic._onControl) window.YinguMusic._onControl('" + control + "');";
            webView.loadUrl(js);
        });
    }

    @Override
    public void onDestroy() {
        stopMusicService();
        try {
            cordova.getActivity().unregisterReceiver(serviceControlReceiver);
        } catch (Exception e) {
            Log.w(TAG, "Receiver not registered", e);
        }
        super.onDestroy();
    }
}
