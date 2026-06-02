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
    getLiveStats: () => ipcRenderer.invoke('get-live-stats'),
    getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
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

    openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
