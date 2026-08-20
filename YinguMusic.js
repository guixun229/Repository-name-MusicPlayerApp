var exec = require('cordova/exec');
var channel = require('cordova/channel');

/**
 * 音轨音乐服务插件
 * 提供后台播放、通知栏控制、MediaSession 功能
 */
var YinguMusic = {

    _controlCallback: null,

    /**
     * 内部控制回调 (由 Native 调用)
     */
    _onControl: function(action) {
        console.log('[YinguMusic] 收到控制指令: ' + action);
        if (YinguMusic._controlCallback) {
            YinguMusic._controlCallback(action);
        }
    },

    /**
     * 更新播放状态
     * @param {boolean} isPlaying - 是否正在播放
     * @param {string} trackName - 当前曲目名称
     * @param {number} trackIndex - 当前曲目序号 (从1开始)
     * @param {number} trackTotal - 总曲目数
     */
    updatePlayback: function(isPlaying, trackName, trackIndex, trackTotal) {
        exec(function(){}, function(err){ console.warn('updatePlayback error:', err); },
            'YinguMusic', 'updatePlayback', [isPlaying, trackName, trackIndex, trackTotal]);
    },

    /**
     * 启动前台服务
     */
    startService: function() {
        exec(function(){}, function(err){ console.warn('startService error:', err); },
            'YinguMusic', 'startService', []);
    },

    /**
     * 停止前台服务
     */
    stopService: function() {
        exec(function(){}, function(err){ console.warn('stopService error:', err); },
            'YinguMusic', 'stopService', []);
    },

    /**
     * 注册控制回调
     * 当用户点击通知栏按钮时，回调会被调用
     * @param {function} callback - 接收控制指令: 'toggle', 'next', 'prev', 'play', 'pause'
     */
    onControl: function(callback) {
        YinguMusic._controlCallback = callback;
        exec(function(){}, function(err){ console.warn('onControl error:', err); },
            'YinguMusic', 'registerControl', []);
    }
};

module.exports = YinguMusic;
