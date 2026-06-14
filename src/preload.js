const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),

    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
    getFullSystemInfo: () => {
        console.log('[SYSTEM INFO] IPC request starts: preload get-full-system-info');
        return ipcRenderer.invoke('get-full-system-info');
    },
    runSystemScan: () => ipcRenderer.invoke('run-system-scan'),
    getGpuInfo: () => ipcRenderer.invoke('get-gpu-info'),
    getGpuLiveStats: () => ipcRenderer.invoke('get-gpu-live-stats'),
    getLiveStats: () => ipcRenderer.invoke('get-live-stats'),
    getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
    getActiveNetwork: () => ipcRenderer.invoke('get-active-network'),
    flushDns: () => ipcRenderer.invoke('network-flush-dns'),
    runPingTest: (target) => ipcRenderer.invoke('network-ping-test', target),
    runPacketTest: (target) => ipcRenderer.invoke('network-packet-test', target),
    releaseRenewIp: () => ipcRenderer.invoke('network-release-renew-ip'),
    resetWinsock: () => ipcRenderer.invoke('network-reset-winsock'),

    applyTweak: (tweakId, action) => ipcRenderer.invoke('apply-tweak', tweakId, action),
    applyRecommendedTweaks: (tweakIds) => ipcRenderer.invoke('apply-recommended-tweaks', tweakIds),
    onTweakProgress: (cb) => {
        const handler = (_, data) => cb(data);
        ipcRenderer.on('tweak-progress', handler);
        return () => ipcRenderer.removeListener('tweak-progress', handler);
    },
    getToggleStates: () => ipcRenderer.invoke('get-toggle-states'),
    saveToggleState: (toggleId, state) => ipcRenderer.invoke('save-toggle-state', toggleId, state),
    runCleanup: (type) => ipcRenderer.invoke('run-cleanup', type),

    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    getAISystemContext: async () => {
        const out = {};
        try { out.sys     = await ipcRenderer.invoke('get-system-info');   } catch {}
        try { out.live    = await ipcRenderer.invoke('get-live-stats');     } catch {}
        try { out.gpu     = await ipcRenderer.invoke('get-gpu-info');       } catch {}
        try { out.gpuLive = await ipcRenderer.invoke('get-gpu-live-stats'); } catch {}
        try { out.toggles = await ipcRenderer.invoke('get-toggle-states'); } catch {}
        return out;
    },

    aiDetect: () => ipcRenderer.invoke('ollama-detect'),
    aiEngineSetup: () => ipcRenderer.invoke('ai-engine-setup'),
    aiChat: (messages) => ipcRenderer.invoke('ollama-chat', messages),
    aiPullModel: (model) => ipcRenderer.invoke('ollama-pull-model', model),
    onAiModelPullProgress: (cb) => {
        const handler = (_, data) => cb(data);
        ipcRenderer.on('ollama-pull-progress', handler);
        return () => ipcRenderer.removeListener('ollama-pull-progress', handler);
    },
    onAiEngineProgress: (cb) => {
        const handler = (_, data) => cb(data);
        ipcRenderer.on('ai-engine-progress', handler);
        return () => ipcRenderer.removeListener('ai-engine-progress', handler);
    },

    getBackgroundContext: () => ipcRenderer.invoke('get-background-context'),
    getStartupContext:    () => ipcRenderer.invoke('get-startup-context'),
    closeProcess: (pid, processName) => ipcRenderer.invoke('close-process', pid, processName),
    disableStartupEntry: (name, location) => ipcRenderer.invoke('disable-startup-entry', name, location),

    // DNS Optimizer & Network
    checkAdmin:          ()       => ipcRenderer.invoke('check-admin'),
    dnsOptimizerScan:    (opts)   => ipcRenderer.invoke('dns-optimizer-scan', opts),
    dnsOptimizerApply:   (params) => ipcRenderer.invoke('dns-optimizer-apply', params),
    dnsOptimizerRestore: ()       => ipcRenderer.invoke('dns-optimizer-restore'),
    dnsBackupExists:     ()       => ipcRenderer.invoke('dns-backup-exists'),
    gpuGamingStatus:     ()       => ipcRenderer.invoke('gpu-gaming-status'),
    networkIpReset:      ()       => ipcRenderer.invoke('network-ip-reset'),
});
