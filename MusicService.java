package com.yingu.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

/**
 * 音轨 - 前台播放服务
 * 纯 Android 原生 API，不依赖 androidx
 * 持有 PARTIAL_WAKE_LOCK 防止 CPU 休眠
 */
public class MusicService extends Service {

    private static final String TAG = "MusicService";
    private static final String CHANNEL_ID = "yingu_music_channel";
    private static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_START = "com.yingu.player.START";
    public static final String ACTION_STOP = "com.yingu.player.STOP";
    public static final String ACTION_UPDATE = "com.yingu.player.UPDATE";
    public static final String ACTION_TOGGLE = "com.yingu.player.TOGGLE";
    public static final String ACTION_NEXT = "com.yingu.player.NEXT";
    public static final String ACTION_PREV = "com.yingu.player.PREV";

    public static final String EXTRA_IS_PLAYING = "isPlaying";
    public static final String EXTRA_TRACK_NAME = "trackName";
    public static final String EXTRA_TRACK_INDEX = "trackIndex";
    public static final String EXTRA_TRACK_TOTAL = "trackTotal";

    private MediaSession mediaSession;
    private boolean isPlaying = false;
    private String trackName = "音轨";
    private int trackIndex = 0;
    private int trackTotal = 0;

    // 静态标志，供 MainActivity 检查播放状态
    private static volatile boolean sIsPlaying = false;

    // WakeLock 防止 CPU 休眠
    private PowerManager.WakeLock wakeLock;

    private final BroadcastReceiver controlReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (action == null) return;

            String control = null;
            if (ACTION_TOGGLE.equals(action)) control = "toggle";
            else if (ACTION_NEXT.equals(action)) control = "next";
            else if (ACTION_PREV.equals(action)) control = "prev";

            if (control != null) {
                sendControlToPlugin(control);
            }
        }
    };

    public static boolean isPlaybackActive() {
        return sIsPlaying;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        registerControlReceiver();
        setupMediaSession();
        acquireWakeLock();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "音轨播放",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("音乐播放控制");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void registerControlReceiver() {
        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_TOGGLE);
        filter.addAction(ACTION_NEXT);
        filter.addAction(ACTION_PREV);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(controlReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(controlReceiver, filter);
        }
    }

    private void setupMediaSession() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return;

        mediaSession = new MediaSession(this, "音轨");
        mediaSession.setFlags(
                MediaSession.FLAG_HANDLES_MEDIA_BUTTONS |
                MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS
        );

        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() { sendControlToPlugin("play"); }

            @Override
            public void onPause() { sendControlToPlugin("pause"); }

            @Override
            public void onSkipToNext() { sendControlToPlugin("next"); }

            @Override
            public void onSkipToPrevious() { sendControlToPlugin("prev"); }

            @Override
            public void onStop() {
                sendControlToPlugin("pause");
                stopForeground(true);
            }
        });

        mediaSession.setActive(true);
    }

    /**
     * 获取 PARTIAL_WAKE_LOCK，防止屏幕关闭后 CPU 进入休眠
     * 这是息屏后音频不中断的关键
     */
    private void acquireWakeLock() {
        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "音轨:MusicServiceWakeLock");
                wakeLock.setReferenceCounted(false);
            }
        }
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(60 * 60 * 1000L);
            Log.d(TAG, "WakeLock 已获取，CPU 保持唤醒");
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            Log.d(TAG, "WakeLock 已释放");
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) {
            return START_STICKY;
        }

        String action = intent.getAction();

        if (ACTION_START.equals(action)) {
            startForeground(NOTIFICATION_ID, buildNotification());
            acquireWakeLock();

        } else if (ACTION_UPDATE.equals(action)) {
            isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, false);
            trackName = intent.getStringExtra(EXTRA_TRACK_NAME);
            if (trackName == null) trackName = "音轨";
            trackIndex = intent.getIntExtra(EXTRA_TRACK_INDEX, 0);
            trackTotal = intent.getIntExtra(EXTRA_TRACK_TOTAL, 0);

            sIsPlaying = isPlaying;

            if (isPlaying) {
                acquireWakeLock();
                startForeground(NOTIFICATION_ID, buildNotification());
            } else {
                releaseWakeLock();
                NotificationManager manager = getSystemService(NotificationManager.class);
                if (manager != null) {
                    manager.notify(NOTIFICATION_ID, buildNotification());
                }
            }

            updateMediaSession();

        } else if (ACTION_STOP.equals(action)) {
            sIsPlaying = false;
            releaseWakeLock();
            stopForeground(true);
            stopSelf();
        }

        return START_STICKY;
    }

    private void updateMediaSession() {
        if (mediaSession == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            MediaMetadata.Builder metadataBuilder = new MediaMetadata.Builder();
            metadataBuilder.putString(MediaMetadata.METADATA_KEY_TITLE, trackName);
            metadataBuilder.putString(MediaMetadata.METADATA_KEY_ARTIST, "音轨");
            metadataBuilder.putString(MediaMetadata.METADATA_KEY_ALBUM, "音轨");
            mediaSession.setMetadata(metadataBuilder.build());

            PlaybackState.Builder stateBuilder = new PlaybackState.Builder();
            stateBuilder.setActions(
                    PlaybackState.ACTION_PLAY |
                    PlaybackState.ACTION_PAUSE |
                    PlaybackState.ACTION_PLAY_PAUSE |
                    PlaybackState.ACTION_SKIP_TO_NEXT |
                    PlaybackState.ACTION_SKIP_TO_PREVIOUS |
                    PlaybackState.ACTION_STOP
            );
            stateBuilder.setState(
                    isPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                    PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1.0f
            );
            mediaSession.setPlaybackState(stateBuilder.build());
        }
    }

    @SuppressWarnings("deprecation")
    private Notification buildNotification() {
        String packageName = getPackageName();
        Intent contentIntent = getPackageManager().getLaunchIntentForPackage(packageName);
        PendingIntent contentPI = PendingIntent.getActivity(this, 0, contentIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        PendingIntent prevPI = buildPendingIntent(ACTION_PREV, 1);
        PendingIntent togglePI = buildPendingIntent(ACTION_TOGGLE, 2);
        PendingIntent nextPI = buildPendingIntent(ACTION_NEXT, 3);

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        builder.setSmallIcon(R.drawable.ic_music_note)
                .setContentTitle(trackName)
                .setContentText(trackTotal > 0 ? (trackIndex + "/" + trackTotal) : "音轨")
                .setContentIntent(contentPI)
                .setShowWhen(false)
                .setOngoing(isPlaying)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .addAction(R.drawable.ic_skip_prev, "上一曲", prevPI)
                .addAction(isPlaying ? R.drawable.ic_pause : R.drawable.ic_play,
                        isPlaying ? "暂停" : "播放", togglePI)
                .addAction(R.drawable.ic_skip_next, "下一曲", nextPI);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && mediaSession != null) {
            builder.setStyle(new Notification.MediaStyle()
                    .setMediaSession(mediaSession.getSessionToken())
                    .setShowActionsInCompactView(0, 1, 2));
        }

        return builder.build();
    }

    private PendingIntent buildPendingIntent(String action, int requestCode) {
        Intent intent = new Intent(action);
        intent.setPackage(getPackageName());
        return PendingIntent.getBroadcast(this, requestCode, intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /**
     * 将控制指令发送回 Cordova 插件
     */
    private void sendControlToPlugin(final String control) {
        new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
            Intent pluginIntent = new Intent("com.yingu.player.CONTROL");
            pluginIntent.putExtra("control", control);
            pluginIntent.setPackage(getPackageName());
            sendBroadcast(pluginIntent);
        });
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        sIsPlaying = false;
        releaseWakeLock();
        try {
            unregisterReceiver(controlReceiver);
        } catch (Exception e) {
            Log.w(TAG, "Receiver not registered", e);
        }
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        sIsPlaying = false;
        releaseWakeLock();
        stopForeground(true);
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
